// HTTP istek motoru (reqwest).
//
// İş bölümü: şablon/script çözümü ve test script'i webview'da; BU komut çözülmüş isteği
// ağ üzerinden gönderir. Sertleştirme:
// proxy, özel CA, istemci sertifikası, SSL doğrulama ve SAYILABİLİR çerez kavanozu (managed
// state, istekler arası kalıcı). Gövde her yönde base64 (ikili güvenli).

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use reqwest_cookie_store::{CookieStore, CookieStoreMutex};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Instant;
use tauri::State;

// Çerez kavanozu managed state'te; istekler arası kalıcı ve listelenebilir.
pub struct HttpState {
    pub cookie_store: Arc<CookieStoreMutex>,
}

impl Default for HttpState {
    fn default() -> Self {
        Self {
            cookie_store: Arc::new(CookieStoreMutex::new(CookieStore::default())),
        }
    }
}

#[derive(Deserialize)]
pub struct HeaderPair {
    pub key: String,
    pub value: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpSendRequest {
    pub method: String,
    pub url: String,
    #[serde(default)]
    pub headers: Vec<HeaderPair>,
    /// Çözülmüş istek gövdesi, base64 (yoksa None).
    #[serde(default)]
    pub body_base64: Option<String>,
    #[serde(default)]
    pub timeout_ms: Option<u64>,
    #[serde(default = "default_true")]
    pub follow_redirects: bool,
    #[serde(default)]
    pub max_redirects: Option<u32>,
    #[serde(default = "default_true")]
    pub verify_ssl: bool,
    // --- Ağ ayarları (Settings → Network) ---
    #[serde(default)]
    pub proxy_url: Option<String>,
    #[serde(default)]
    pub ca_pem: Option<String>,
    #[serde(default)]
    pub client_cert_pem: Option<String>,
    #[serde(default)]
    pub client_key_pem: Option<String>,
    /// Bu istek için çerez kavanozu kullanılsın mı.
    #[serde(default)]
    pub cookie_jar: bool,
    /// "auto" (ALPN), "http1" (yalnız HTTP/1.1) veya "http2".
    #[serde(default)]
    pub http_version: Option<String>,
}

fn default_true() -> bool {
    true
}

fn non_empty(value: Option<String>) -> Option<String> {
    value.filter(|s| !s.trim().is_empty())
}

#[derive(Serialize)]
pub struct ResponseHeader {
    pub key: String,
    pub value: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpSendResponse {
    pub status: u16,
    pub status_text: String,
    pub headers: Vec<ResponseHeader>,
    /// Yanıt gövdesi, base64 (frontend içerik türüne göre çözer).
    pub body_base64: String,
    pub size_bytes: usize,
    /// İlk bayta kadar (gönderim→yanıt başlıkları) süre (ms). DNS/TCP/TLS'i içerir —
    /// reqwest bunları ayrı vermez; frontend dns/tcp/tls'i 0 bırakır.
    pub ttfb_ms: u64,
    /// Gövde indirme süresi (başlıklar→gövde tamam) (ms).
    pub download_ms: u64,
    /// Duvar saatiyle ağ toplamı (ms).
    pub total_ms: u64,
    pub http_version: String,
    pub remote_address: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CookieSummary {
    pub domain: String,
    pub path: String,
    pub key: String,
    pub value: String,
    pub expires: String,
}

fn normalize_version(v: &reqwest::Version) -> String {
    match *v {
        reqwest::Version::HTTP_09 => "0.9",
        reqwest::Version::HTTP_10 => "1.0",
        reqwest::Version::HTTP_11 => "1.1",
        reqwest::Version::HTTP_2 => "2.0",
        reqwest::Version::HTTP_3 => "3.0",
        _ => "1.1",
    }
    .to_string()
}

fn build_client(
    req: &HttpSendRequest,
    state: &State<'_, HttpState>,
) -> Result<reqwest::Client, String> {
    let mut builder = reqwest::Client::builder();

    if !req.verify_ssl {
        builder = builder.danger_accept_invalid_certs(true);
    }

    builder = if req.follow_redirects {
        builder.redirect(reqwest::redirect::Policy::limited(
            req.max_redirects.unwrap_or(10) as usize,
        ))
    } else {
        builder.redirect(reqwest::redirect::Policy::none())
    };

    if let Some(ms) = req.timeout_ms {
        builder = builder.timeout(std::time::Duration::from_millis(ms));
    }

    if let Some(proxy) = non_empty(req.proxy_url.clone()) {
        builder = builder.proxy(reqwest::Proxy::all(&proxy).map_err(|e| format!("proxy: {e}"))?);
    }

    if let Some(ca) = non_empty(req.ca_pem.clone()) {
        let cert = reqwest::Certificate::from_pem(ca.as_bytes())
            .map_err(|e| format!("özel CA PEM: {e}"))?;
        builder = builder.add_root_certificate(cert);
    }

    // İstemci sertifikası (mTLS): rustls tek PEM'de anahtar + sertifika bekler.
    if let (Some(cert), Some(key)) = (
        non_empty(req.client_cert_pem.clone()),
        non_empty(req.client_key_pem.clone()),
    ) {
        let combined = format!("{key}\n{cert}");
        let identity = reqwest::Identity::from_pem(combined.as_bytes())
            .map_err(|e| format!("istemci sertifikası: {e}"))?;
        builder = builder.identity(identity);
    }

    if req.cookie_jar {
        builder = builder.cookie_provider(state.cookie_store.clone());
    }

    // "http1" HTTP/1.1'e sabitler; "auto"/"http2" ALPN ile pazarlık eder (h2 açık).
    if req.http_version.as_deref() == Some("http1") {
        builder = builder.http1_only();
    }

    builder.build().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn http_send(
    state: State<'_, HttpState>,
    req: HttpSendRequest,
) -> Result<HttpSendResponse, String> {
    let client = build_client(&req, &state)?;

    let method = reqwest::Method::from_bytes(req.method.to_uppercase().as_bytes())
        .map_err(|e| format!("geçersiz HTTP metodu: {e}"))?;

    let mut headers = HeaderMap::new();
    for h in &req.headers {
        if h.key.is_empty() {
            continue;
        }
        let name = HeaderName::from_bytes(h.key.as_bytes())
            .map_err(|e| format!("geçersiz başlık adı '{}': {e}", h.key))?;
        let value = HeaderValue::from_str(&h.value)
            .map_err(|e| format!("geçersiz başlık değeri '{}': {e}", h.key))?;
        headers.append(name, value);
    }

    let mut request = client.request(method, &req.url).headers(headers);

    if let Some(b64) = &req.body_base64 {
        let bytes = BASE64
            .decode(b64)
            .map_err(|e| format!("gövde base64 çözülemedi: {e}"))?;
        request = request.body(bytes);
    }

    let started = Instant::now();
    let response = request.send().await.map_err(|e| e.to_string())?;
    let ttfb_ms = started.elapsed().as_millis() as u64;

    let http_version = normalize_version(&response.version());
    let remote_address = response.remote_addr().map(|addr| addr.to_string());
    let status = response.status();
    let status_text = status.canonical_reason().unwrap_or("").to_string();

    let response_headers: Vec<ResponseHeader> = response
        .headers()
        .iter()
        .map(|(k, v)| ResponseHeader {
            key: k.as_str().to_string(),
            value: v.to_str().unwrap_or_default().to_string(),
        })
        .collect();

    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    let total_ms = started.elapsed().as_millis() as u64;

    Ok(HttpSendResponse {
        status: status.as_u16(),
        status_text,
        headers: response_headers,
        body_base64: BASE64.encode(&bytes),
        size_bytes: bytes.len(),
        ttfb_ms,
        download_ms: total_ms.saturating_sub(ttfb_ms),
        total_ms,
        http_version,
        remote_address,
    })
}

#[tauri::command]
pub fn cookie_list(state: State<'_, HttpState>) -> Result<Vec<CookieSummary>, String> {
    let store = state.cookie_store.lock().map_err(|e| e.to_string())?;
    Ok(store
        .iter_any()
        .map(|cookie| CookieSummary {
            domain: cookie.domain().unwrap_or_default().to_string(),
            path: cookie.path().unwrap_or("/").to_string(),
            key: cookie.name().to_string(),
            value: cookie.value().to_string(),
            expires: cookie
                .expires()
                .and_then(|e| e.datetime())
                .map(|dt| dt.unix_timestamp().to_string())
                .unwrap_or_else(|| "Session".to_string()),
        })
        .collect())
}

#[tauri::command]
pub fn cookie_clear(state: State<'_, HttpState>) -> Result<(), String> {
    state
        .cookie_store
        .lock()
        .map_err(|e| e.to_string())?
        .clear();
    Ok(())
}
