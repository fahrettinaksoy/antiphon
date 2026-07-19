// Çalışma alanı kayıt defteri — uygulama veri dizininde `workspaces.json` + yönetilen
// `workspaces/<id>` dizinleri. Her zaman en az bir yerel "My Workspace" garanti edilir.
// Meta + dizin yönetimi burada; uzak depolama (gist/webdav) secret'ları ve ağ I/O'su
// webview'da (registry-client) yürütülür.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

const DEFAULT_WORKSPACE_NAME: &str = "My Workspace";

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum Visibility {
    Personal,
    Internal,
    Public,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum WorkspaceStorage {
    Local,
    Gist { gist_id: Option<String> },
    Webdav { url: String, username: String },
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceMeta {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub visibility: Visibility,
    pub storage: WorkspaceStorage,
    pub local_path: String,
    pub is_default: bool,
    pub created_at: i64,
    pub last_opened_at: i64,
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct RegistryFile {
    active_id: Option<String>,
    workspaces: Vec<WorkspaceMeta>,
}

#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
// gist/webdav alanları henüz okunmuyor — storage backend fazında (secret vault sonrası)
// kullanılacak; şimdilik yalnız ayrıştırılıp reddediliyorlar.
#[allow(dead_code)]
pub enum CreateStorage {
    Local {
        #[serde(default)]
        source_folder: Option<String>,
    },
    Gist {
        token: String,
        #[serde(default)]
        gist_id: Option<String>,
    },
    Webdav {
        url: String,
        username: String,
        password: String,
    },
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateWorkspaceInput {
    name: String,
    #[serde(rename = "type")]
    visibility: Visibility,
    storage: CreateStorage,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceUpdateInput {
    #[serde(default)]
    name: Option<String>,
    #[serde(rename = "type", default)]
    visibility: Option<Visibility>,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("veri dizini bulunamadı: {e}"))
}

fn registry_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(data_dir(app)?.join("workspaces.json"))
}

fn workspaces_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(data_dir(app)?.join("workspaces"))
}

fn managed_path(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    Ok(workspaces_dir(app)?.join(id))
}

fn read_registry(app: &AppHandle) -> RegistryFile {
    let path = match registry_file_path(app) {
        Ok(p) => p,
        Err(_) => return RegistryFile::default(),
    };
    fs::read_to_string(&path)
        .ok()
        .and_then(|raw| serde_json::from_str::<RegistryFile>(&raw).ok())
        .unwrap_or_default()
}

fn write_registry(app: &AppHandle, reg: &RegistryFile) -> Result<(), String> {
    let dir = data_dir(app)?;
    fs::create_dir_all(&dir).map_err(|e| format!("veri dizini oluşturulamadı: {e}"))?;
    let json = serde_json::to_string_pretty(reg).map_err(|e| e.to_string())?;
    fs::write(registry_file_path(app)?, json).map_err(|e| format!("kayıt yazılamadı: {e}"))
}

// En az bir yerel çalışma alanı ("My Workspace") + geçerli bir activeId garanti eder.
fn ensure_default(app: &AppHandle) -> Result<RegistryFile, String> {
    let mut reg = read_registry(app);
    if reg.workspaces.is_empty() {
        let id = Uuid::new_v4().to_string();
        let local_path = managed_path(app, &id)?;
        fs::create_dir_all(&local_path).map_err(|e| format!("dizin oluşturulamadı: {e}"))?;
        let now = now_ms();
        reg.workspaces.push(WorkspaceMeta {
            id: id.clone(),
            name: DEFAULT_WORKSPACE_NAME.to_string(),
            visibility: Visibility::Personal,
            storage: WorkspaceStorage::Local,
            local_path: local_path.to_string_lossy().to_string(),
            is_default: true,
            created_at: now,
            last_opened_at: now,
        });
        reg.active_id = Some(id);
        write_registry(app, &reg)?;
    } else if reg
        .active_id
        .as_ref()
        .map(|a| !reg.workspaces.iter().any(|w| &w.id == a))
        .unwrap_or(true)
    {
        reg.active_id = Some(reg.workspaces[0].id.clone());
        write_registry(app, &reg)?;
    }
    Ok(reg)
}

#[tauri::command]
pub fn registry_list(app: AppHandle) -> Result<Vec<WorkspaceMeta>, String> {
    Ok(ensure_default(&app)?.workspaces)
}

#[tauri::command]
pub fn registry_active_id(app: AppHandle) -> Result<Option<String>, String> {
    Ok(ensure_default(&app)?.active_id)
}

#[tauri::command]
pub fn registry_get(app: AppHandle, id: String) -> Result<Option<WorkspaceMeta>, String> {
    Ok(ensure_default(&app)?
        .workspaces
        .into_iter()
        .find(|w| w.id == id))
}

// Yerel dizinin var olduğundan emin olur (dışarıdan silinmişse yeniden yaratır).
#[tauri::command]
pub fn registry_ensure_dir(local_path: String) -> Result<(), String> {
    fs::create_dir_all(&local_path).map_err(|e| format!("dizin oluşturulamadı '{local_path}': {e}"))
}

#[tauri::command]
pub fn registry_create(
    app: AppHandle,
    input: CreateWorkspaceInput,
) -> Result<WorkspaceMeta, String> {
    let mut reg = ensure_default(&app)?;
    let id = Uuid::new_v4().to_string();
    let now = now_ms();

    // Uzak depolamalarda yönetilen dizin oluşturulur; secret'lar (token/parola) ve ağ
    // I/O'su (snapshot pull/push) webview'da (registry-client) yapılır — burada yalnız
    // meta + dizin. Push sonrası oluşan gistId `registry_set_storage` ile güncellenir.
    let managed = || -> Result<String, String> {
        let path = managed_path(&app, &id)?;
        fs::create_dir_all(&path).map_err(|e| format!("dizin oluşturulamadı: {e}"))?;
        Ok(path.to_string_lossy().to_string())
    };

    let (local_path, storage) = match input.storage {
        CreateStorage::Local { source_folder } => {
            let path = if let Some(folder) = source_folder.filter(|f| !f.is_empty()) {
                folder
            } else {
                managed()?
            };
            (path, WorkspaceStorage::Local)
        }
        CreateStorage::Gist { gist_id, .. } => (managed()?, WorkspaceStorage::Gist { gist_id }),
        CreateStorage::Webdav { url, username, .. } => {
            (managed()?, WorkspaceStorage::Webdav { url, username })
        }
    };

    let meta = WorkspaceMeta {
        id: id.clone(),
        name: input.name,
        visibility: input.visibility,
        storage,
        local_path,
        is_default: false,
        created_at: now,
        last_opened_at: now,
    };
    reg.workspaces.push(meta.clone());
    reg.active_id = Some(id);
    write_registry(&app, &reg)?;
    Ok(meta)
}

#[tauri::command]
pub fn registry_delete(app: AppHandle, id: String) -> Result<Vec<WorkspaceMeta>, String> {
    let mut reg = ensure_default(&app)?;
    let Some(target) = reg.workspaces.iter().find(|w| w.id == id).cloned() else {
        return Ok(reg.workspaces);
    };
    if target.is_default {
        return Err("Varsayılan çalışma alanı silinemez".to_string());
    }

    // Yalnız uygulamanın yönettiği dizinleri sil; kullanıcının kendi klasörüne dokunma.
    let managed_root = workspaces_dir(&app)?.to_string_lossy().to_string();
    if target.local_path.starts_with(&managed_root) {
        let _ = fs::remove_dir_all(&target.local_path);
    }

    reg.workspaces.retain(|w| w.id != id);
    if reg.active_id.as_deref() == Some(id.as_str()) {
        reg.active_id = reg.workspaces.first().map(|w| w.id.clone());
    }
    write_registry(&app, &reg)?;
    Ok(reg.workspaces)
}

#[tauri::command]
pub fn registry_rename(app: AppHandle, id: String, name: String) -> Result<(), String> {
    let mut reg = ensure_default(&app)?;
    if let Some(target) = reg.workspaces.iter_mut().find(|w| w.id == id) {
        target.name = name;
        write_registry(&app, &reg)?;
    }
    Ok(())
}

#[tauri::command]
pub fn registry_update(
    app: AppHandle,
    id: String,
    patch: WorkspaceUpdateInput,
) -> Result<(), String> {
    let mut reg = ensure_default(&app)?;
    if let Some(target) = reg.workspaces.iter_mut().find(|w| w.id == id) {
        if let Some(name) = patch
            .name
            .map(|n| n.trim().to_string())
            .filter(|n| !n.is_empty())
        {
            target.name = name;
        }
        if let Some(visibility) = patch.visibility {
            target.visibility = visibility;
        }
        write_registry(&app, &reg)?;
    }
    Ok(())
}

// Depolama meta'sını günceller (ör. push sonrası oluşan gistId). Secret'lar webview'da.
#[tauri::command]
pub fn registry_set_storage(
    app: AppHandle,
    id: String,
    storage: WorkspaceStorage,
) -> Result<(), String> {
    let mut reg = ensure_default(&app)?;
    if let Some(target) = reg.workspaces.iter_mut().find(|w| w.id == id) {
        target.storage = storage;
        write_registry(&app, &reg)?;
    }
    Ok(())
}

#[tauri::command]
pub fn registry_set_active(app: AppHandle, id: String) -> Result<Option<WorkspaceMeta>, String> {
    let mut reg = ensure_default(&app)?;
    let Some(target) = reg.workspaces.iter_mut().find(|w| w.id == id) else {
        return Ok(None);
    };
    target.last_opened_at = now_ms();
    let meta = target.clone();
    reg.active_id = Some(id);
    write_registry(&app, &reg)?;
    // Açılışta ENOENT olmasın diye dizini garanti et.
    let _ = fs::create_dir_all(&meta.local_path);
    Ok(Some(meta))
}
