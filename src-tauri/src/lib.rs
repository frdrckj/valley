mod modules;

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

#[tauri::command]
async fn open_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("settings") {
        let _ = w.set_focus();
        return Ok(());
    }
    let builder = WebviewWindowBuilder::new(
        &app,
        "settings",
        WebviewUrl::App("settings.html".into()),
    )
    .title("Settings")
    .inner_size(720.0, 520.0)
    .min_inner_size(720.0, 520.0)
    .resizable(false);

    #[cfg(target_os = "macos")]
    let builder = builder
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .hidden_title(true);

    builder.build().map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_os::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(tauri_plugin_log::log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .manage(modules::pty::PtyState::default())
        .manage(modules::ssh::SshState::default())
        .invoke_handler(tauri::generate_handler![
            modules::pty::session::pty_open,
            modules::pty::session::pty_write,
            modules::pty::session::pty_resize,
            modules::pty::session::pty_close,
            modules::fs::tree::fs_read_dir,
            modules::fs::tree::list_subdirs,
            modules::fs::file::fs_read_file,
            modules::fs::file::fs_write_file,
            modules::fs::file::fs_stat,
            modules::fs::mutate::fs_create_file,
            modules::fs::mutate::fs_create_dir,
            modules::fs::mutate::fs_rename,
            modules::fs::mutate::fs_delete,
            modules::fs::grep::fs_grep,
            modules::fs::grep::fs_glob,
            modules::fs::search::fs_search,
            modules::secrets::secrets_get,
            modules::secrets::secrets_set,
            modules::secrets::secrets_delete,
            modules::shell::shell_run_command,
            modules::git::git_repo_root,
            modules::git::git_status,
            modules::git::git_diff,
            modules::ssh::ssh_list_dir,
            modules::ssh::ssh_disconnect,
            open_settings_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
