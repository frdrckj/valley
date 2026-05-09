#[tauri::command]
pub async fn fs_create_file(path: String) -> Result<(), String> {
    std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&path)
        .map(|_| ())
        .map_err(|e| format!("create_file {path}: {e}"))
}

#[tauri::command]
pub async fn fs_create_dir(path: String) -> Result<(), String> {
    std::fs::create_dir_all(&path).map_err(|e| format!("create_dir {path}: {e}"))
}

#[tauri::command]
pub async fn fs_rename(from: String, to: String) -> Result<(), String> {
    std::fs::rename(&from, &to).map_err(|e| format!("rename: {e}"))
}

#[tauri::command]
pub async fn fs_delete(path: String) -> Result<(), String> {
    let meta = std::fs::symlink_metadata(&path).map_err(|e| format!("stat: {e}"))?;
    if meta.is_dir() {
        std::fs::remove_dir_all(&path).map_err(|e| format!("rmdir: {e}"))
    } else {
        std::fs::remove_file(&path).map_err(|e| format!("rm: {e}"))
    }
}
