// Uygulama veri dizininde adlı JSON dosyaları (Faz 6).
//
// network-settings.json gibi genel ayar dosyaları için. Varsayılan birleştirme ve tip
// doğrulaması webview'da (settings-client) yapılır; Rust yalnız güvenli okuma/yazma sağlar.

use crate::paths::app_data_dir;
use std::fs;
use tauri::AppHandle;

// Yalnız düz dosya adı — yol gezme (path traversal) engellenir.
fn safe_name(name: &str) -> Result<&str, String> {
    if name.is_empty() || name.contains('/') || name.contains('\\') || name.contains("..") {
        return Err(format!("geçersiz dosya adı: '{name}'"));
    }
    Ok(name)
}

#[tauri::command]
pub fn appdata_read(app: AppHandle, name: String) -> Result<Option<String>, String> {
    let name = safe_name(&name)?;
    let path = app_data_dir(&app)?.join(name);
    if !path.exists() {
        return Ok(None);
    }
    fs::read_to_string(&path)
        .map(Some)
        .map_err(|e| format!("okunamadı '{name}': {e}"))
}

#[tauri::command]
pub fn appdata_write(app: AppHandle, name: String, content: String) -> Result<(), String> {
    let name = safe_name(&name)?;
    let path = app_data_dir(&app)?.join(name);
    fs::write(&path, content).map_err(|e| format!("yazılamadı '{name}': {e}"))
}
