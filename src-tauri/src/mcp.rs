// MCP istemcisi. İki taşıma: (1) stdio — süreç
// spawn + satır-ayrımlı JSON-RPC 2.0, id-korelasyonlu; (2) http — Streamable HTTP: her
// istek JSON-RPC POST, yanıt application/json veya text/event-stream (SSE tek olay),
// oturum başlığı (Mcp-Session-Id) korunur. Sonuç Value döner; DTO şekillendirme webview'da.

use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::State;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::{mpsc, oneshot};

type Pending = Arc<Mutex<HashMap<u64, oneshot::Sender<Result<Value, String>>>>>;

#[derive(Clone)]
struct StdioConn {
    stdin_tx: mpsc::UnboundedSender<String>,
    pending: Pending,
    next_id: Arc<AtomicU64>,
    child: Arc<Mutex<Option<Child>>>,
}

#[derive(Clone)]
struct HttpConn {
    url: String,
    client: reqwest::Client,
    session_id: Arc<Mutex<Option<String>>>,
    next_id: Arc<AtomicU64>,
}

#[derive(Clone)]
enum McpConn {
    Stdio(StdioConn),
    Http(HttpConn),
}

#[derive(Default)]
pub struct McpState {
    conns: Mutex<HashMap<String, McpConn>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpConfig {
    transport: String,
    #[serde(default)]
    command: Option<String>,
    #[serde(default)]
    args: Option<Vec<String>>,
    #[serde(default)]
    url: Option<String>,
}

// ---- İstek/bildirim yönlendirmesi ----

async fn request(conn: &McpConn, method: &str, params: Value) -> Result<Value, String> {
    match conn {
        McpConn::Stdio(s) => stdio_request(s, method, params).await,
        McpConn::Http(h) => http_request(h, method, params).await,
    }
}

async fn notify(conn: &McpConn, method: &str, params: Value) {
    match conn {
        McpConn::Stdio(s) => {
            let _ = s
                .stdin_tx
                .send(json!({ "jsonrpc": "2.0", "method": method, "params": params }).to_string());
        }
        McpConn::Http(h) => {
            let _ = http_send(
                h,
                &json!({ "jsonrpc": "2.0", "method": method, "params": params }),
            )
            .await;
        }
    }
}

// ---- stdio ----

async fn stdio_request(conn: &StdioConn, method: &str, params: Value) -> Result<Value, String> {
    let id = conn.next_id.fetch_add(1, Ordering::SeqCst);
    let (tx, rx) = oneshot::channel();
    conn.pending
        .lock()
        .map_err(|e| e.to_string())?
        .insert(id, tx);
    let _ = conn.stdin_tx.send(
        json!({ "jsonrpc": "2.0", "id": id, "method": method, "params": params }).to_string(),
    );
    match tokio::time::timeout(Duration::from_secs(30), rx).await {
        Ok(Ok(result)) => result,
        Ok(Err(_)) => Err("MCP yanıt kanalı kapandı".to_string()),
        Err(_) => {
            if let Ok(mut pending) = conn.pending.lock() {
                pending.remove(&id);
            }
            Err("MCP isteği zaman aşımına uğradı".to_string())
        }
    }
}

// ---- http (Streamable HTTP) ----

// JSON-RPC gövdeyi POST eder; oturum başlığı korunur; yanıt (json veya SSE) döndürülür.
async fn http_send(conn: &HttpConn, payload: &Value) -> Result<(u16, String, String), String> {
    let mut builder = conn
        .client
        .post(&conn.url)
        .header("content-type", "application/json")
        .header("accept", "application/json, text/event-stream")
        .body(payload.to_string());
    if let Some(sid) = conn.session_id.lock().map_err(|e| e.to_string())?.clone() {
        builder = builder.header("mcp-session-id", sid);
    }
    let response = builder.send().await.map_err(|e| e.to_string())?;
    if let Some(sid) = response
        .headers()
        .get("mcp-session-id")
        .and_then(|v| v.to_str().ok())
    {
        *conn.session_id.lock().map_err(|e| e.to_string())? = Some(sid.to_string());
    }
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    let status = response.status().as_u16();
    let text = response.text().await.map_err(|e| e.to_string())?;
    Ok((status, content_type, text))
}

// SSE ise ilk JSON-RPC yanıtı içeren `data:` satırını, değilse gövdeyi ayrıştırır.
fn parse_jsonrpc(content_type: &str, text: &str) -> Result<Value, String> {
    if content_type.contains("text/event-stream") {
        for line in text.lines() {
            if let Some(data) = line.strip_prefix("data:") {
                if let Ok(value) = serde_json::from_str::<Value>(data.trim()) {
                    if value.get("result").is_some() || value.get("error").is_some() {
                        return Ok(value);
                    }
                }
            }
        }
        Err("SSE yanıtında JSON-RPC bulunamadı".to_string())
    } else {
        serde_json::from_str(text).map_err(|e| format!("MCP yanıtı ayrıştırılamadı: {e}"))
    }
}

async fn http_request(conn: &HttpConn, method: &str, params: Value) -> Result<Value, String> {
    let id = conn.next_id.fetch_add(1, Ordering::SeqCst);
    let payload = json!({ "jsonrpc": "2.0", "id": id, "method": method, "params": params });
    let (status, content_type, text) = http_send(conn, &payload).await?;
    if !(200..300).contains(&status) {
        return Err(format!("MCP HTTP {status}: {text}"));
    }
    let value = parse_jsonrpc(&content_type, &text)?;
    match value.get("error") {
        Some(err) => Err(err.to_string()),
        None => Ok(value.get("result").cloned().unwrap_or(Value::Null)),
    }
}

// ---- Ortak ----

fn get_conn(state: &State<'_, McpState>, id: &str) -> Result<McpConn, String> {
    state
        .conns
        .lock()
        .map_err(|e| e.to_string())?
        .get(id)
        .cloned()
        .ok_or_else(|| "MCP bağlantısı bulunamadı veya kapatılmış".to_string())
}

async fn handshake(conn: &McpConn) -> Result<(), String> {
    request(
        conn,
        "initialize",
        json!({
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": { "name": "antiphon", "version": "0.1.0" }
        }),
    )
    .await?;
    notify(conn, "notifications/initialized", json!({})).await;
    Ok(())
}

#[tauri::command]
pub async fn mcp_connect(
    state: State<'_, McpState>,
    connection_id: String,
    config: McpConfig,
) -> Result<(), String> {
    let conn = match config.transport.as_str() {
        "stdio" => connect_stdio(config)?,
        "http" => connect_http(config)?,
        other => return Err(format!("Bilinmeyen MCP taşıması: '{other}'")),
    };
    handshake(&conn).await?;
    state
        .conns
        .lock()
        .map_err(|e| e.to_string())?
        .insert(connection_id, conn);
    Ok(())
}

fn connect_http(config: McpConfig) -> Result<McpConn, String> {
    let url = config
        .url
        .filter(|u| !u.is_empty())
        .ok_or_else(|| "MCP http URL'i boş".to_string())?;
    Ok(McpConn::Http(HttpConn {
        url,
        client: reqwest::Client::new(),
        session_id: Arc::new(Mutex::new(None)),
        next_id: Arc::new(AtomicU64::new(1)),
    }))
}

fn connect_stdio(config: McpConfig) -> Result<McpConn, String> {
    let command = config
        .command
        .filter(|c| !c.is_empty())
        .ok_or_else(|| "MCP komutu boş".to_string())?;
    let args = config.args.unwrap_or_default();

    let mut child = Command::new(&command)
        .args(&args)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("MCP süreci başlatılamadı '{command}': {e}"))?;

    let mut stdin = child.stdin.take().ok_or("stdin alınamadı")?;
    let stdout = child.stdout.take().ok_or("stdout alınamadı")?;
    let pending: Pending = Arc::new(Mutex::new(HashMap::new()));

    // Yazıcı görevi.
    let (stdin_tx, mut stdin_rx) = mpsc::unbounded_channel::<String>();
    tokio::spawn(async move {
        while let Some(line) = stdin_rx.recv().await {
            if stdin.write_all(line.as_bytes()).await.is_err()
                || stdin.write_all(b"\n").await.is_err()
            {
                break;
            }
            let _ = stdin.flush().await;
        }
    });

    // Okuyucu görevi: id ile bekleyen isteği çözer.
    let pending_reader = pending.clone();
    tokio::spawn(async move {
        let mut lines = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let Ok(value) = serde_json::from_str::<Value>(&line) else {
                continue;
            };
            if let Some(id) = value.get("id").and_then(|v| v.as_u64()) {
                let waiter = pending_reader.lock().ok().and_then(|mut p| p.remove(&id));
                if let Some(tx) = waiter {
                    let outcome = match value.get("error") {
                        Some(err) => Err(err.to_string()),
                        None => Ok(value.get("result").cloned().unwrap_or(Value::Null)),
                    };
                    let _ = tx.send(outcome);
                }
            }
        }
    });

    Ok(McpConn::Stdio(StdioConn {
        stdin_tx,
        pending,
        next_id: Arc::new(AtomicU64::new(1)),
        child: Arc::new(Mutex::new(Some(child))),
    }))
}

#[tauri::command]
pub async fn mcp_disconnect(
    state: State<'_, McpState>,
    connection_id: String,
) -> Result<(), String> {
    let conn = state
        .conns
        .lock()
        .map_err(|e| e.to_string())?
        .remove(&connection_id);
    if let Some(McpConn::Stdio(s)) = conn {
        let child = s.child.lock().ok().and_then(|mut c| c.take());
        if let Some(mut child) = child {
            let _ = child.kill().await;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn mcp_list_tools(
    state: State<'_, McpState>,
    connection_id: String,
) -> Result<Value, String> {
    request(&get_conn(&state, &connection_id)?, "tools/list", json!({})).await
}

#[tauri::command]
pub async fn mcp_list_resources(
    state: State<'_, McpState>,
    connection_id: String,
) -> Result<Value, String> {
    request(
        &get_conn(&state, &connection_id)?,
        "resources/list",
        json!({}),
    )
    .await
}

#[tauri::command]
pub async fn mcp_list_prompts(
    state: State<'_, McpState>,
    connection_id: String,
) -> Result<Value, String> {
    request(
        &get_conn(&state, &connection_id)?,
        "prompts/list",
        json!({}),
    )
    .await
}

#[tauri::command]
pub async fn mcp_call_tool(
    state: State<'_, McpState>,
    connection_id: String,
    tool_name: String,
    args: Value,
) -> Result<Value, String> {
    request(
        &get_conn(&state, &connection_id)?,
        "tools/call",
        json!({ "name": tool_name, "arguments": args }),
    )
    .await
}

#[tauri::command]
pub async fn mcp_read_resource(
    state: State<'_, McpState>,
    connection_id: String,
    uri: String,
) -> Result<Value, String> {
    request(
        &get_conn(&state, &connection_id)?,
        "resources/read",
        json!({ "uri": uri }),
    )
    .await
}

#[tauri::command]
pub async fn mcp_get_prompt(
    state: State<'_, McpState>,
    connection_id: String,
    prompt_name: String,
    args: Value,
) -> Result<Value, String> {
    request(
        &get_conn(&state, &connection_id)?,
        "prompts/get",
        json!({ "name": prompt_name, "arguments": args }),
    )
    .await
}
