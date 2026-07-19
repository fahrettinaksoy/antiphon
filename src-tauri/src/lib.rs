// Antiphon - Tauri arka uç girişi.
//
// Rust komut yüzeyi: HTTP, workspace/fs + izleyici, çalışma alanı kayıt defteri, git,
// secret vault + ağ ayarları, realtime (WS/SSE/GraphQL-sub), script sandbox, mock server,
// MCP. Saf mantık (YAML/zod, şablon, script orkestrasyonu) webview'da.

mod appdata;
mod fs;
mod git;
mod http;
mod mcp;
mod mock;
mod paths;
mod realtime;
mod registry;
mod script;
mod vault;
mod watch;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)] // process yalnız masaüstünde ekleniyor (aşağıda).
    let mut builder = tauri::Builder::default()
        .manage(watch::WatchState::default())
        .manage(realtime::RealtimeState::default())
        .manage(mock::MockState::default())
        .manage(mcp::McpState::default())
        .manage(http::HttpState::default())
        .invoke_handler(tauri::generate_handler![
            http::http_send,
            http::cookie_list,
            http::cookie_clear,
            fs::fs_workspace_tree,
            fs::fs_read_text,
            fs::fs_read_base64,
            fs::fs_write_text,
            fs::fs_path_exists,
            fs::fs_list_dir_files,
            fs::fs_create_file,
            fs::fs_create_dir,
            fs::fs_delete_path,
            fs::fs_rename_path,
            fs::fs_folder_chain,
            fs::fs_snapshot,
            fs::fs_apply_snapshot,
            watch::fs_watch_workspace,
            watch::fs_stop_watching,
            registry::registry_list,
            registry::registry_active_id,
            registry::registry_get,
            registry::registry_ensure_dir,
            registry::registry_create,
            registry::registry_delete,
            registry::registry_rename,
            registry::registry_update,
            registry::registry_set_storage,
            registry::registry_set_active,
            git::git_is_repo,
            git::git_init,
            git::git_status,
            git::git_stage,
            git::git_unstage,
            git::git_stage_all,
            git::git_commit,
            git::git_log,
            git::git_diff,
            git::git_pull,
            git::git_push,
            vault::vault_set,
            vault::vault_get,
            vault::vault_list,
            vault::vault_delete,
            appdata::appdata_read,
            appdata::appdata_write,
            realtime::ws_connect,
            realtime::ws_send,
            realtime::ws_close,
            realtime::sse_connect,
            realtime::sse_close,
            realtime::graphql_subscribe,
            realtime::graphql_unsubscribe,
            script::script_pre_request,
            script::script_test,
            mock::mock_start,
            mock::mock_stop,
            mock::mock_status,
            mcp::mcp_connect,
            mcp::mcp_disconnect,
            mcp::mcp_list_tools,
            mcp::mcp_list_resources,
            mcp::mcp_list_prompts,
            mcp::mcp_call_tool,
            mcp::mcp_read_resource,
            mcp::mcp_get_prompt
        ])
        // Log: hem stdout'a (geliştirmede görünür) hem app log dizinindeki DÖNEN
        // dosyaya yazar. JS tarafı `@tauri-apps/plugin-log` ile aynı hedeflere yazar.
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .level_for("tao", log::LevelFilter::Warn)
                .level_for("wry", log::LevelFilter::Warn)
                .level_for("hyper", log::LevelFilter::Warn)
                .level_for("reqwest", log::LevelFilter::Warn)
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: None,
                    }),
                ])
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init());

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_process::init());
    }

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
