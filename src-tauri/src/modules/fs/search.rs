use ignore::WalkBuilder;

#[tauri::command]
pub async fn fs_search(root: String, query: String, max_hits: Option<usize>) -> Result<Vec<String>, String> {
    let needle = query.to_lowercase();
    let cap = max_hits.unwrap_or(200);
    let mut out: Vec<String> = Vec::new();
    let walker = WalkBuilder::new(&root).hidden(true).git_ignore(true).build();
    for ent in walker {
        let ent = match ent { Ok(e) => e, Err(_) => continue };
        if let Some(name) = ent.file_name().to_str() {
            if name.to_lowercase().contains(&needle) {
                out.push(ent.path().to_string_lossy().into_owned());
                if out.len() >= cap { break; }
            }
        }
    }
    Ok(out)
}
