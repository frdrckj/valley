use serde::Serialize;
use std::process::Command;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellResult {
    pub stdout: String,
    pub stderr: String,
    pub code: Option<i32>,
}

#[tauri::command]
pub async fn shell_run_command(cmd: String, cwd: Option<String>) -> Result<ShellResult, String> {
    let mut c = Command::new("/bin/sh");
    c.arg("-c").arg(&cmd);
    if let Some(d) = cwd {
        c.current_dir(d);
    }
    let out = c.output().map_err(|e| format!("spawn: {e}"))?;
    Ok(ShellResult {
        stdout: String::from_utf8_lossy(&out.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&out.stderr).into_owned(),
        code: out.status.code(),
    })
}
