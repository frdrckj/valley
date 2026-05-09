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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
