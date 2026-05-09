mod modules;

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
        .invoke_handler(tauri::generate_handler![
            modules::pty::session::pty_open,
            modules::pty::session::pty_write,
            modules::pty::session::pty_resize,
            modules::pty::session::pty_close,
            modules::fs::tree::fs_read_dir,
            modules::fs::tree::list_subdirs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
