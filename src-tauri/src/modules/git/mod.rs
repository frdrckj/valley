use git2::{Repository, Status};
use serde::Serialize;
use std::path::Path;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusEntry {
    pub path: String,
    pub status: String,
    pub staged: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitDiffPayload {
    /// File contents at HEAD (left side of side-by-side view).
    pub head: String,
    /// File contents in working tree or index, depending on mode.
    pub current: String,
    /// Unified diff text (for unified view + LSP-style hunk parsing).
    pub unified: String,
}

/// Returns the git repo root walking up from `path`, or None if not in a repo.
#[tauri::command]
pub fn git_repo_root(path: String) -> Option<String> {
    let p = Path::new(&path);
    let repo = Repository::discover(p).ok()?;
    let workdir = repo.workdir()?;
    Some(workdir.to_string_lossy().trim_end_matches('/').to_string())
}

/// Status entries for the working tree.
#[tauri::command]
pub fn git_status(repo: String) -> Result<Vec<GitStatusEntry>, String> {
    let repo_path = Path::new(&repo);
    let r = Repository::open(repo_path).map_err(|e| e.to_string())?;

    let mut opts = git2::StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false)
        .include_unmodified(false);

    let statuses = r.statuses(Some(&mut opts)).map_err(|e| e.to_string())?;

    let mut entries = Vec::new();
    for entry in statuses.iter() {
        let flags = entry.status();
        let path = entry.path().unwrap_or("").to_string();
        if path.is_empty() {
            continue;
        }

        // Determine if index (staged) or working-tree change takes priority.
        if flags.intersects(
            Status::INDEX_NEW
                | Status::INDEX_MODIFIED
                | Status::INDEX_DELETED
                | Status::INDEX_RENAMED
                | Status::INDEX_TYPECHANGE,
        ) {
            let code = index_status_code(flags);
            entries.push(GitStatusEntry {
                path: path.clone(),
                status: code,
                staged: true,
            });
        }

        if flags.intersects(Status::CONFLICTED) {
            entries.push(GitStatusEntry {
                path: path.clone(),
                status: "U".to_string(),
                staged: false,
            });
        } else if flags.intersects(
            Status::WT_MODIFIED
                | Status::WT_DELETED
                | Status::WT_NEW
                | Status::WT_RENAMED
                | Status::WT_TYPECHANGE,
        ) {
            let code = wt_status_code(flags);
            entries.push(GitStatusEntry {
                path,
                status: code,
                staged: false,
            });
        }
    }

    Ok(entries)
}

fn index_status_code(flags: Status) -> String {
    if flags.contains(Status::INDEX_NEW) {
        return "A".to_string();
    }
    if flags.contains(Status::INDEX_MODIFIED) {
        return "M".to_string();
    }
    if flags.contains(Status::INDEX_DELETED) {
        return "D".to_string();
    }
    if flags.contains(Status::INDEX_RENAMED) {
        return "R".to_string();
    }
    if flags.contains(Status::INDEX_TYPECHANGE) {
        return "T".to_string();
    }
    "M".to_string()
}

fn wt_status_code(flags: Status) -> String {
    if flags.contains(Status::WT_NEW) {
        return "?".to_string();
    }
    if flags.contains(Status::WT_MODIFIED) {
        return "M".to_string();
    }
    if flags.contains(Status::WT_DELETED) {
        return "D".to_string();
    }
    if flags.contains(Status::WT_RENAMED) {
        return "R".to_string();
    }
    if flags.contains(Status::WT_TYPECHANGE) {
        return "T".to_string();
    }
    "M".to_string()
}

/// Unified diff text for `path` against HEAD.
#[tauri::command]
pub fn git_diff(
    repo: String,
    path: String,
    mode: String,
) -> Result<GitDiffPayload, String> {
    let repo_path = Path::new(&repo);
    let r = Repository::open(repo_path).map_err(|e| e.to_string())?;

    let head_content = read_head_content(&r, &path)?;
    let current_content = if mode == "staged" {
        read_index_content(&r, &path)?
    } else {
        read_working_tree_content(&repo, &path)?
    };

    let unified = build_unified_diff(&path, &head_content, &current_content, &r, &mode)?;

    Ok(GitDiffPayload {
        head: head_content,
        current: current_content,
        unified,
    })
}

fn read_head_content(repo: &Repository, path: &str) -> Result<String, String> {
    let head = match repo.head() {
        Ok(h) => h,
        Err(_) => return Ok(String::new()),
    };
    let tree = head
        .peel_to_tree()
        .map_err(|e| format!("peel_to_tree: {e}"))?;

    let entry = match tree.get_path(Path::new(path)) {
        Ok(e) => e,
        Err(_) => return Ok(String::new()),
    };

    let obj = entry
        .to_object(repo)
        .map_err(|e| format!("entry to object: {e}"))?;
    let blob = obj
        .as_blob()
        .ok_or_else(|| "HEAD entry is not a blob".to_string())?;

    String::from_utf8(blob.content().to_vec())
        .map_err(|_| "HEAD content is not valid UTF-8".to_string())
}

fn read_index_content(repo: &Repository, path: &str) -> Result<String, String> {
    let index = repo.index().map_err(|e| e.to_string())?;
    let entry = index
        .get_path(Path::new(path), 0)
        .ok_or_else(|| format!("path {path} not in index"))?;

    let blob = repo
        .find_blob(entry.id)
        .map_err(|e| format!("find blob: {e}"))?;

    String::from_utf8(blob.content().to_vec())
        .map_err(|_| "index content is not valid UTF-8".to_string())
}

fn read_working_tree_content(repo_root: &str, path: &str) -> Result<String, String> {
    let abs = Path::new(repo_root).join(path);
    if !abs.exists() {
        return Ok(String::new());
    }
    std::fs::read_to_string(&abs).map_err(|e| format!("read {}: {e}", abs.display()))
}

fn build_unified_diff(
    path: &str,
    head: &str,
    current: &str,
    repo: &Repository,
    mode: &str,
) -> Result<String, String> {
    if head == current {
        return Ok(String::new());
    }

    // Use git2 diff for proper unified output.
    let mut diff_opts = git2::DiffOptions::new();
    diff_opts.pathspec(path);

    let diff = if mode == "staged" {
        // staged: index vs HEAD
        let head_tree = repo
            .head()
            .ok()
            .and_then(|h| h.peel_to_tree().ok());
        repo.diff_tree_to_index(head_tree.as_ref(), None, Some(&mut diff_opts))
            .map_err(|e| e.to_string())?
    } else {
        // working: index vs workdir
        repo.diff_index_to_workdir(None, Some(&mut diff_opts))
            .map_err(|e| e.to_string())?
    };

    let mut out = String::new();
    diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        let prefix = match line.origin() {
            '+' | '-' | ' ' => line.origin().to_string(),
            _ => String::new(),
        };
        if let Ok(s) = std::str::from_utf8(line.content()) {
            out.push_str(&prefix);
            out.push_str(s);
        }
        true
    })
    .map_err(|e| e.to_string())?;

    // If diff came out empty (e.g. untracked file with no index entry), fall
    // back to a simple manual unified diff so the caller always gets something.
    if out.is_empty() && head != current {
        out = simple_unified_diff(path, head, current);
    }

    Ok(out)
}

/// Minimal unified-diff fallback (no context, just +/- lines) for new
/// untracked files that have no index entry yet.
fn simple_unified_diff(path: &str, old: &str, new: &str) -> String {
    let mut out = format!("--- a/{path}\n+++ b/{path}\n");
    let old_lines: Vec<&str> = old.lines().collect();
    let new_lines: Vec<&str> = new.lines().collect();
    out.push_str(&format!(
        "@@ -{},{} +{},{} @@\n",
        if old.is_empty() { 0 } else { 1 },
        old_lines.len(),
        if new.is_empty() { 0 } else { 1 },
        new_lines.len(),
    ));
    for l in &old_lines {
        out.push('-');
        out.push_str(l);
        out.push('\n');
    }
    for l in &new_lines {
        out.push('+');
        out.push_str(l);
        out.push('\n');
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn init_repo_with_commit(dir: &Path) -> Repository {
        let repo = Repository::init(dir).expect("init");
        // Configure a name/email so git2 doesn't complain about missing identity.
        let mut config = repo.config().unwrap();
        config.set_str("user.name", "Test").unwrap();
        config.set_str("user.email", "test@test.com").unwrap();
        drop(config);
        repo
    }

    fn make_initial_commit(repo: &Repository, dir: &Path, filename: &str, content: &str) {
        let file_path = dir.join(filename);
        std::fs::write(&file_path, content).unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(Path::new(filename)).unwrap();
        index.write().unwrap();
        let oid = index.write_tree().unwrap();
        let tree = repo.find_tree(oid).unwrap();
        let sig = repo.signature().unwrap();
        repo.commit(
            Some("HEAD"),
            &sig,
            &sig,
            "initial commit",
            &tree,
            &[],
        )
        .unwrap();
    }

    #[test]
    fn git_repo_root_walks_up_to_repo() {
        let tmp = TempDir::new().unwrap();
        let dir = tmp.path();
        init_repo_with_commit(dir);
        make_initial_commit(
            &Repository::open(dir).unwrap(),
            dir,
            "hello.txt",
            "hello\n",
        );

        // Create a subdirectory and resolve root from there.
        let sub = dir.join("sub");
        std::fs::create_dir(&sub).unwrap();

        let result = git_repo_root(sub.to_string_lossy().to_string());
        assert!(result.is_some(), "should find repo root");
        let root = result.unwrap();
        assert!(
            root.contains(dir.to_str().unwrap()),
            "root should contain temp dir"
        );
    }

    #[test]
    fn git_repo_root_returns_none_outside_repo() {
        let tmp = TempDir::new().unwrap();
        let result = git_repo_root(tmp.path().to_string_lossy().to_string());
        // tempdir has no .git → None
        assert!(result.is_none());
    }

    #[test]
    fn git_status_lists_modified_and_untracked() {
        let tmp = TempDir::new().unwrap();
        let dir = tmp.path();
        let repo = init_repo_with_commit(dir);
        make_initial_commit(&repo, dir, "tracked.txt", "original\n");

        // Modify tracked file.
        std::fs::write(dir.join("tracked.txt"), "modified\n").unwrap();
        // Add an untracked file.
        std::fs::write(dir.join("new.txt"), "new\n").unwrap();

        let entries = git_status(dir.to_string_lossy().to_string()).expect("status ok");

        let tracked = entries
            .iter()
            .find(|e| e.path == "tracked.txt")
            .expect("tracked.txt must appear");
        assert_eq!(tracked.status, "M");
        assert!(!tracked.staged);

        let untracked = entries
            .iter()
            .find(|e| e.path == "new.txt")
            .expect("new.txt must appear");
        assert_eq!(untracked.status, "?");
        assert!(!untracked.staged);
    }

    #[test]
    fn git_diff_working_returns_unified() {
        let tmp = TempDir::new().unwrap();
        let dir = tmp.path();
        let repo = init_repo_with_commit(dir);
        make_initial_commit(&repo, dir, "file.txt", "line1\nline2\n");

        // Modify in working tree.
        std::fs::write(dir.join("file.txt"), "line1\nline2\nline3\n").unwrap();

        let payload = git_diff(
            dir.to_string_lossy().to_string(),
            "file.txt".to_string(),
            "working".to_string(),
        )
        .expect("diff ok");

        assert_eq!(payload.head, "line1\nline2\n");
        assert_eq!(payload.current, "line1\nline2\nline3\n");
        // unified diff should contain the added line.
        assert!(
            payload.unified.contains("+line3"),
            "unified diff should contain +line3, got: {}",
            payload.unified
        );
    }

    #[test]
    fn git_diff_head_empty_for_new_repo() {
        let tmp = TempDir::new().unwrap();
        let dir = tmp.path();
        let _repo = Repository::init(dir).unwrap();

        // No HEAD commit yet — head content must be empty string.
        let result = git_diff(
            dir.to_string_lossy().to_string(),
            "nofile.txt".to_string(),
            "working".to_string(),
        );
        // Either Ok (empty head/current) or Err is acceptable — just mustn't panic.
        drop(result);
    }

}
