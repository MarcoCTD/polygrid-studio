use std::time::Instant;

use reqwest::Client;
use serde::Deserialize;
use serde_json::json;

use super::provider::{AIRequest, AIResponse};

const GEMINI_BASE_ENDPOINT: &str = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_DEFAULT_MODEL: &str = "gemini-3.5-flash";

/// Google hat alle Gemini-1.x- und 2.0-Modelle abgeschaltet (Juni 2026);
/// Requests dagegen liefern 404. Solche Modelle fallen auf den Default.
fn resolve_gemini_model(model: String) -> String {
    if model.starts_with("gemini-1.") || model.starts_with("gemini-2.0") {
        GEMINI_DEFAULT_MODEL.to_string()
    } else {
        model
    }
}

#[derive(Debug, Deserialize)]
struct GeminiModelsResponse {
    models: Vec<GeminiModel>,
}

#[derive(Debug, Deserialize)]
struct GeminiModel {
    name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GeminiGenerateResponse {
    candidates: Option<Vec<GeminiCandidate>>,
    usage_metadata: Option<GeminiUsage>,
    model_version: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GeminiCandidate {
    content: Option<GeminiContent>,
}

#[derive(Debug, Deserialize)]
struct GeminiContent {
    parts: Option<Vec<GeminiPart>>,
}

#[derive(Debug, Deserialize)]
struct GeminiPart {
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GeminiUsage {
    prompt_token_count: Option<u32>,
    candidates_token_count: Option<u32>,
    total_token_count: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct GeminiErrorResponse {
    error: Option<GeminiErrorBody>,
}

#[derive(Debug, Deserialize)]
struct GeminiErrorBody {
    message: String,
}

pub async fn gemini_generate(api_key: &str, request: &AIRequest) -> Result<AIResponse, String> {
    if api_key.trim().is_empty() {
        return Err("Gemini API-Key fehlt.".to_string());
    }

    let model = resolve_gemini_model(
        request
            .model
            .clone()
            .unwrap_or_else(|| GEMINI_DEFAULT_MODEL.to_string()),
    );
    let mut system_prompt = request.system_prompt.clone();
    if request.json_mode {
        system_prompt.push_str("\nRespond only with valid JSON, no markdown, no preamble.");
    }

    let started = Instant::now();
    let url = format!("{GEMINI_BASE_ENDPOINT}/models/{model}:generateContent");
    let mut body = json!({
        "contents": [
            {
                "parts": [
                    { "text": request.user_prompt }
                ]
            }
        ],
        "generationConfig": {
            "maxOutputTokens": request.max_tokens.unwrap_or(1000),
            "temperature": request.temperature.unwrap_or(0.7)
        }
    });

    if !system_prompt.trim().is_empty() {
        if let Some(object) = body.as_object_mut() {
            object.insert(
                "systemInstruction".to_string(),
                json!({
                    "parts": [
                        { "text": system_prompt }
                    ]
                }),
            );
        }
    }

    let response = Client::new()
        .post(url)
        .query(&[("key", api_key)])
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|err| format!("Gemini-Anfrage fehlgeschlagen: {err}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_else(|_| String::new());
        let message = serde_json::from_str::<GeminiErrorResponse>(&body)
            .ok()
            .and_then(|parsed| parsed.error.map(|err| err.message))
            .unwrap_or(body);
        return Err(format!("Gemini API-Fehler ({status}): {message}"));
    }

    let parsed = response
        .json::<GeminiGenerateResponse>()
        .await
        .map_err(|err| format!("Gemini-Antwort konnte nicht gelesen werden: {err}"))?;
    let text = parsed
        .candidates
        .as_ref()
        .and_then(|candidates| candidates.first())
        .and_then(|candidate| candidate.content.as_ref())
        .and_then(|content| content.parts.as_ref())
        .and_then(|parts| parts.first())
        .and_then(|part| part.text.clone())
        .ok_or_else(|| "Gemini-Antwort enthält keinen Text.".to_string())?;

    let usage = parsed.usage_metadata.unwrap_or(GeminiUsage {
        prompt_token_count: Some(0),
        candidates_token_count: None,
        total_token_count: Some(0),
    });
    let tokens_input = usage.prompt_token_count.unwrap_or(0);
    let tokens_output = usage.candidates_token_count.unwrap_or_else(|| {
        usage
            .total_token_count
            .unwrap_or(tokens_input)
            .saturating_sub(tokens_input)
    });

    Ok(AIResponse {
        text,
        tokens_input,
        tokens_output,
        model: parsed.model_version.unwrap_or(model),
        provider: "gemini".to_string(),
        duration_ms: started.elapsed().as_millis() as u64,
    })
}

pub async fn gemini_test_connection(api_key: &str) -> Result<String, String> {
    if api_key.trim().is_empty() {
        return Err("Gemini API-Key fehlt.".to_string());
    }

    let response = Client::new()
        .get(format!("{GEMINI_BASE_ENDPOINT}/models"))
        .query(&[("key", api_key)])
        .send()
        .await
        .map_err(|err| format!("Gemini-Modellliste konnte nicht geladen werden: {err}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_else(|_| String::new());
        return Err(format!("Gemini API-Fehler ({status}): {body}"));
    }

    let parsed = response
        .json::<GeminiModelsResponse>()
        .await
        .map_err(|err| format!("Gemini-Modellliste konnte nicht gelesen werden: {err}"))?;

    parsed
        .models
        .into_iter()
        .find(|model| model.name.contains(GEMINI_DEFAULT_MODEL))
        .map(|model| model.name)
        .ok_or_else(|| "Gemini erreichbar, aber kein unterstütztes Modell gefunden.".to_string())
}
