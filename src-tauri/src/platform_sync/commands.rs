use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;
use tauri::{Emitter, Window};

static OAUTH_PORT: Mutex<Option<u16>> = Mutex::new(None);

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthServerInfo {
    pub port: u16,
}

#[tauri::command]
pub async fn start_oauth_server(window: Window) -> Result<OAuthServerInfo, String> {
    let mut current_port = OAUTH_PORT
        .lock()
        .map_err(|err| format!("OAuth-Server-State konnte nicht gesperrt werden: {err}"))?;

    if let Some(port) = *current_port {
        return Ok(OAuthServerInfo { port });
    }

    let port = tauri_plugin_oauth::start(move |url| {
        let _ = window.emit("platform-sync://oauth-url", url);
    })
    .map_err(|err| format!("OAuth-Server konnte nicht gestartet werden: {err}"))?;

    *current_port = Some(port);
    Ok(OAuthServerInfo { port })
}

#[tauri::command]
pub fn stop_oauth_server() -> Result<(), String> {
    let port = {
        let mut current_port = OAUTH_PORT
            .lock()
            .map_err(|err| format!("OAuth-Server-State konnte nicht gesperrt werden: {err}"))?;
        current_port.take()
    };

    if let Some(port) = port {
        tauri_plugin_oauth::cancel(port)
            .map_err(|err| format!("OAuth-Server konnte nicht gestoppt werden: {err}"))?;
    }

    Ok(())
}

#[tauri::command]
pub fn read_file_binary(path: String) -> Result<Vec<u8>, String> {
    let path = PathBuf::from(path);
    if !path.exists() {
        return Err("Datei existiert nicht.".to_string());
    }

    let metadata =
        fs::metadata(&path).map_err(|err| format!("Datei konnte nicht geprüft werden: {err}"))?;
    if !metadata.is_file() {
        return Err("Nur Dateien können gelesen werden.".to_string());
    }

    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_lowercase)
        .ok_or_else(|| "Dateityp konnte nicht ermittelt werden.".to_string())?;

    if !matches!(extension.as_str(), "png" | "jpg" | "jpeg" | "webp") {
        return Err("Nur Bilddateien vom Typ png, jpg, jpeg oder webp sind erlaubt.".to_string());
    }

    fs::read(&path).map_err(|err| format!("Datei konnte nicht gelesen werden: {err}"))
}

#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), String> {
    let trimmed = url.trim();
    if !(trimmed.starts_with("https://") || trimmed.starts_with("http://")) {
        return Err("Nur http/https URLs dürfen geöffnet werden.".to_string());
    }

    #[cfg(target_os = "macos")]
    let status = Command::new("open").arg(trimmed).status();

    #[cfg(target_os = "windows")]
    let status = Command::new("cmd")
        .args(["/C", "start", "", trimmed])
        .status();

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    let status = Command::new("xdg-open").arg(trimmed).status();

    match status {
        Ok(status) if status.success() => Ok(()),
        Ok(_) => Err("URL konnte nicht geöffnet werden.".to_string()),
        Err(err) => Err(format!("URL konnte nicht geöffnet werden: {err}")),
    }
}
