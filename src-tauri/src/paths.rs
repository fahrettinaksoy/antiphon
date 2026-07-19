// Ortak yol yardımcıları (Faz 6).

use std::path::PathBuf;
use tauri::{AppHandle, Manager};

// Uygulama veri dizini (yoksa oluşturur). registry ayrı bir kopya kullanıyor; yeni
// modüller (vault/appdata) burayı paylaşır.
pub fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("veri dizini bulunamadı: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("veri dizini oluşturulamadı: {e}"))?;
    Ok(dir)
}
