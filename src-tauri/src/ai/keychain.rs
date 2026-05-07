use keyring::{Entry, Error};

fn entry(service: &str, key: &str) -> Result<Entry, String> {
    Entry::new(service, key)
        .map_err(|err| format!("Keychain-Eintrag konnte nicht erstellt werden: {err}"))
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

pub fn keychain_get_secret(service: &str, key: &str) -> Result<Option<String>, String> {
    match entry(service, key)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(Error::NoEntry) => Ok(None),
        Err(err) => Err(format!("Keychain-Wert konnte nicht gelesen werden: {err}")),
    }
}
