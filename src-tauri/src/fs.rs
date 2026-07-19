// Çalışma alanı dosya sistemi katmanı.
//
// İş bölümü: Rust yalnız DOSYA SİSTEMİ ayrıcalığını, slug/yol hesabını ve ağaç
// yürüyüşünü sahiplenir; YAML ayrıştırma/serileştirme ve zod DOĞRULAMASI webview'da
// (js-yaml + @schema) yapılır. Böylece Rust'ta bakımsız bir YAML crate'i gerekmez
// ve git diff'lerinde biçim (js-yaml) tek elden ve tutarlı kalır.

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use serde::Serialize;
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use uuid::Uuid;

const REQUEST_EXTENSION: &str = ".req.yaml";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceNode {
    pub id: String,
    #[serde(rename = "type")]
    pub node_type: String,
    pub name: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub method: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<WorkspaceNode>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatedNode {
    pub path: String,
    pub name: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenamedNode {
    pub path: String,
    pub is_request: bool,
}

// TS slugify ile davranış paritesi: küçült → izinli karakterleri (a-z0-9, TR harfleri,
// tire) tut, boşluk dizilerini tek tireye indir, diğerlerini at. Boşsa uuid'li ad üret.
fn slugify(name: &str) -> String {
    let lowered = name.trim().to_lowercase();
    let mut out = String::new();
    let mut prev_space = false;
    for ch in lowered.chars() {
        if ch.is_ascii_alphanumeric() || "ığüşöç".contains(ch) || ch == '-' {
            out.push(ch);
            prev_space = false;
        } else if ch.is_whitespace() && !prev_space {
            out.push('-');
            prev_space = true;
        }
    }
    if out.is_empty() {
        format!("request-{}", &Uuid::new_v4().to_string()[..8])
    } else {
        out
    }
}

fn base_name(path: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or_default()
        .to_string()
}

fn request_display_name(file_name: &str) -> String {
    file_name
        .strip_suffix(REQUEST_EXTENSION)
        .unwrap_or(file_name)
        .to_string()
}

// Ağaçta method rozetini göstermek için ad ve method'u dosyadan HAFİFÇE okur.
// Tam YAML ayrıştırması yerine üst-düzey (girintisiz) `name:`/`method:` satırlarını
// tarar — bu dosyalar makine üretimi ve alanlar üst düzey skalerdir.
fn peek_request(path: &Path, fallback: &str) -> (String, String) {
    let mut name = fallback.to_string();
    let mut method = "GET".to_string();
    if let Ok(content) = fs::read_to_string(path) {
        for line in content.lines() {
            // Yalnız girintisiz (üst-düzey) anahtarlar.
            if line.starts_with(char::is_whitespace) {
                continue;
            }
            if let Some(rest) = line.strip_prefix("name:") {
                let value = unquote(rest.trim());
                if !value.is_empty() {
                    name = value;
                }
            } else if let Some(rest) = line.strip_prefix("method:") {
                let value = unquote(rest.trim());
                if !value.is_empty() {
                    method = value;
                }
            }
        }
    }
    (name, method)
}

fn unquote(value: &str) -> String {
    let bytes = value.as_bytes();
    if value.len() >= 2
        && ((bytes[0] == b'"' && bytes[value.len() - 1] == b'"')
            || (bytes[0] == b'\'' && bytes[value.len() - 1] == b'\''))
    {
        value[1..value.len() - 1].to_string()
    } else {
        value.to_string()
    }
}

pub(crate) fn walk(current: &Path) -> Result<WorkspaceNode, String> {
    let mut entries: Vec<_> = fs::read_dir(current)
        .map_err(|e| format!("dizin okunamadı '{}': {e}", current.display()))?
        .filter_map(|e| e.ok())
        .collect();
    entries.sort_by_key(|e| e.file_name());

    let mut children: Vec<WorkspaceNode> = Vec::new();
    for entry in entries {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || name == "environments" {
            continue;
        }
        let entry_path = entry.path();
        let file_type = entry
            .file_type()
            .map_err(|e| format!("giriş türü okunamadı: {e}"))?;

        if file_type.is_dir() {
            children.push(walk(&entry_path)?);
        } else if name.ends_with(REQUEST_EXTENSION) {
            let (display, method) = peek_request(&entry_path, &request_display_name(&name));
            children.push(WorkspaceNode {
                id: entry_path.to_string_lossy().to_string(),
                node_type: "request".to_string(),
                name: display,
                path: entry_path.to_string_lossy().to_string(),
                method: Some(method),
                children: None,
            });
        }
    }

    Ok(WorkspaceNode {
        id: current.to_string_lossy().to_string(),
        node_type: "folder".to_string(),
        name: base_name(&current.to_string_lossy()),
        path: current.to_string_lossy().to_string(),
        method: None,
        children: Some(children),
    })
}

// Geçici dosyaya yazıp yeniden adlandırma: yarım yazılmış dosyanın Git/izleyici
// tarafından okunmasını önler (TS atomicWriteFile ile aynı).
fn atomic_write(path: &Path, content: &str) -> Result<(), String> {
    // Üst dizin yoksa oluştur (ör. `.antiphon/settings.json`).
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("üst dizin oluşturulamadı '{}': {e}", parent.display()))?;
    }
    let tmp = path.with_extension(format!("tmp-{}", Uuid::new_v4()));
    fs::write(&tmp, content).map_err(|e| format!("yazılamadı '{}': {e}", tmp.display()))?;
    fs::rename(&tmp, path).map_err(|e| format!("taşınamadı '{}': {e}", path.display()))?;
    Ok(())
}

#[tauri::command]
pub fn fs_workspace_tree(root: String) -> Result<WorkspaceNode, String> {
    walk(Path::new(&root))
}

#[tauri::command]
pub fn fs_read_text(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("okunamadı '{path}': {e}"))
}

// İkili dosyayı base64 olarak okur (binary istek gövdesi için).
#[tauri::command]
pub fn fs_read_base64(path: String) -> Result<String, String> {
    let bytes = fs::read(&path).map_err(|e| format!("okunamadı '{path}': {e}"))?;
    Ok(BASE64.encode(bytes))
}

// ---- Uzak depolama anlık görüntüsü (gist/webdav senkronu için) ----

fn is_ignored_segment(name: &str) -> bool {
    name.starts_with('.') || name == "node_modules" || name.contains(".tmp-")
}

fn collect_snapshot(
    root: &Path,
    current: &Path,
    out: &mut BTreeMap<String, String>,
) -> Result<(), String> {
    for entry in fs::read_dir(current).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        if is_ignored_segment(&name) {
            continue;
        }
        let full = entry.path();
        if full.is_dir() {
            collect_snapshot(root, &full, out)?;
        } else if let Ok(content) = fs::read_to_string(&full) {
            let rel = full
                .strip_prefix(root)
                .unwrap_or(&full)
                .to_string_lossy()
                .replace('\\', "/");
            out.insert(rel, content);
        }
    }
    Ok(())
}

// Çalışma alanının tüm (gizli olmayan) dosya ağacını tek JSON anlık görüntüye serileştirir.
#[tauri::command]
pub fn fs_snapshot(root: String) -> Result<Value, String> {
    let mut files = BTreeMap::new();
    collect_snapshot(Path::new(&root), Path::new(&root), &mut files)?;
    Ok(json!({ "schema": 1, "files": files }))
}

// Anlık görüntüyü yerele uygular: gizli olmayan girişler silinir, snapshot dosyaları yazılır.
// `.git`/`.antiphon` gibi nokta ile başlayanlara dokunulmaz; `..` içeren yollar atlanır.
#[tauri::command]
pub fn fs_apply_snapshot(root: String, snapshot: Value) -> Result<(), String> {
    let root_path = Path::new(&root);
    for entry in fs::read_dir(root_path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if entry.file_name().to_string_lossy().starts_with('.') {
            continue;
        }
        let path = entry.path();
        if path.is_dir() {
            let _ = fs::remove_dir_all(&path);
        } else {
            let _ = fs::remove_file(&path);
        }
    }

    if let Some(files) = snapshot.get("files").and_then(|f| f.as_object()) {
        for (rel, content) in files {
            if rel.split('/').any(|seg| seg == ".." || seg.is_empty()) {
                continue;
            }
            let dest = root_path.join(rel);
            if let Some(parent) = dest.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            fs::write(&dest, content.as_str().unwrap_or_default()).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn fs_write_text(path: String, content: String) -> Result<(), String> {
    atomic_write(Path::new(&path), &content)
}

#[tauri::command]
pub fn fs_path_exists(path: String) -> bool {
    Path::new(&path).exists()
}

// Verilen dizindeki, uzantıyla biten dosyaların tam yollarını döndürür (yoksa boş).
#[tauri::command]
pub fn fs_list_dir_files(dir: String, extension: String) -> Result<Vec<String>, String> {
    let dir_path = Path::new(&dir);
    if !dir_path.exists() {
        return Ok(Vec::new());
    }
    let mut paths: Vec<String> = fs::read_dir(dir_path)
        .map_err(|e| format!("dizin okunamadı '{dir}': {e}"))?
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().map(|t| t.is_file()).unwrap_or(false))
        .map(|e| e.path())
        .filter(|p| p.to_string_lossy().ends_with(&extension))
        .map(|p| p.to_string_lossy().to_string())
        .collect();
    paths.sort();
    Ok(paths)
}

// slug + benzersizleştirme ile dosya oluşturur (içerik webview'da üretilmiş metin).
// Çakışmada "Ad 2", "Ad 3"… olarak benzersizleştirir (TS createRequestFile paritesi).
#[tauri::command]
pub fn fs_create_file(
    dir: String,
    base_name: String,
    extension: String,
    content: String,
) -> Result<CreatedNode, String> {
    let dir_path = Path::new(&dir);
    fs::create_dir_all(dir_path).map_err(|e| format!("dizin oluşturulamadı '{dir}': {e}"))?;

    let slug = slugify(&base_name);
    let mut final_name = base_name.clone();
    let mut file_path: PathBuf = dir_path.join(format!("{slug}{extension}"));
    let mut counter = 2;
    while file_path.exists() {
        final_name = format!("{base_name} {counter}");
        file_path = dir_path.join(format!("{slug}-{counter}{extension}"));
        counter += 1;
    }

    atomic_write(&file_path, &content)?;
    Ok(CreatedNode {
        path: file_path.to_string_lossy().to_string(),
        name: final_name,
    })
}

#[tauri::command]
pub fn fs_create_dir(parent: String, name: String) -> Result<CreatedNode, String> {
    let folder_path = Path::new(&parent).join(slugify(&name));
    fs::create_dir_all(&folder_path)
        .map_err(|e| format!("klasör oluşturulamadı '{}': {e}", folder_path.display()))?;
    Ok(CreatedNode {
        path: folder_path.to_string_lossy().to_string(),
        name,
    })
}

#[tauri::command]
pub fn fs_delete_path(path: String) -> Result<(), String> {
    let target = Path::new(&path);
    if target.is_dir() {
        fs::remove_dir_all(target).map_err(|e| format!("silinemedi '{path}': {e}"))
    } else {
        // force: yoksa hata verme.
        match fs::remove_file(target) {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(format!("silinemedi '{path}': {e}")),
        }
    }
}

// İstek dosyasından köke doğru klasör zincirini (kök → yaprak sırasıyla) döndürür.
// Miras (inheritance) çözümü için: en yakın klasör en son uygulanır. Yol aritmetiği
// platforma duyarlı olduğundan Rust'ta yapılır; folder.meta okuma/birleştirme webview'da.
#[tauri::command]
pub fn fs_folder_chain(request_path: String, root: String) -> Vec<String> {
    let root_path = Path::new(&root);
    let leaf = Path::new(&request_path)
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| root_path.to_path_buf());

    match leaf.strip_prefix(root_path) {
        Ok(rel) => {
            let mut folders = vec![root_path.to_string_lossy().to_string()];
            let mut current = root_path.to_path_buf();
            for segment in rel.components() {
                current = current.join(segment);
                folders.push(current.to_string_lossy().to_string());
            }
            folders
        }
        // Yaprak kökün dışındaysa yalnızca kök.
        Err(_) => vec![root_path.to_string_lossy().to_string()],
    }
}

// Yolu yeniden adlandırır (slug ile). Request ise .req.yaml uzantısı korunur; iç
// `name` alanının güncellenmesi webview'da (YAML) yapılır.
#[tauri::command]
pub fn fs_rename_path(path: String, new_name: String) -> Result<RenamedNode, String> {
    let is_request = path.ends_with(REQUEST_EXTENSION);
    let parent = Path::new(&path)
        .parent()
        .ok_or_else(|| format!("üst dizin yok: '{path}'"))?;
    let slug = slugify(&new_name);
    let new_path = if is_request {
        parent.join(format!("{slug}{REQUEST_EXTENSION}"))
    } else {
        parent.join(slug)
    };
    fs::rename(&path, &new_path).map_err(|e| format!("yeniden adlandırılamadı '{path}': {e}"))?;
    Ok(RenamedNode {
        path: new_path.to_string_lossy().to_string(),
        is_request,
    })
}
