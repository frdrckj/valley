/// Expand a leading `~` or `~/` to the current user's home directory.
/// We only handle the literal-tilde case; the shell already expands
/// real arguments before they reach a command. Engagement forms collect
/// raw text from the user, so the renderer never sees the expanded form.
fn expand_tilde(path: &str) -> String {
    if path == "~" {
        return home::home_dir()
            .map(|p| p.to_string_lossy().into_owned())
            .unwrap_or_else(|| path.to_string());
    }
    if let Some(rest) = path.strip_prefix("~/") {
        if let Some(home) = home::home_dir() {
            return home.join(rest).to_string_lossy().into_owned();
        }
    }
    path.to_string()
}

#[tauri::command]
pub async fn fs_create_file(path: String) -> Result<(), String> {
    let path = expand_tilde(&path);
    std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&path)
        .map(|_| ())
        .map_err(|e| format!("create_file {path}: {e}"))
}

#[tauri::command]
pub async fn fs_create_dir(path: String) -> Result<(), String> {
    let path = expand_tilde(&path);
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
