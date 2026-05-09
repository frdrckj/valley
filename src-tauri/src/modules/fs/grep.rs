use grep_regex::RegexMatcher;
use grep_searcher::sinks::UTF8;
use grep_searcher::Searcher;
use ignore::WalkBuilder;
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GrepHit {
    pub path: String,
    pub line: u64,
    pub text: String,
}

#[tauri::command]
pub async fn fs_grep(root: String, pattern: String, max_hits: Option<usize>) -> Result<Vec<GrepHit>, String> {
    let matcher = RegexMatcher::new(&pattern).map_err(|e| format!("regex: {e}"))?;
    let cap = max_hits.unwrap_or(500);
    let mut hits: Vec<GrepHit> = Vec::new();

    let walker = WalkBuilder::new(&root).hidden(true).git_ignore(true).build();
    'outer: for ent in walker {
        let ent = match ent { Ok(e) => e, Err(_) => continue };
        if !ent.file_type().is_some_and(|t| t.is_file()) {
            continue;
        }
        let mut searcher = Searcher::new();
        let path = ent.path().to_string_lossy().into_owned();
        let _ = searcher.search_path(
            &matcher,
            ent.path(),
            UTF8(|line, text| {
                hits.push(GrepHit { path: path.clone(), line, text: text.trim_end().to_string() });
                if hits.len() >= cap {
                    return Ok(false);
                }
                Ok(true)
            }),
        );
        if hits.len() >= cap {
            break 'outer;
        }
    }
    Ok(hits)
}

#[tauri::command]
pub async fn fs_glob(root: String, glob: String) -> Result<Vec<String>, String> {
    let gs = globset::Glob::new(&glob).map_err(|e| format!("glob: {e}"))?.compile_matcher();
    let mut out: Vec<String> = Vec::new();
    let walker = WalkBuilder::new(&root).hidden(true).git_ignore(true).build();
    for ent in walker {
        let ent = match ent { Ok(e) => e, Err(_) => continue };
        let p = ent.path();
        if gs.is_match(p) {
            out.push(p.to_string_lossy().into_owned());
        }
    }
    Ok(out)
}
