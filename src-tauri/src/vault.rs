// Secret vault — değerler OS anahtar zincirinde (`keyring`):
// macOS Keychain, Windows Credential Manager, Linux Secret Service — ŞİFRELİ
// saklanır. Anahtar zinciri enumerate edilemediğinden anahtar isimleri uygulama veri dizininde
// bir index dosyasında tutulur (yalnız isimler; değerler değil). Servis adı sabittir.

use crate::paths::app_data_dir;
use keyring::{Entry, Error as KeyringError};
use std::collections::BTreeSet;
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

const SERVICE: &str = "antiphon";

fn index_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join("secrets.index.json"))
}

fn read_index(app: &AppHandle) -> BTreeSet<String> {
    index_path(app)
        .ok()
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|raw| serde_json::from_str::<BTreeSet<String>>(&raw).ok())
        .unwrap_or_default()
}

fn write_index(app: &AppHandle, index: &BTreeSet<String>) -> Result<(), String> {
    let json = serde_json::to_string_pretty(index).map_err(|e| e.to_string())?;
    fs::write(index_path(app)?, json).map_err(|e| format!("secret index yazılamadı: {e}"))
}

fn entry(key: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, key).map_err(|e| format!("anahtar zinciri girişi: {e}"))
}

#[tauri::command]
pub fn vault_set(app: AppHandle, key: String, value: String) -> Result<(), String> {
    entry(&key)?
        .set_password(&value)
        .map_err(|e| format!("secret yazılamadı: {e}"))?;
    let mut index = read_index(&app);
    index.insert(key);
    write_index(&app, &index)
}

#[tauri::command]
pub fn vault_get(key: String) -> Result<Option<String>, String> {
    match entry(&key)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(e) => Err(format!("secret okunamadı: {e}")),
    }
}

#[tauri::command]
pub fn vault_list(app: AppHandle) -> Result<Vec<String>, String> {
    Ok(read_index(&app).into_iter().collect())
}

#[tauri::command]
pub fn vault_delete(app: AppHandle, key: String) -> Result<(), String> {
    // Anahtar zincirinden sil (yoksa sorun değil), sonra index'ten çıkar.
    match entry(&key)?.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => {}
        Err(e) => return Err(format!("secret silinemedi: {e}")),
    }
    let mut index = read_index(&app);
    index.remove(&key);
    write_index(&app, &index)
}
