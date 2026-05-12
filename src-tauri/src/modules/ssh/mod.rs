//! SSH/SFTP backend for the remote sidebar + remote engagements.
//!
//! Commands: `ssh_list_dir` (sidebar), `ssh_create_dir` (engagement
//! workspace mkdir on the remote), `ssh_disconnect`. Authentication
//! uses the local SSH agent (`SSH_AUTH_SOCK`); we do not prompt for
//! passwords or decrypt passphrase-protected keyfiles. If the user's
//! `ssh hostname` works without a prompt in their shell, our
//! connection works.
//!
//! ssh config (`~/.ssh/config`) HostName/User/Port aliases are resolved
//! by a small parser in `config.rs` so users can type `ssh prod` and
//! the sidebar picks the same target.

use std::collections::HashMap;
use std::sync::Arc;

use parking_lot::Mutex;
use russh::client::{self, Handle};
use russh::keys::ssh_key::PublicKey;
use russh_sftp::client::SftpSession;
use russh_sftp::protocol::FileType;
use serde::Serialize;
use tokio::net::UnixStream;

mod config;

const CONNECT_TIMEOUT_SECS: u64 = 10;
/// Per-operation deadline. Without this, a half-dead TCP connection
/// (remote crashed, laptop just woke up, NAT reset, etc.) makes the
/// sidebar hang for tens of seconds while russh waits on byte reads.
const OPERATION_TIMEOUT_SECS: u64 = 8;

/// Returned to the TS side from `ssh_list_dir`. Same shape as the
/// local fs DirEntry so the sidebar can render either source.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SshDirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_symlink: bool,
}

/// Connection cache keyed by the host alias the user passed in. Each
/// cached entry is (russh handle, sftp session). The handle owns the
/// transport; sftp is opened on top of it.
struct Conn {
    _handle: Handle<Client>,
    sftp: SftpSession,
}

#[derive(Default)]
pub struct SshState {
    conns: Mutex<HashMap<String, Arc<tokio::sync::Mutex<Conn>>>>,
}

/// russh requires a Handler implementing host-key verification. For the
/// sidebar use case the user has *already* SSH'd from their terminal,
/// so the host key has been validated by their `ssh` once already.
/// We auto-accept to keep v1 simple — a follow-up can plug in a
/// known_hosts checker.
struct Client;

impl client::Handler for Client {
    type Error = russh::Error;

    fn check_server_key(
        &mut self,
        _server_public_key: &PublicKey,
    ) -> impl std::future::Future<Output = Result<bool, Self::Error>> + Send {
        async { Ok(true) }
    }
}

/// Open or return the cached SSH+SFTP connection for `alias`. Resolves
/// `alias` through `~/.ssh/config` for HostName/User/Port, then auths
/// using whatever the agent can offer.
async fn get_or_connect(
    state: &SshState,
    alias: &str,
) -> Result<Arc<tokio::sync::Mutex<Conn>>, String> {
    if let Some(c) = state.conns.lock().get(alias).cloned() {
        return Ok(c);
    }

    let resolved = config::resolve(alias);
    let addr = format!("{}:{}", resolved.host, resolved.port);

    let cfg = client::Config {
        inactivity_timeout: Some(std::time::Duration::from_secs(300)),
        ..Default::default()
    };

    let sh = Client;
    let handle_fut = tokio::time::timeout(
        std::time::Duration::from_secs(CONNECT_TIMEOUT_SECS),
        client::connect(Arc::new(cfg), addr.as_str(), sh),
    );
    let mut handle = handle_fut
        .await
        .map_err(|_| format!("connect timeout: {addr}"))?
        .map_err(|e| format!("connect {addr}: {e}"))?;

    // Auth via SSH agent — only path supported in v1. If $SSH_AUTH_SOCK
    // isn't set or no key in the agent works, we surface a clear error.
    auth_with_agent(&mut handle, &resolved.user).await?;

    let channel = handle
        .channel_open_session()
        .await
        .map_err(|e| format!("open channel: {e}"))?;
    channel
        .request_subsystem(true, "sftp")
        .await
        .map_err(|e| format!("request sftp subsystem: {e}"))?;

    // russh-sftp wants the channel cast to its stream type.
    let sftp = SftpSession::new(channel.into_stream())
        .await
        .map_err(|e| format!("sftp init: {e}"))?;

    let conn = Arc::new(tokio::sync::Mutex::new(Conn {
        _handle: handle,
        sftp,
    }));
    state.conns.lock().insert(alias.to_string(), conn.clone());
    Ok(conn)
}

async fn auth_with_agent(handle: &mut Handle<Client>, user: &str) -> Result<(), String> {
    let sock = std::env::var("SSH_AUTH_SOCK")
        .map_err(|_| "SSH_AUTH_SOCK not set — start ssh-agent and `ssh-add` your key".to_string())?;
    let stream = UnixStream::connect(&sock)
        .await
        .map_err(|e| format!("connect to ssh-agent at {sock}: {e}"))?;
    let mut agent = russh::keys::agent::client::AgentClient::connect(stream);
    let identities = agent
        .request_identities()
        .await
        .map_err(|e| format!("agent request_identities: {e}"))?;
    if identities.is_empty() {
        return Err("ssh-agent has no identities — run `ssh-add ~/.ssh/id_*`".into());
    }
    for key in identities {
        let auth = handle
            .authenticate_publickey_with(
                user,
                key,
                None,
                &mut agent,
            )
            .await
            .map_err(|e| format!("authenticate_publickey_with: {e}"))?;
        if matches!(auth, russh::client::AuthResult::Success) {
            return Ok(());
        }
    }
    Err(format!(
        "no agent identity accepted by remote host as user {user}"
    ))
}

#[tauri::command]
pub async fn ssh_list_dir(
    state: tauri::State<'_, SshState>,
    host: String,
    path: String,
) -> Result<Vec<SshDirEntry>, String> {
    // If we already had a connection cached and it fails (remote
    // rebooted, laptop slept, etc.), evict and try once more with a
    // fresh handshake. New connections get one shot — no retry loop.
    let was_cached = state.conns.lock().contains_key(&host);
    match list_dir_inner(&state, &host, &path).await {
        Ok(out) => Ok(out),
        Err(first) if was_cached => {
            state.conns.lock().remove(&host);
            list_dir_inner(&state, &host, &path)
                .await
                .map_err(|second| format!("{first}; reconnect failed: {second}"))
        }
        Err(e) => Err(e),
    }
}

async fn list_dir_inner(
    state: &SshState,
    host: &str,
    path: &str,
) -> Result<Vec<SshDirEntry>, String> {
    let conn = get_or_connect(state, host).await?;
    let conn = conn.lock().await;
    let entries_iter = tokio::time::timeout(
        std::time::Duration::from_secs(OPERATION_TIMEOUT_SECS),
        conn.sftp.read_dir(path),
    )
    .await
    .map_err(|_| format!("sftp read_dir timeout: {path}"))?
    .map_err(|e| format!("sftp read_dir {path}: {e}"))?;

    let mut entries: Vec<_> = entries_iter.collect();
    let mut out: Vec<SshDirEntry> = Vec::with_capacity(entries.len());
    let base = if path.ends_with('/') {
        path.to_string()
    } else {
        format!("{path}/")
    };
    for e in entries.drain(..) {
        let name = e.file_name();
        if name == "." || name == ".." {
            continue;
        }
        let file_type = e.file_type();
        let is_dir = matches!(file_type, FileType::Dir);
        let is_symlink = matches!(file_type, FileType::Symlink);
        out.push(SshDirEntry {
            path: format!("{base}{name}"),
            name,
            is_dir,
            is_symlink,
        });
    }
    out.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });
    Ok(out)
}

/// Recursive remote mkdir. SFTP's MKDIR is single-level only, so we
/// walk the path segments and `create_dir` each one — ignoring "file
/// already exists" errors so the call is idempotent like Rust's
/// `create_dir_all`. Symlink targets and permission errors propagate.
async fn create_dir_all_inner(
    state: &SshState,
    host: &str,
    path: &str,
) -> Result<(), String> {
    let conn = get_or_connect(state, host).await?;
    let conn = conn.lock().await;

    // Tilde expansion. We could shell-expand on the remote, but
    // SFTP gives us a clean `canonicalize(".")` for the user's home
    // and that's cheaper than spawning a remote shell.
    let resolved = if path == "~" || path.starts_with("~/") {
        let home = tokio::time::timeout(
            std::time::Duration::from_secs(OPERATION_TIMEOUT_SECS),
            conn.sftp.canonicalize("."),
        )
        .await
        .map_err(|_| "sftp canonicalize . timeout".to_string())?
        .map_err(|e| format!("sftp canonicalize .: {e}"))?;
        if path == "~" {
            home
        } else {
            format!("{}/{}", home.trim_end_matches('/'), &path[2..])
        }
    } else {
        path.to_string()
    };

    // Split into cumulative segments and try each. We MUST proceed past
    // "file exists" — that's the expected case for parent dirs.
    let mut acc = if resolved.starts_with('/') {
        String::from("/")
    } else {
        String::new()
    };
    for seg in resolved.split('/').filter(|s| !s.is_empty()) {
        if !acc.is_empty() && !acc.ends_with('/') {
            acc.push('/');
        }
        acc.push_str(seg);
        match tokio::time::timeout(
            std::time::Duration::from_secs(OPERATION_TIMEOUT_SECS),
            conn.sftp.create_dir(acc.clone()),
        )
        .await
        {
            Ok(Ok(())) => {}
            Ok(Err(e)) => {
                // FILE_ALREADY_EXISTS / PERMISSION_DENIED — first one is
                // fine, second only matters at the leaf. russh-sftp's
                // Error::Display includes the SFTP status; we match
                // lossily on the substring rather than crack it open.
                let msg = e.to_string();
                if msg.contains("already exists") || msg.contains("AlreadyExists") {
                    continue;
                }
                return Err(format!("sftp mkdir {acc}: {msg}"));
            }
            Err(_) => return Err(format!("sftp mkdir {acc}: timeout")),
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn ssh_create_dir(
    state: tauri::State<'_, SshState>,
    host: String,
    path: String,
) -> Result<(), String> {
    let was_cached = state.conns.lock().contains_key(&host);
    match create_dir_all_inner(&state, &host, &path).await {
        Ok(()) => Ok(()),
        Err(first) if was_cached => {
            state.conns.lock().remove(&host);
            create_dir_all_inner(&state, &host, &path)
                .await
                .map_err(|second| format!("{first}; reconnect failed: {second}"))
        }
        Err(e) => Err(e),
    }
}

#[tauri::command]
pub async fn ssh_disconnect(
    state: tauri::State<'_, SshState>,
    host: String,
) -> Result<(), String> {
    // Drop the cached connection; russh's Handle disconnects on drop.
    state.conns.lock().remove(&host);
    Ok(())
}
