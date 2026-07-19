// Çalışma alanı dosya izleyici — aktif çalışma alanı kökünü
// `notify` ile özyinelemeli izler, olayları 150 ms debounce eder, ağacı yeniden kurup
// `workspace-changed` olayıyla webview'a gönderir. Böylece dış değişiklikler (git pull,
// elle düzenleme) UI'da otomatik yansır.

use crate::fs::walk;
use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use std::path::Path;
use std::sync::mpsc::{channel, RecvTimeoutError};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};

#[derive(Default)]
pub struct WatchState {
    // Aktif izleyici burada tutulur; yenisi kurulunca eskisi düşürülerek (drop) durdurulur.
    watcher: Mutex<Option<RecommendedWatcher>>,
}

// Bir yol, kök altında nokta ile başlayan bir segment içeriyor mu (.git, .tmp… gibi)?
// Bu tür yollar ağaçtan zaten dışlandığı için izleme gürültüsü de filtrelenir.
fn is_hidden_path(path: &Path) -> bool {
    path.components().any(|c| {
        c.as_os_str()
            .to_str()
            .map(|s| s.starts_with('.'))
            .unwrap_or(false)
    })
}

#[tauri::command]
pub fn fs_watch_workspace(
    app: AppHandle,
    state: State<'_, WatchState>,
    root: String,
) -> Result<(), String> {
    let (tx, rx) = channel::<()>();

    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        if let Ok(event) = res {
            // Yalnız gizli-olmayan yolları ilet (dotfile/.git gürültüsünü ele).
            if event.paths.iter().all(|p| is_hidden_path(p)) {
                return;
            }
            let _ = tx.send(());
        }
    })
    .map_err(|e| format!("izleyici kurulamadı: {e}"))?;

    watcher
        .watch(Path::new(&root), RecursiveMode::Recursive)
        .map_err(|e| format!("izlenemedi '{root}': {e}"))?;

    // Debounce + yeniden kurma döngüsü: ilk olayda bekle, 150 ms sessizlik olana dek
    // olayları yut, sonra ağacı kurup gönder. Kanal kapanınca (yeni izleyici kurulunca
    // tx düşer) döngü sonlanır.
    let app_handle = app.clone();
    std::thread::spawn(move || loop {
        if rx.recv().is_err() {
            break;
        }
        loop {
            match rx.recv_timeout(Duration::from_millis(150)) {
                Ok(()) => continue,
                Err(RecvTimeoutError::Timeout) => break,
                Err(RecvTimeoutError::Disconnected) => return,
            }
        }
        if let Ok(tree) = walk(Path::new(&root)) {
            let _ = app_handle.emit("workspace-changed", &tree);
        }
    });

    // Yeni izleyiciyi sakla (eskisi düşer → durur → thread'i sonlanır).
    *state.watcher.lock().map_err(|e| e.to_string())? = Some(watcher);
    Ok(())
}

#[tauri::command]
pub fn fs_stop_watching(state: State<'_, WatchState>) -> Result<(), String> {
    *state.watcher.lock().map_err(|e| e.to_string())? = None;
    Ok(())
}
