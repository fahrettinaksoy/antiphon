// Git katmanı — git2 (libgit2).
// isRepo/init/status/stage/unstage/stageAll/commit/log/diff/pull(FF)/push.

use git2::{
    build::CheckoutBuilder, Cred, FetchOptions, IndexAddOption, PushOptions, RemoteCallbacks,
    Repository, Signature,
};
use serde::{Deserialize, Serialize};
use similar::TextDiff;
use std::path::Path;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitFileStatus {
    pub path: String,
    pub status: String,
    pub staged: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusSummary {
    pub branch: Option<String>,
    pub files: Vec<GitFileStatus>,
    pub ahead: u32,
    pub behind: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitSummary {
    pub oid: String,
    pub message: String,
    pub author: String,
    pub timestamp: i64,
}

#[derive(Deserialize)]
pub struct GitCredentials {
    pub username: String,
    pub password: String,
}

fn open(dir: &str) -> Result<Repository, String> {
    Repository::open(dir).map_err(|e| format!("depo açılamadı '{dir}': {e}"))
}

// Dal adı (taze/doğmamış depoda bile HEAD sembolik hedefinden).
fn branch_name(repo: &Repository) -> Option<String> {
    if let Ok(head) = repo.head() {
        return head.shorthand().map(|s| s.to_string());
    }
    repo.find_reference("HEAD").ok().and_then(|r| {
        r.symbolic_target()
            .map(|t| t.trim_start_matches("refs/heads/").to_string())
    })
}

fn current_branch(repo: &Repository) -> Result<String, String> {
    branch_name(repo).ok_or_else(|| "geçerli dal belirlenemedi".to_string())
}

fn credential_callbacks(credentials: Option<GitCredentials>) -> RemoteCallbacks<'static> {
    let mut cbs = RemoteCallbacks::new();
    if let Some(creds) = credentials {
        cbs.credentials(move |_url, _username, _allowed| {
            Cred::userpass_plaintext(&creds.username, &creds.password)
        });
    }
    cbs
}

#[tauri::command]
pub fn git_is_repo(dir: String) -> bool {
    // HEAD ilk commit'ten önce çözülemediğinden taze depo `.git` varlığıyla saptanır.
    Path::new(&dir).join(".git").exists()
}

#[tauri::command]
pub fn git_init(dir: String) -> Result<(), String> {
    Repository::init(&dir).map_err(|e| format!("init başarısız '{dir}': {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn git_status(dir: String) -> Result<GitStatusSummary, String> {
    let repo = open(&dir)?;
    let mut options = git2::StatusOptions::new();
    options
        .include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false);
    let statuses = repo
        .statuses(Some(&mut options))
        .map_err(|e| format!("durum okunamadı: {e}"))?;

    let mut files = Vec::new();
    for entry in statuses.iter() {
        let s = entry.status();
        let path = entry.path().unwrap_or_default().to_string();
        if path.is_empty() {
            continue;
        }
        let staged = s.intersects(
            git2::Status::INDEX_NEW
                | git2::Status::INDEX_MODIFIED
                | git2::Status::INDEX_DELETED
                | git2::Status::INDEX_RENAMED
                | git2::Status::INDEX_TYPECHANGE,
        );
        let status = if s.contains(git2::Status::WT_NEW) && !staged {
            "untracked"
        } else if s.contains(git2::Status::INDEX_NEW) {
            "added"
        } else if s.intersects(git2::Status::WT_DELETED | git2::Status::INDEX_DELETED) {
            "deleted"
        } else if s.intersects(
            git2::Status::WT_MODIFIED
                | git2::Status::INDEX_MODIFIED
                | git2::Status::WT_RENAMED
                | git2::Status::INDEX_RENAMED
                | git2::Status::WT_TYPECHANGE
                | git2::Status::INDEX_TYPECHANGE,
        ) {
            "modified"
        } else {
            continue;
        };
        files.push(GitFileStatus {
            path,
            status: status.to_string(),
            staged,
        });
    }

    Ok(GitStatusSummary {
        branch: branch_name(&repo),
        files,
        ahead: 0,
        behind: 0,
    })
}

#[tauri::command]
pub fn git_stage(dir: String, filepath: String) -> Result<(), String> {
    let repo = open(&dir)?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    let path = Path::new(&filepath);
    // Silinmiş dosyalar için add_path başarısız olur → remove_path.
    if Path::new(&dir).join(&filepath).exists() {
        index
            .add_path(path)
            .map_err(|e| format!("eklenemedi: {e}"))?;
    } else {
        index
            .remove_path(path)
            .map_err(|e| format!("kaldırılamadı: {e}"))?;
    }
    index.write().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_unstage(dir: String, filepath: String) -> Result<(), String> {
    let repo = open(&dir)?;
    let path = Path::new(&filepath);
    // Erken return: `as_object()` geçici değeri return anında düşer; match'i kuyruk
    // pozisyonunda tutsaydık ödünç, `commit`'ten sonra düşüp E0597 verirdi.
    if let Ok(head) = repo.head() {
        let commit = head.peel_to_commit().map_err(|e| e.to_string())?;
        let object = commit.as_object();
        return repo
            .reset_default(Some(object), [path])
            .map_err(|e| format!("stage geri alınamadı: {e}"));
    }
    // HEAD yok (henüz commit yok): index'ten çıkar.
    let mut index = repo.index().map_err(|e| e.to_string())?;
    let _ = index.remove_path(path);
    index.write().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_stage_all(dir: String) -> Result<(), String> {
    let repo = open(&dir)?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    // add_all: yeni/değişmiş; update_all: izlenen dosyaların silinmesi de sahnelenir.
    index
        .add_all(["*"].iter(), IndexAddOption::DEFAULT, None)
        .map_err(|e| e.to_string())?;
    index
        .update_all(["*"].iter(), None)
        .map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_commit(
    dir: String,
    message: String,
    author_name: String,
    author_email: String,
) -> Result<String, String> {
    let repo = open(&dir)?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    let tree_oid = index.write_tree().map_err(|e| e.to_string())?;
    let tree = repo.find_tree(tree_oid).map_err(|e| e.to_string())?;
    let sig = Signature::now(&author_name, &author_email).map_err(|e| e.to_string())?;

    let parents = match repo.head() {
        Ok(head) => vec![head.peel_to_commit().map_err(|e| e.to_string())?],
        Err(_) => vec![],
    };
    let parent_refs: Vec<&git2::Commit> = parents.iter().collect();

    let oid = repo
        .commit(Some("HEAD"), &sig, &sig, &message, &tree, &parent_refs)
        .map_err(|e| format!("commit başarısız: {e}"))?;
    Ok(oid.to_string())
}

#[tauri::command]
pub fn git_log(dir: String, depth: Option<u32>) -> Result<Vec<GitCommitSummary>, String> {
    let repo = open(&dir)?;
    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    // Taze depo (commit yok): HEAD yürünemez → boş geçmiş normaldir.
    if revwalk.push_head().is_err() {
        return Ok(Vec::new());
    }
    revwalk
        .set_sorting(git2::Sort::TIME)
        .map_err(|e| e.to_string())?;

    let limit = depth.unwrap_or(30) as usize;
    let mut commits = Vec::new();
    for oid in revwalk.take(limit) {
        let oid = oid.map_err(|e| e.to_string())?;
        let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;
        commits.push(GitCommitSummary {
            oid: oid.to_string(),
            message: commit.message().unwrap_or_default().to_string(),
            author: commit.author().name().unwrap_or_default().to_string(),
            timestamp: commit.time().seconds() * 1000,
        });
    }
    Ok(commits)
}

#[tauri::command]
pub fn git_diff(dir: String, filepath: String) -> Result<String, String> {
    let repo = open(&dir)?;

    // HEAD'deki blob içeriği (yoksa boş).
    let old_content = (|| -> Option<String> {
        let head = repo.head().ok()?;
        let tree = head.peel_to_tree().ok()?;
        let entry = tree.get_path(Path::new(&filepath)).ok()?;
        let blob = repo.find_blob(entry.id()).ok()?;
        Some(String::from_utf8_lossy(blob.content()).to_string())
    })()
    .unwrap_or_default();

    // Çalışma dizinindeki güncel içerik (yoksa boş).
    let new_content = std::fs::read_to_string(Path::new(&dir).join(&filepath)).unwrap_or_default();

    let text_diff = TextDiff::from_lines(&old_content, &new_content);
    Ok(text_diff
        .unified_diff()
        .context_radius(3)
        .header("HEAD", "çalışma dizini")
        .to_string())
}

#[tauri::command]
pub fn git_pull(
    dir: String,
    _author_name: String,
    _author_email: String,
    credentials: Option<GitCredentials>,
) -> Result<(), String> {
    let repo = open(&dir)?;
    let branch = current_branch(&repo)?;

    let mut remote = repo
        .find_remote("origin")
        .map_err(|e| format!("'origin' uzak deposu yok: {e}"))?;

    let mut fetch_options = FetchOptions::new();
    fetch_options.remote_callbacks(credential_callbacks(credentials));
    remote
        .fetch(&[&branch], Some(&mut fetch_options), None)
        .map_err(|e| format!("fetch başarısız: {e}"))?;

    let fetch_head = repo
        .find_reference("FETCH_HEAD")
        .map_err(|e| e.to_string())?;
    let fetch_commit = repo
        .reference_to_annotated_commit(&fetch_head)
        .map_err(|e| e.to_string())?;
    let (analysis, _) = repo
        .merge_analysis(&[&fetch_commit])
        .map_err(|e| e.to_string())?;

    if analysis.is_up_to_date() {
        return Ok(());
    }
    if analysis.is_fast_forward() {
        let refname = format!("refs/heads/{branch}");
        let mut reference = repo.find_reference(&refname).map_err(|e| e.to_string())?;
        reference
            .set_target(fetch_commit.id(), "pull: fast-forward")
            .map_err(|e| e.to_string())?;
        repo.set_head(&refname).map_err(|e| e.to_string())?;
        repo.checkout_head(Some(CheckoutBuilder::default().force()))
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    Err("Hızlı-ileri (fast-forward) olmayan birleştirme desteklenmiyor — elle çözün.".to_string())
}

#[tauri::command]
pub fn git_push(dir: String, credentials: Option<GitCredentials>) -> Result<(), String> {
    let repo = open(&dir)?;
    let branch = current_branch(&repo)?;
    let mut remote = repo
        .find_remote("origin")
        .map_err(|e| format!("'origin' uzak deposu yok: {e}"))?;

    let mut push_options = PushOptions::new();
    push_options.remote_callbacks(credential_callbacks(credentials));
    let refspec = format!("refs/heads/{branch}:refs/heads/{branch}");
    remote
        .push(&[&refspec], Some(&mut push_options))
        .map_err(|e| format!("push başarısız: {e}"))
}
