use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileStat {
    pub size: u64,
    pub modified_ms: u64,
    pub is_dir: bool,
}

#[tauri::command]
pub async fn fs_read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("read_file {path}: {e}"))
}

#[tauri::command]
pub async fn fs_write_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(&path, contents).map_err(|e| format!("write_file {path}: {e}"))
}

#[tauri::command]
pub async fn fs_stat(path: String) -> Result<FileStat, String> {
    let meta = std::fs::metadata(&path).map_err(|e| format!("stat {path}: {e}"))?;
    let modified_ms = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    Ok(FileStat {
        size: meta.len(),
        modified_ms,
        is_dir: meta.is_dir(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;

    #[tokio::test]
    async fn read_write_roundtrip() {
        let f = NamedTempFile::new().unwrap();
        let p = f.path().to_string_lossy().to_string();
        fs_write_file(p.clone(), "hello".into()).await.unwrap();
        let read = fs_read_file(p).await.unwrap();
        assert_eq!(read, "hello");
    }
}
