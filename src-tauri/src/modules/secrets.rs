use keyring::Entry;

const SERVICE: &str = "valley";

#[tauri::command]
pub async fn secrets_get(key: String) -> Result<Option<String>, String> {
    let entry = Entry::new(SERVICE, &key).map_err(|e| format!("entry: {e}"))?;
    match entry.get_password() {
        Ok(s) => Ok(Some(s)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("get: {e}")),
    }
}

#[tauri::command]
pub async fn secrets_set(key: String, value: String) -> Result<(), String> {
    let entry = Entry::new(SERVICE, &key).map_err(|e| format!("entry: {e}"))?;
    entry.set_password(&value).map_err(|e| format!("set: {e}"))
}

#[tauri::command]
pub async fn secrets_delete(key: String) -> Result<(), String> {
    let entry = Entry::new(SERVICE, &key).map_err(|e| format!("entry: {e}"))?;
    match entry.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("delete: {e}")),
    }
}
