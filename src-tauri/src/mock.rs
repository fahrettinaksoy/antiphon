// Mock server — axum ile 127.0.0.1'de dinler.
//
// OpenAPI ayrıştırma + gövde üretimi (faker) webview'da yapılır; buraya hazır rota tablosu
// ({method, path, body}) gelir. Tek fallback handler, isteği yol-şablonuna (param eşlemeli)
// göre eşleyip kayıtlı JSON gövdeyi döndürür. Sunucu managed state'te tutulur (start/stop).

use axum::{extract::State, response::IntoResponse, response::Response, Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};
use tauri::State as TauriState;
use tokio::sync::oneshot;

#[derive(Deserialize)]
pub struct MockRoute {
    pub method: String,
    pub path: String,
    pub body: Value,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RouteSummary {
    pub method: String,
    pub path: String,
}

#[derive(Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct MockStatus {
    pub running: bool,
    pub port: Option<u16>,
    pub routes: Vec<RouteSummary>,
}

enum Segment {
    Literal(String),
    Param,
}

struct CompiledRoute {
    method: String,
    segments: Vec<Segment>,
    body: Value,
}

impl CompiledRoute {
    fn matches(&self, method: &str, path: &str) -> bool {
        if !self.method.eq_ignore_ascii_case(method) {
            return false;
        }
        let parts: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
        if parts.len() != self.segments.len() {
            return false;
        }
        self.segments
            .iter()
            .zip(parts.iter())
            .all(|(seg, part)| match seg {
                Segment::Param => true,
                Segment::Literal(lit) => lit == part,
            })
    }
}

fn compile(path: &str) -> Vec<Segment> {
    path.split('/')
        .filter(|s| !s.is_empty())
        .map(|s| {
            if s.starts_with('{') && s.ends_with('}') {
                Segment::Param
            } else {
                Segment::Literal(s.to_string())
            }
        })
        .collect()
}

#[derive(Default)]
struct MockInner {
    shutdown: Option<oneshot::Sender<()>>,
    status: MockStatus,
}

#[derive(Default)]
pub struct MockState {
    inner: Mutex<MockInner>,
}

async fn mock_handler(
    State(routes): State<Arc<Vec<CompiledRoute>>>,
    req: axum::extract::Request,
) -> Response {
    let method = req.method().as_str().to_string();
    let path = req.uri().path().to_string();
    for route in routes.iter() {
        if route.matches(&method, &path) {
            return Json(route.body.clone()).into_response();
        }
    }
    (
        axum::http::StatusCode::NOT_FOUND,
        Json(json!({ "error": "Bu yol için mock rota yok" })),
    )
        .into_response()
}

#[tauri::command]
pub async fn mock_start(
    state: TauriState<'_, MockState>,
    routes: Vec<MockRoute>,
    port: u16,
) -> Result<MockStatus, String> {
    stop_current(&state)?;

    let summaries: Vec<RouteSummary> = routes
        .iter()
        .map(|r| RouteSummary {
            method: r.method.to_uppercase(),
            path: r.path.clone(),
        })
        .collect();
    let compiled: Vec<CompiledRoute> = routes
        .into_iter()
        .map(|r| CompiledRoute {
            method: r.method,
            segments: compile(&r.path),
            body: r.body,
        })
        .collect();

    let listener = tokio::net::TcpListener::bind(("127.0.0.1", port))
        .await
        .map_err(|e| format!("{port} portu dinlenemedi: {e}"))?;

    let app = Router::new()
        .fallback(mock_handler)
        .with_state(Arc::new(compiled));

    let (tx, rx) = oneshot::channel::<()>();
    tokio::spawn(async move {
        let _ = axum::serve(listener, app)
            .with_graceful_shutdown(async {
                let _ = rx.await;
            })
            .await;
    });

    let status = MockStatus {
        running: true,
        port: Some(port),
        routes: summaries,
    };
    let mut inner = state.inner.lock().map_err(|e| e.to_string())?;
    inner.shutdown = Some(tx);
    inner.status = status.clone();
    Ok(status)
}

#[tauri::command]
pub fn mock_stop(state: TauriState<'_, MockState>) -> Result<(), String> {
    stop_current(&state)
}

#[tauri::command]
pub fn mock_status(state: TauriState<'_, MockState>) -> Result<MockStatus, String> {
    Ok(state
        .inner
        .lock()
        .map_err(|e| e.to_string())?
        .status
        .clone())
}

fn stop_current(state: &TauriState<'_, MockState>) -> Result<(), String> {
    let mut inner = state.inner.lock().map_err(|e| e.to_string())?;
    if let Some(tx) = inner.shutdown.take() {
        let _ = tx.send(());
    }
    inner.status = MockStatus::default();
    Ok(())
}
