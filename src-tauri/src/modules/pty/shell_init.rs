use std::fs;
use std::path::{Path, PathBuf};

/// Per-session temp dir we drop init scripts into. We point ZDOTDIR (zsh)
/// or BASH_ENV (bash) at this dir so our init runs *after* the user's
/// regular config — it layers OSC-emitting hooks on top, never replaces.
pub struct InitContext {
    pub dir: PathBuf,
    pub shell_kind: ShellKind,
}

pub enum ShellKind {
    Zsh,
    Bash,
    Other,
}

pub fn detect_shell(path: &str) -> ShellKind {
    let lower = path.to_ascii_lowercase();
    if lower.ends_with("/zsh") || lower.ends_with("zsh") {
        ShellKind::Zsh
    } else if lower.ends_with("/bash") || lower.ends_with("bash") {
        ShellKind::Bash
    } else {
        ShellKind::Other
    }
}

pub fn install_for(shell_path: &str) -> Result<InitContext, String> {
    let kind = detect_shell(shell_path);
    let dir = std::env::temp_dir().join(format!("valley-init-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&dir).map_err(|e| format!("create init dir: {e}"))?;

    match kind {
        ShellKind::Zsh => {
            write(&dir, ".zshenv", include_str!("scripts/zshenv.zsh"))?;
            write(&dir, ".zprofile", include_str!("scripts/zprofile.zsh"))?;
            write(&dir, ".zshrc", include_str!("scripts/zshrc.zsh"))?;
            write(&dir, ".zlogin", include_str!("scripts/zlogin.zsh"))?;
        }
        ShellKind::Bash => {
            write(&dir, "valley.bashrc", include_str!("scripts/bashrc.bash"))?;
        }
        ShellKind::Other => {}
    }
    Ok(InitContext { dir, shell_kind: kind })
}

fn write(dir: &Path, name: &str, body: &str) -> Result<(), String> {
    fs::write(dir.join(name), body).map_err(|e| format!("write {name}: {e}"))
}
