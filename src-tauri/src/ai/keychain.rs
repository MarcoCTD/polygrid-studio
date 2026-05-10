use keyring::{Entry, Error};

const KEYCHAIN_SERVICE: &str = "polygrid-studio";

fn entry(service: &str, key: &str) -> Result<Entry, String> {
    Entry::new(service, key)
        .map_err(|err| format!("Keychain-Eintrag konnte nicht erstellt werden: {err}"))
}

fn provider_account(provider: &str) -> Result<&'static str, String> {
    match provider.trim().to_lowercase().as_str() {
        "claude" => Ok("claude_api_key"),
        "openai" => Ok("openai_api_key"),
        "gemini" => Ok("ai_gemini"),
        other => Err(format!("Unbekannter API-Key-Provider: {other}")),
    }
}

#[tauri::command]
pub fn keychain_set(service: String, key: String, value: String) -> Result<(), String> {
    entry(&service, &key)?
        .set_password(&value)
        .map_err(|err| format!("Keychain-Wert konnte nicht gespeichert werden: {err}"))
}

#[tauri::command]
pub fn keychain_get(service: String, key: String) -> Result<Option<String>, String> {
    match entry(&service, &key)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(Error::NoEntry) => Ok(None),
        Err(err) => Err(format!("Keychain-Wert konnte nicht gelesen werden: {err}")),
    }
}

#[tauri::command]
pub fn keychain_delete(service: String, key: String) -> Result<(), String> {
    match entry(&service, &key)?.delete_credential() {
        Ok(()) | Err(Error::NoEntry) => Ok(()),
        Err(err) => Err(format!("Keychain-Wert konnte nicht gelöscht werden: {err}")),
    }
}

#[tauri::command]
pub fn set_api_key(provider: String, key: String) -> Result<(), String> {
    let account = provider_account(&provider)?;
    keychain_set(KEYCHAIN_SERVICE.to_string(), account.to_string(), key)
}

#[tauri::command]
pub fn get_api_key(provider: String) -> Result<Option<String>, String> {
    let account = provider_account(&provider)?;
    keychain_get(KEYCHAIN_SERVICE.to_string(), account.to_string())
}

#[tauri::command]
pub fn delete_api_key(provider: String) -> Result<(), String> {
    let account = provider_account(&provider)?;
    keychain_delete(KEYCHAIN_SERVICE.to_string(), account.to_string())
}

pub fn keychain_get_secret(service: &str, key: &str) -> Result<Option<String>, String> {
    match entry(service, key)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(Error::NoEntry) => Ok(None),
        Err(err) => Err(format!("Keychain-Wert konnte nicht gelesen werden: {err}")),
    }
}
