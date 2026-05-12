use reqwest::multipart;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;
use tauri::{Emitter, Window};

static OAUTH_PORT: Mutex<Option<u16>> = Mutex::new(None);
const ETSY_API_BASE_URL: &str = "https://api.etsy.com/v3";
const ALLOWED_IMAGE_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "webp"];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthServerInfo {
    pub port: u16,
}

#[derive(Debug, Serialize)]
pub struct EtsyApiResponse {
    pub status: u16,
    pub body: String,
    pub headers: HashMap<String, String>,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub enum EtsyBody {
    Text(String),
    Json(serde_json::Value),
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
    let path = validate_image_path(path)?;
    fs::read(&path).map_err(|err| format!("Datei konnte nicht gelesen werden: {err}"))
}

#[tauri::command]
pub async fn etsy_api_request(
    method: String,
    path: String,
    access_token: Option<String>,
    api_key: String,
    body: Option<EtsyBody>,
    query: Option<HashMap<String, serde_json::Value>>,
    content_type: Option<String>,
) -> Result<EtsyApiResponse, String> {
    let client = Client::new();
    let url = etsy_url(&path)?;
    let method = reqwest::Method::from_bytes(method.to_uppercase().as_bytes())
        .map_err(|err| format!("HTTP-Methode ist ungültig: {err}"))?;
    let mut request = client.request(method, url).header("x-api-key", api_key);

    if let Some(token) = access_token.filter(|token| !token.trim().is_empty()) {
        request = request.bearer_auth(token);
    }

    if let Some(query) = query {
        let params = query_to_pairs(query);
        if !params.is_empty() {
            request = request.query(&params);
        }
    }

    match (content_type.as_deref(), body) {
        (Some("application/x-www-form-urlencoded"), Some(EtsyBody::Text(value))) => {
            request = request
                .header("content-type", "application/x-www-form-urlencoded")
                .body(value);
        }
        (Some("application/x-www-form-urlencoded"), Some(EtsyBody::Json(value))) => {
            let form = json_to_form_pairs(value)?;
            request = request.form(&form);
        }
        (_, Some(EtsyBody::Json(value))) => {
            request = request
                .header("content-type", "application/json")
                .json(&value);
        }
        (_, Some(EtsyBody::Text(value))) => {
            request = request
                .header("content-type", "application/json")
                .body(value);
        }
        (_, None) => {}
    }

    let response = request
        .send()
        .await
        .map_err(|err| format!("Etsy-Anfrage fehlgeschlagen: {err}"))?;
    etsy_response(response).await
}

#[tauri::command]
pub async fn etsy_upload_listing_image(
    path: String,
    access_token: String,
    api_key: String,
    shop_id: String,
    listing_id: String,
    rank: u8,
) -> Result<EtsyApiResponse, String> {
    let path = validate_image_path(path)?;
    let bytes =
        fs::read(&path).map_err(|err| format!("Bild konnte nicht gelesen werden: {err}"))?;
    let filename = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("listing-image")
        .to_string();
    let mime = mime_for_path(&path)?;
    let part = multipart::Part::bytes(bytes)
        .file_name(filename)
        .mime_str(mime)
        .map_err(|err| format!("Bild-MIME-Typ konnte nicht gesetzt werden: {err}"))?;
    let form = multipart::Form::new()
        .part("image", part)
        .text("rank", rank.to_string());
    let url = etsy_url(&format!(
        "/application/shops/{shop_id}/listings/{listing_id}/images"
    ))?;

    let response = Client::new()
        .post(url)
        .bearer_auth(access_token)
        .header("x-api-key", api_key)
        .multipart(form)
        .send()
        .await
        .map_err(|err| format!("Etsy-Bild-Upload fehlgeschlagen: {err}"))?;

    etsy_response(response).await
}

pub fn validate_image_path(path: String) -> Result<PathBuf, String> {
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

    Ok(path)
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

fn etsy_url(path: &str) -> Result<String, String> {
    if path.starts_with("http://") || path.starts_with("https://") {
        return Err("Etsy-Pfad darf keine vollständige URL sein.".to_string());
    }
    let normalized = if path.starts_with('/') {
        path.to_string()
    } else {
        format!("/{path}")
    };
    Ok(format!("{ETSY_API_BASE_URL}{normalized}"))
}

fn query_to_pairs(query: HashMap<String, serde_json::Value>) -> Vec<(String, String)> {
    query
        .into_iter()
        .filter_map(|(key, value)| json_scalar_to_string(value).map(|value| (key, value)))
        .collect()
}

fn json_to_form_pairs(value: serde_json::Value) -> Result<Vec<(String, String)>, String> {
    let object = value
        .as_object()
        .ok_or_else(|| "Form-Body muss ein JSON-Objekt sein.".to_string())?;
    Ok(object
        .iter()
        .filter_map(|(key, value)| {
            json_scalar_to_string(value.clone()).map(|value| (key.clone(), value))
        })
        .collect())
}

fn json_scalar_to_string(value: serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::Null => None,
        serde_json::Value::String(value) if value.trim().is_empty() => None,
        serde_json::Value::String(value) => Some(value),
        serde_json::Value::Number(value) => Some(value.to_string()),
        serde_json::Value::Bool(value) => Some(value.to_string()),
        other => Some(other.to_string()),
    }
}

async fn etsy_response(response: reqwest::Response) -> Result<EtsyApiResponse, String> {
    let status = response.status();
    let headers = response
        .headers()
        .iter()
        .filter_map(|(key, value)| {
            value
                .to_str()
                .ok()
                .map(|value| (key.as_str().to_string(), value.to_string()))
        })
        .collect::<HashMap<_, _>>();
    let body = response
        .text()
        .await
        .map_err(|err| format!("Etsy-Antwort konnte nicht gelesen werden: {err}"))?;

    if !status.is_success() {
        return Err(format!("Etsy API-Fehler ({status}): {body}"));
    }

    Ok(EtsyApiResponse {
        status: status.as_u16(),
        body,
        headers,
    })
}

fn mime_for_path(path: &std::path::Path) -> Result<&'static str, String> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_lowercase)
        .ok_or_else(|| "Dateityp konnte nicht ermittelt werden.".to_string())?;

    if !ALLOWED_IMAGE_EXTENSIONS.contains(&extension.as_str()) {
        return Err("Nur Bilddateien vom Typ png, jpg, jpeg oder webp sind erlaubt.".to_string());
    }

    match extension.as_str() {
        "png" => Ok("image/png"),
        "jpg" | "jpeg" => Ok("image/jpeg"),
        "webp" => Ok("image/webp"),
        _ => Err("Nicht unterstützter Bildtyp.".to_string()),
    }
}
