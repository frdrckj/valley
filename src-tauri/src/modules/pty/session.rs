use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Arc;
use std::thread;
use parking_lot::{Mutex, RwLock};
use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, PtySize};
use serde::Serialize;
use tauri::ipc::Channel;
use tauri::State;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum PtyEvent {
    /// stdout/stderr bytes, base64-encoded for transport safety.
    Output { bytes: String },
    /// child exited.
    Exit { code: Option<i32> },
}

pub struct Session {
    pub writer: Mutex<Box<dyn Write + Send>>,
    pub master: Arc<Mutex<Box<dyn portable_pty::MasterPty + Send>>>,
    pub child_killer: Mutex<Box<dyn ChildKiller + Send + Sync>>,
}

#[derive(Default)]
pub struct PtyState(pub RwLock<HashMap<String, Session>>);

#[tauri::command]
pub async fn pty_open(
    state: State<'_, PtyState>,
    id: String,
    shell: Option<String>,
    cwd: Option<String>,
    cols: u16,
    rows: u16,
    on_event: Channel<PtyEvent>,
) -> Result<(), String> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("openpty: {e}"))?;

    let resolved_shell = shell
        .or_else(|| std::env::var("SHELL").ok())
        .unwrap_or_else(|| "/bin/zsh".to_string());

    use crate::modules::pty::shell_init::{install_for, ShellKind};

    let init = install_for(&resolved_shell)?;
    let mut cmd = CommandBuilder::new(&resolved_shell);
    if let Some(cwd) = cwd {
        cmd.cwd(cwd);
    }

    // .app bundles launched from Finder inherit only launchd's tiny env —
    // no TERM, no COLORTERM. Without TERM, zsh's line editor can't read
    // terminfo, the cursor moves wrong, and `clear`/etc. fail with
    // "TERM environment variable not set". xterm.js targets xterm-256color
    // so that's our floor.
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    // Some tools key off this to detect that they're inside a "real" term.
    cmd.env("TERM_PROGRAM", "valley");
    if let Ok(home) = std::env::var("HOME") {
        cmd.env("HOME", home);
    }
    if let Ok(user) = std::env::var("USER") {
        cmd.env("USER", user);
    }
    if let Ok(lang) = std::env::var("LANG") {
        cmd.env("LANG", lang);
    } else {
        cmd.env("LANG", "en_US.UTF-8");
    }
    // PATH needs to be present even before login-shell init runs, otherwise
    // the shell's own startup (which calls `command` etc.) can fail. The
    // login shell will append the user's full PATH from /etc/paths + ~/.zprofile.
    if let Ok(path) = std::env::var("PATH") {
        cmd.env("PATH", path);
    } else {
        cmd.env("PATH", "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin");
    }

    // Pass -l only for POSIX shells that accept it (bash/zsh/sh).
    if matches!(init.shell_kind, ShellKind::Zsh | ShellKind::Bash) {
        cmd.arg("-l");
    }

    // Inject our init dir while preserving the user's original $ZDOTDIR / $BASH_ENV.
    match init.shell_kind {
        ShellKind::Zsh => {
            // If parent's ZDOTDIR is itself a stale `valley-init-*` temp
            // dir (e.g. from a previous dev-mode run that the parent
            // shell still inherits), trusting it would point us at our
            // own scripts and cause an infinite source loop. Fall back
            // to HOME in that case so we always layer over the user's
            // real config.
            let user_zdotdir = std::env::var("ZDOTDIR")
                .ok()
                .filter(|p| !p.contains("valley-init-"))
                .unwrap_or_else(|| std::env::var("HOME").unwrap_or_default());
            cmd.env("VALLEY_USER_ZDOTDIR", user_zdotdir);
            cmd.env("ZDOTDIR", init.dir.to_string_lossy().to_string());
        }
        ShellKind::Bash => {
            if let Ok(prev) = std::env::var("BASH_ENV") {
                cmd.env("VALLEY_USER_BASH_ENV", prev);
            }
            cmd.env("BASH_ENV", init.dir.join("valley.bashrc").to_string_lossy().to_string());
        }
        ShellKind::Other => {}
    }

    let mut child = pair.slave.spawn_command(cmd).map_err(|e| format!("spawn shell: {e}"))?;
    let writer = pair.master.take_writer().map_err(|e| format!("take_writer: {e}"))?;
    let mut reader = pair.master.try_clone_reader().map_err(|e| format!("clone_reader: {e}"))?;
    let child_killer = child.clone_killer();

    // Reader thread — stream output back to the webview.
    let event_for_reader = on_event.clone();
    thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let encoded = B64.encode(&buf[..n]);
                    if event_for_reader.send(PtyEvent::Output { bytes: encoded }).is_err() {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
    });

    // Watcher thread — wait for child exit + emit Exit.
    let event_for_exit = on_event.clone();
    thread::spawn(move || {
        let code = child.wait().ok().and_then(|s| s.exit_code().try_into().ok());
        let _ = event_for_exit.send(PtyEvent::Exit { code });
    });

    state.0.write().insert(
        id,
        Session {
            writer: Mutex::new(writer),
            master: Arc::new(Mutex::new(pair.master)),
            child_killer: Mutex::new(child_killer),
        },
    );

    Ok(())
}

#[tauri::command]
pub async fn pty_write(
    state: State<'_, PtyState>,
    id: String,
    data: String,
) -> Result<(), String> {
    let sessions = state.0.read();
    let session = sessions
        .get(&id)
        .ok_or_else(|| format!("pty session not found: {id}"))?;
    session
        .writer
        .lock()
        .write_all(data.as_bytes())
        .map_err(|e| format!("write: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn pty_resize(
    state: State<'_, PtyState>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let sessions = state.0.read();
    let session = sessions
        .get(&id)
        .ok_or_else(|| format!("pty session not found: {id}"))?;
    session
        .master
        .lock()
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("resize: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn pty_close(
    state: State<'_, PtyState>,
    id: String,
) -> Result<(), String> {
    let mut sessions = state.0.write();
    if let Some(session) = sessions.remove(&id) {
        // Kill the child and drop the Session — that closes our writer and master
        // references. The reader thread (spawned in pty_open) holds its own cloned
        // reader; it will exit on the next read after the master fd closes.
        let _ = session.child_killer.lock().kill();
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    /// Spawning a real shell and reading output is end-to-end. Keep the test
    /// short and tolerant — CI spawn latency varies.
    #[test]
    fn spawn_echo_and_close() {
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .unwrap();
        let mut cmd = CommandBuilder::new("/bin/sh");
        cmd.args(["-c", "echo hello && exit 0"]);
        let mut child = pair.slave.spawn_command(cmd).unwrap();
        let mut reader = pair.master.try_clone_reader().unwrap();

        let mut output = Vec::new();
        let mut buf = [0u8; 1024];
        // Read until child exits or we time out.
        let start = std::time::Instant::now();
        loop {
            if start.elapsed() > Duration::from_secs(3) {
                panic!("timed out waiting for output");
            }
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => output.extend_from_slice(&buf[..n]),
                Err(_) => break,
            }
            if child.try_wait().ok().flatten().is_some() {
                // drain whatever remains
                while let Ok(n) = reader.read(&mut buf) {
                    if n == 0 { break; }
                    output.extend_from_slice(&buf[..n]);
                }
                break;
            }
        }

        let s = String::from_utf8_lossy(&output);
        assert!(s.contains("hello"), "expected 'hello' in {s:?}");
    }
}
