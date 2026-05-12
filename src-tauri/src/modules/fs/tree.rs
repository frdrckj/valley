use serde::Serialize;
use std::path::PathBuf;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_symlink: bool,
}

#[tauri::command]
pub async fn fs_read_dir(path: String) -> Result<Vec<DirEntry>, String> {
    // Engagement-stored paths use a literal `~` so the user can move
    // their store between hosts; expand here so the rest of the
    // pipeline sees an absolute path.
    let path = super::mutate::expand_tilde(&path);
    let mut entries: Vec<DirEntry> = Vec::new();
    let read = std::fs::read_dir(&path).map_err(|e| format!("read_dir {path}: {e}"))?;
    for ent in read {
        let ent = match ent { Ok(e) => e, Err(_) => continue };
        let p = ent.path();
        let meta = match std::fs::symlink_metadata(&p) {
            Ok(m) => m,
            Err(_) => continue,
        };
        entries.push(DirEntry {
            name: ent.file_name().to_string_lossy().into_owned(),
            path: p.to_string_lossy().into_owned(),
            is_dir: meta.is_dir(),
            is_symlink: meta.file_type().is_symlink(),
        });
    }
    // Folders first, then files, both alphabetical.
    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });
    Ok(entries)
}

#[tauri::command]
pub async fn list_subdirs(path: String) -> Result<Vec<DirEntry>, String> {
    let all = fs_read_dir(path).await?;
    Ok(all.into_iter().filter(|e| e.is_dir).collect())
}

#[allow(dead_code)]
fn _strict_path_check(p: PathBuf) {
    drop(p);
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn read_dir_lists_entries_folders_first() {
        let tmp = TempDir::new().unwrap();
        std::fs::write(tmp.path().join("z.txt"), "").unwrap();
        std::fs::create_dir(tmp.path().join("alpha")).unwrap();
        let r = fs_read_dir(tmp.path().to_string_lossy().to_string()).await.unwrap();
        assert_eq!(r.len(), 2);
        assert!(r[0].is_dir);
        assert_eq!(r[0].name, "alpha");
        assert_eq!(r[1].name, "z.txt");
    }
}
