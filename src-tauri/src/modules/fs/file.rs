use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileStat {
    pub size: u64,
    pub modified_ms: u64,
    pub is_dir: bool,
}

/// Maximum file size we'll load into the editor. Files larger than this get
/// the `toolarge` response so the UI can render a friendly message instead
/// of dumping a multi-megabyte buffer into CodeMirror.
const MAX_TEXT_BYTES: u64 = 4 * 1024 * 1024;

#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ReadResult {
    Text { content: String, size: u64 },
    Binary { size: u64 },
    Toolarge { size: u64, limit: u64 },
}

#[tauri::command]
pub async fn fs_read_file(path: String) -> Result<ReadResult, String> {
    let meta =
        std::fs::metadata(&path).map_err(|e| format!("read_file {path}: {e}"))?;
    let size = meta.len();
    if size > MAX_TEXT_BYTES {
        return Ok(ReadResult::Toolarge {
            size,
            limit: MAX_TEXT_BYTES,
        });
    }
    let bytes =
        std::fs::read(&path).map_err(|e| format!("read_file {path}: {e}"))?;
    if looks_binary(&bytes) {
        return Ok(ReadResult::Binary { size });
    }
    match String::from_utf8(bytes) {
        Ok(content) => Ok(ReadResult::Text { content, size }),
        Err(_) => Ok(ReadResult::Binary { size }),
    }
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

/// Heuristic: a NUL byte in the first 8 KB is the de-facto binary marker
/// (used by `git`, `grep -I`, and most editors). Cheap and accurate enough
/// to keep the editor from trying to render an executable.
fn looks_binary(bytes: &[u8]) -> bool {
    let head = &bytes[..bytes.len().min(8192)];
    head.contains(&0u8)
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
        match read {
            ReadResult::Text { content, .. } => assert_eq!(content, "hello"),
            _ => panic!("expected text"),
        }
    }

    #[tokio::test]
    async fn binary_detected() {
        let f = NamedTempFile::new().unwrap();
        let p = f.path().to_string_lossy().to_string();
        std::fs::write(&p, [0u8, 1, 2, 3]).unwrap();
        match fs_read_file(p).await.unwrap() {
            ReadResult::Binary { .. } => (),
            _ => panic!("expected binary"),
        }
    }
}
