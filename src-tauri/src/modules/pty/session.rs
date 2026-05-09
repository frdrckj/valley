use std::collections::HashMap;
use std::io::Write;
use std::sync::Arc;
use parking_lot::RwLock;
use portable_pty::{native_pty_system, Child, ChildKiller, CommandBuilder, PtyPair, PtySize};
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
    pub writer: Box<dyn Write + Send + Sync>,
    pub master: Arc<dyn portable_pty::MasterPty + Send + Sync>,
    pub child_killer: Box<dyn ChildKiller + Send + Sync>,
}

#[derive(Default)]
pub struct PtyState(pub RwLock<HashMap<String, Session>>);

#[tauri::command]
pub async fn pty_open(
    _state: State<'_, PtyState>,
    _id: String,
    _shell: Option<String>,
    _cwd: Option<String>,
    _cols: u16,
    _rows: u16,
    _on_event: Channel<PtyEvent>,
) -> Result<(), String> {
    Err("not yet implemented".into())
}

#[tauri::command]
pub async fn pty_write(
    _state: State<'_, PtyState>,
    _id: String,
    _data: String,
) -> Result<(), String> {
    Err("not yet implemented".into())
}

#[tauri::command]
pub async fn pty_resize(
    _state: State<'_, PtyState>,
    _id: String,
    _cols: u16,
    _rows: u16,
) -> Result<(), String> {
    Err("not yet implemented".into())
}

#[tauri::command]
pub async fn pty_close(
    _state: State<'_, PtyState>,
    _id: String,
) -> Result<(), String> {
    Err("not yet implemented".into())
}
