// Realtime katmanı: WebSocket, SSE, GraphQL subscription.
//
// tokio-tungstenite (WS + graphql-transport-ws) + reqwest bytes_stream (SSE).
// Olaylar Tauri event'leriyle webview'a yayılır:
// `ws-event`, `sse-event`, `graphql-sub-event`. Bağlantılar managed state'te tutulur.

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::mpsc::{unbounded_channel, UnboundedSender};
use tokio::task::AbortHandle;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::http::header::{HeaderName, HeaderValue};
use tokio_tungstenite::tungstenite::protocol::Message;

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

#[derive(Deserialize, Clone)]
pub struct HeaderInput {
    pub key: String,
    pub value: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
}

fn default_true() -> bool {
    true
}

fn header_pairs(headers: &[HeaderInput]) -> Vec<(String, String)> {
    headers
        .iter()
        .filter(|h| h.enabled && !h.key.is_empty())
        .map(|h| (h.key.clone(), h.value.clone()))
        .collect()
}

// ---- Managed state ----

struct WsHandle {
    tx: UnboundedSender<Message>,
    abort: AbortHandle,
}

#[derive(Default)]
pub struct RealtimeState {
    ws: Mutex<HashMap<String, WsHandle>>,
    sse: Mutex<HashMap<String, AbortHandle>>,
    gql: Mutex<HashMap<String, AbortHandle>>,
}

// ---- Olay şekilleri (WsEvent/SseEvent/GraphqlSubscriptionEvent DTO paritesi) ----

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct WsEvent {
    connection_id: String,
    #[serde(rename = "type")]
    event_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    is_binary: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    code: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<String>,
    timestamp: i64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SseEvent {
    connection_id: String,
    #[serde(rename = "type")]
    event_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    event_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<String>,
    timestamp: i64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct GraphqlSubEvent {
    connection_id: String,
    #[serde(rename = "type")]
    event_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<String>,
    timestamp: i64,
}

fn ws_event(app: &AppHandle, event: WsEvent) {
    let _ = app.emit("ws-event", event);
}
fn sse_event(app: &AppHandle, event: SseEvent) {
    let _ = app.emit("sse-event", event);
}
fn gql_event(app: &AppHandle, event: GraphqlSubEvent) {
    let _ = app.emit("graphql-sub-event", event);
}

fn build_ws_request(
    url: &str,
    headers: &[HeaderInput],
    subprotocol: Option<&str>,
) -> Result<tokio_tungstenite::tungstenite::handshake::client::Request, String> {
    let mut request = url
        .into_client_request()
        .map_err(|e| format!("geçersiz WS URL: {e}"))?;
    let map = request.headers_mut();
    for (key, value) in header_pairs(headers) {
        if let (Ok(name), Ok(val)) = (
            HeaderName::from_bytes(key.as_bytes()),
            HeaderValue::from_str(&value),
        ) {
            map.insert(name, val);
        }
    }
    if let Some(protocol) = subprotocol {
        if let Ok(val) = HeaderValue::from_str(protocol) {
            map.insert(HeaderName::from_static("sec-websocket-protocol"), val);
        }
    }
    Ok(request)
}

// ---- WebSocket ----

#[tauri::command]
pub async fn ws_connect(
    app: AppHandle,
    state: State<'_, RealtimeState>,
    connection_id: String,
    url: String,
    headers: Vec<HeaderInput>,
) -> Result<(), String> {
    let request = build_ws_request(&url, &headers, None)?;
    let (tx, mut rx) = unbounded_channel::<Message>();
    let cid = connection_id.clone();

    let handle = tokio::spawn(async move {
        let stream = match tokio_tungstenite::connect_async(request).await {
            Ok((stream, _)) => stream,
            Err(e) => {
                ws_event(&app, ws_error(&cid, &e.to_string()));
                remove_ws(&app, &cid);
                return;
            }
        };
        ws_event(&app, ws_simple(&cid, "open"));
        let (mut write, mut read) = stream.split();

        loop {
            tokio::select! {
                outgoing = rx.recv() => match outgoing {
                    Some(msg) => { if write.send(msg).await.is_err() { break; } }
                    None => { let _ = write.send(Message::Close(None)).await; break; }
                },
                incoming = read.next() => match incoming {
                    Some(Ok(Message::Text(text))) => ws_event(&app, ws_message(&cid, text, false)),
                    Some(Ok(Message::Binary(bytes))) => {
                        ws_event(&app, ws_message(&cid, BASE64.encode(&bytes), true))
                    }
                    Some(Ok(Message::Close(frame))) => {
                        let (code, reason) = frame
                            .map(|f| (Some(u16::from(f.code)), f.reason.to_string()))
                            .unwrap_or((None, String::new()));
                        ws_event(&app, ws_close_event(&cid, code, reason));
                        break;
                    }
                    Some(Ok(_)) => {} // ping/pong/frame
                    Some(Err(e)) => { ws_event(&app, ws_error(&cid, &e.to_string())); break; }
                    None => break,
                }
            }
        }
        remove_ws(&app, &cid);
    });

    state.ws.lock().map_err(|e| e.to_string())?.insert(
        connection_id,
        WsHandle {
            tx,
            abort: handle.abort_handle(),
        },
    );
    Ok(())
}

#[tauri::command]
pub fn ws_send(
    state: State<'_, RealtimeState>,
    connection_id: String,
    data: String,
    is_binary: Option<bool>,
) -> Result<(), String> {
    let map = state.ws.lock().map_err(|e| e.to_string())?;
    if let Some(handle) = map.get(&connection_id) {
        let message = if is_binary.unwrap_or(false) {
            Message::Binary(BASE64.decode(data).map_err(|e| e.to_string())?)
        } else {
            Message::Text(data)
        };
        let _ = handle.tx.send(message);
    }
    Ok(())
}

#[tauri::command]
pub fn ws_close(state: State<'_, RealtimeState>, connection_id: String) -> Result<(), String> {
    if let Some(handle) = state
        .ws
        .lock()
        .map_err(|e| e.to_string())?
        .remove(&connection_id)
    {
        handle.abort.abort();
    }
    Ok(())
}

fn remove_ws(app: &AppHandle, connection_id: &str) {
    if let Some(state) = app.try_state::<RealtimeState>() {
        if let Ok(mut map) = state.ws.lock() {
            map.remove(connection_id);
        }
    }
}

fn ws_simple(cid: &str, event_type: &str) -> WsEvent {
    WsEvent {
        connection_id: cid.to_string(),
        event_type: event_type.to_string(),
        data: None,
        is_binary: None,
        code: None,
        reason: None,
        message: None,
        timestamp: now_ms(),
    }
}
fn ws_message(cid: &str, data: String, is_binary: bool) -> WsEvent {
    WsEvent {
        data: Some(data),
        is_binary: Some(is_binary),
        ..ws_simple(cid, "message")
    }
}
fn ws_close_event(cid: &str, code: Option<u16>, reason: String) -> WsEvent {
    WsEvent {
        code,
        reason: Some(reason),
        ..ws_simple(cid, "close")
    }
}
fn ws_error(cid: &str, message: &str) -> WsEvent {
    WsEvent {
        message: Some(message.to_string()),
        ..ws_simple(cid, "error")
    }
}

// ---- SSE ----

#[tauri::command]
pub async fn sse_connect(
    app: AppHandle,
    state: State<'_, RealtimeState>,
    connection_id: String,
    url: String,
    headers: Vec<HeaderInput>,
) -> Result<(), String> {
    let cid = connection_id.clone();
    let handle = tokio::spawn(async move {
        let client = reqwest::Client::new();
        let mut builder = client.get(&url).header("Accept", "text/event-stream");
        for (key, value) in header_pairs(&headers) {
            builder = builder.header(key, value);
        }

        let response = match builder.send().await {
            Ok(response) => response,
            Err(e) => {
                sse_event(&app, sse_error(&cid, &e.to_string()));
                remove_sse(&app, &cid);
                return;
            }
        };
        sse_event(&app, sse_simple(&cid, "open"));

        let mut stream = response.bytes_stream();
        let mut buffer = String::new();
        while let Some(chunk) = stream.next().await {
            match chunk {
                Ok(bytes) => {
                    buffer.push_str(&String::from_utf8_lossy(&bytes));
                    buffer = parse_sse(&buffer, |event_name, data| {
                        sse_event(&app, sse_message(&cid, event_name, data));
                    });
                }
                Err(e) => {
                    sse_event(&app, sse_error(&cid, &e.to_string()));
                    break;
                }
            }
        }
        sse_event(&app, sse_simple(&cid, "close"));
        remove_sse(&app, &cid);
    });

    state
        .sse
        .lock()
        .map_err(|e| e.to_string())?
        .insert(connection_id, handle.abort_handle());
    Ok(())
}

#[tauri::command]
pub fn sse_close(state: State<'_, RealtimeState>, connection_id: String) -> Result<(), String> {
    if let Some(handle) = state
        .sse
        .lock()
        .map_err(|e| e.to_string())?
        .remove(&connection_id)
    {
        handle.abort();
    }
    Ok(())
}

fn remove_sse(app: &AppHandle, connection_id: &str) {
    if let Some(state) = app.try_state::<RealtimeState>() {
        if let Ok(mut map) = state.sse.lock() {
            map.remove(connection_id);
        }
    }
}

// SSE akışı `\n\n` ile ayrılmış bloklardan oluşur; her blokta `event:`/`data:` satırları.
// Tamamlanmamış son blok (remainder) döndürülür.
fn parse_sse(buffer: &str, mut on_event: impl FnMut(Option<String>, String)) -> String {
    let mut blocks: Vec<&str> = buffer.split("\n\n").collect();
    let remainder = blocks.pop().unwrap_or("").to_string();
    for block in blocks {
        let mut event_name: Option<String> = None;
        let mut data_lines: Vec<String> = Vec::new();
        for line in block.split('\n') {
            if let Some(rest) = line.strip_prefix("event:") {
                event_name = Some(rest.trim().to_string());
            } else if let Some(rest) = line.strip_prefix("data:") {
                data_lines.push(rest.trim().to_string());
            }
        }
        if !data_lines.is_empty() {
            on_event(event_name, data_lines.join("\n"));
        }
    }
    remainder
}

fn sse_simple(cid: &str, event_type: &str) -> SseEvent {
    SseEvent {
        connection_id: cid.to_string(),
        event_type: event_type.to_string(),
        event_name: None,
        data: None,
        message: None,
        timestamp: now_ms(),
    }
}
fn sse_message(cid: &str, event_name: Option<String>, data: String) -> SseEvent {
    SseEvent {
        event_name,
        data: Some(data),
        ..sse_simple(cid, "message")
    }
}
fn sse_error(cid: &str, message: &str) -> SseEvent {
    SseEvent {
        message: Some(message.to_string()),
        ..sse_simple(cid, "error")
    }
}

// ---- GraphQL subscription (graphql-transport-ws) ----

#[tauri::command]
pub async fn graphql_subscribe(
    app: AppHandle,
    state: State<'_, RealtimeState>,
    connection_id: String,
    url: String,
    query: String,
    variables: Value,
    headers: Vec<HeaderInput>,
) -> Result<(), String> {
    let request = build_ws_request(&url, &headers, Some("graphql-transport-ws"))?;
    // connection_init payload'ı: header'lar (eski connectionParams davranışı).
    let mut params = Map::new();
    for (key, value) in header_pairs(&headers) {
        params.insert(key, Value::String(value));
    }
    let cid = connection_id.clone();

    let handle = tokio::spawn(async move {
        let stream = match tokio_tungstenite::connect_async(request).await {
            Ok((stream, _)) => stream,
            Err(e) => {
                gql_event(&app, gql_error(&cid, &e.to_string()));
                remove_gql(&app, &cid);
                return;
            }
        };
        let (mut write, mut read) = stream.split();

        // connection_init gönder.
        let init = json!({ "type": "connection_init", "payload": Value::Object(params) });
        if write.send(Message::Text(init.to_string())).await.is_err() {
            gql_event(&app, gql_error(&cid, "connection_init gönderilemedi"));
            remove_gql(&app, &cid);
            return;
        }

        while let Some(item) = read.next().await {
            let text = match item {
                Ok(Message::Text(text)) => text,
                Ok(Message::Close(_)) | Err(_) => break,
                Ok(_) => continue,
            };
            let Ok(value) = serde_json::from_str::<Value>(&text) else {
                continue;
            };
            match value.get("type").and_then(|t| t.as_str()) {
                Some("connection_ack") => {
                    gql_event(&app, gql_simple(&cid, "open"));
                    let subscribe = json!({
                        "id": "1",
                        "type": "subscribe",
                        "payload": { "query": query, "variables": variables }
                    });
                    if write
                        .send(Message::Text(subscribe.to_string()))
                        .await
                        .is_err()
                    {
                        break;
                    }
                }
                Some("next") => {
                    let payload = value.get("payload").cloned().unwrap_or(Value::Null);
                    gql_event(&app, gql_next(&cid, payload.to_string()));
                }
                Some("error") => {
                    let payload = value.get("payload").cloned().unwrap_or(Value::Null);
                    gql_event(&app, gql_error(&cid, &payload.to_string()));
                }
                Some("complete") => {
                    gql_event(&app, gql_simple(&cid, "complete"));
                    break;
                }
                Some("ping") => {
                    let _ = write
                        .send(Message::Text(json!({"type":"pong"}).to_string()))
                        .await;
                }
                _ => {}
            }
        }
        gql_event(&app, gql_simple(&cid, "complete"));
        remove_gql(&app, &cid);
    });

    state
        .gql
        .lock()
        .map_err(|e| e.to_string())?
        .insert(connection_id, handle.abort_handle());
    Ok(())
}

#[tauri::command]
pub fn graphql_unsubscribe(
    state: State<'_, RealtimeState>,
    connection_id: String,
) -> Result<(), String> {
    if let Some(handle) = state
        .gql
        .lock()
        .map_err(|e| e.to_string())?
        .remove(&connection_id)
    {
        handle.abort();
    }
    Ok(())
}

fn remove_gql(app: &AppHandle, connection_id: &str) {
    if let Some(state) = app.try_state::<RealtimeState>() {
        if let Ok(mut map) = state.gql.lock() {
            map.remove(connection_id);
        }
    }
}

fn gql_simple(cid: &str, event_type: &str) -> GraphqlSubEvent {
    GraphqlSubEvent {
        connection_id: cid.to_string(),
        event_type: event_type.to_string(),
        data: None,
        message: None,
        timestamp: now_ms(),
    }
}
fn gql_next(cid: &str, data: String) -> GraphqlSubEvent {
    GraphqlSubEvent {
        data: Some(data),
        ..gql_simple(cid, "next")
    }
}
fn gql_error(cid: &str, message: &str) -> GraphqlSubEvent {
    GraphqlSubEvent {
        message: Some(message.to_string()),
        ..gql_simple(cid, "error")
    }
}
