use std::time::Instant;

use reqwest::Client;
use serde::Deserialize;
use serde_json::json;

use super::provider::{AIRequest, AIResponse};

const GEMINI_BASE_ENDPOINT: &str = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_DEFAULT_MODEL: &str = "gemini-3.5-flash";

/// Migriert veraltete/gespeicherte Modellnamen auf aktuell verfügbare Modelle,
/// bevor der Request rausgeht. Gemini 1.5/2.0 sind im Free Tier abgeschaltet
/// (429, limit: 0); "gemini-3.1-pro" existiert in der API nur als
/// "gemini-3.1-pro-preview" (sonst 404).
fn normalize_model(model: &str) -> String {
    match model.trim() {
        "" | "gemini-2.0-flash" | "gemini-1.5-flash" | "gemini-flash-latest" => {
            GEMINI_DEFAULT_MODEL.to_string()
        }
        "gemini-2.0-flash-lite" | "gemini-1.5-flash-8b" => "gemini-3.1-flash-lite".to_string(),
        "gemini-1.5-pro" | "gemini-pro" | "gemini-3.1-pro" => {
            "gemini-3.1-pro-preview".to_string()
        }
        // Google hat auch alle restlichen Gemini-1.x-/2.0-Varianten
        // abgeschaltet (Juni 2026) – auf den Default zurückfallen.
        other if other.starts_with("gemini-1.") || other.starts_with("gemini-2.0") => {
            GEMINI_DEFAULT_MODEL.to_string()
        }
        other => other.to_string(),
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
    // Thinking-Modelle (Gemini 3.x/3.5) liefern Thought-Parts mit thought=true,
    // die nicht Teil der eigentlichen Antwort sind.
    thought: Option<bool>,
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

    let model = normalize_model(request.model.as_deref().unwrap_or(""));
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
        .map(|parts| {
            parts
                .iter()
                .filter(|part| !part.thought.unwrap_or(false))
                .filter_map(|part| part.text.as_deref())
                .collect::<Vec<_>>()
                .join("")
        })
        .filter(|text| !text.is_empty())
        .ok_or_else(|| {
            "Gemini-Antwort enthält keinen Text (evtl. maxOutputTokens durch Thinking aufgebraucht)."
                .to_string()
        })?;

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
        .query(&[("key", api_key), ("pageSize", "200")])
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_model_migriert_alte_namen() {
        assert_eq!(normalize_model("gemini-2.0-flash"), "gemini-3.5-flash");
        assert_eq!(normalize_model("gemini-1.5-flash"), "gemini-3.5-flash");
        assert_eq!(normalize_model("gemini-2.0-flash-lite"), "gemini-3.1-flash-lite");
        assert_eq!(normalize_model("gemini-1.5-pro"), "gemini-3.1-pro-preview");
        assert_eq!(normalize_model("gemini-3.1-pro"), "gemini-3.1-pro-preview");
        // Präfix-Fallback für nicht explizit gelistete Alt-Varianten
        assert_eq!(normalize_model("gemini-1.5-pro-002"), GEMINI_DEFAULT_MODEL);
        assert_eq!(normalize_model("gemini-2.0-pro-exp"), GEMINI_DEFAULT_MODEL);
    }

    #[test]
    fn normalize_model_laesst_aktuelle_namen_unveraendert() {
        assert_eq!(normalize_model("gemini-3.5-flash"), "gemini-3.5-flash");
        assert_eq!(normalize_model("gemini-2.5-flash"), "gemini-2.5-flash");
        assert_eq!(normalize_model("gemini-3.1-flash-lite"), "gemini-3.1-flash-lite");
    }

    #[test]
    fn normalize_model_leerer_name_ergibt_default() {
        assert_eq!(normalize_model(""), GEMINI_DEFAULT_MODEL);
        assert_eq!(normalize_model("  "), GEMINI_DEFAULT_MODEL);
    }
}
