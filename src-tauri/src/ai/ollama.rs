use std::time::Instant;

use reqwest::Client;
use serde::Deserialize;
use serde_json::json;

use super::provider::{AIRequest, AIResponse};

const OLLAMA_DEFAULT_ENDPOINT: &str = "http://localhost:11434";
const OLLAMA_DEFAULT_MODEL: &str = "llama3";

#[derive(Debug, Deserialize)]
struct OllamaChatResponse {
    message: Option<OllamaMessage>,
    model: Option<String>,
    prompt_eval_count: Option<u32>,
    eval_count: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct OllamaMessage {
    content: String,
}

#[derive(Debug, Deserialize)]
struct OllamaTagsResponse {
    models: Vec<OllamaModel>,
}

#[derive(Debug, Deserialize)]
struct OllamaModel {
    name: String,
}

pub async fn ollama_generate(endpoint: &str, request: &AIRequest) -> Result<AIResponse, String> {
    let endpoint = normalize_endpoint(endpoint);
    let model = request
        .model
        .clone()
        .unwrap_or_else(|| OLLAMA_DEFAULT_MODEL.to_string());
    let mut system_prompt = request.system_prompt.clone();
    if request.json_mode {
        system_prompt.push_str("\nRespond only with valid JSON, no markdown, no preamble.");
    }

    let started = Instant::now();
    let mut body = json!({
        "model": model,
        "stream": false,
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": request.user_prompt }
        ],
        "options": {
            "temperature": request.temperature.unwrap_or(0.7)
        }
    });

    if request.json_mode {
        if let Some(object) = body.as_object_mut() {
            object.insert("format".to_string(), json!("json"));
        }
    }

    let response = Client::new()
        .post(format!("{endpoint}/api/chat"))
        .json(&body)
        .send()
        .await
        .map_err(|err| format!("Ollama-Anfrage fehlgeschlagen: {err}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_else(|_| String::new());
        return Err(format!("Ollama API-Fehler ({status}): {body}"));
    }

    let parsed = response
        .json::<OllamaChatResponse>()
        .await
        .map_err(|err| format!("Ollama-Antwort konnte nicht gelesen werden: {err}"))?;
    let text = parsed
        .message
        .map(|message| message.content)
        .ok_or_else(|| "Ollama-Antwort enthält keinen Text.".to_string())?;

    Ok(AIResponse {
        text,
        tokens_input: parsed.prompt_eval_count.unwrap_or(0),
        tokens_output: parsed.eval_count.unwrap_or(0),
        model: parsed.model.unwrap_or(model),
        provider: "ollama".to_string(),
        duration_ms: started.elapsed().as_millis() as u64,
    })
}

pub async fn ollama_test_connection(endpoint: &str) -> Result<String, String> {
    let models = ollama_list_models(endpoint).await?;
    models
        .first()
        .cloned()
        .ok_or_else(|| "Ollama ist erreichbar, aber es sind keine Modelle installiert.".to_string())
}

pub async fn ollama_list_models(endpoint: &str) -> Result<Vec<String>, String> {
    let endpoint = normalize_endpoint(endpoint);
    let response = Client::new()
        .get(format!("{endpoint}/api/tags"))
        .send()
        .await
        .map_err(|err| format!("Ollama-Modellliste konnte nicht geladen werden: {err}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_else(|_| String::new());
        return Err(format!("Ollama API-Fehler ({status}): {body}"));
    }

    let parsed = response
        .json::<OllamaTagsResponse>()
        .await
        .map_err(|err| format!("Ollama-Modellliste konnte nicht gelesen werden: {err}"))?;
    Ok(parsed.models.into_iter().map(|model| model.name).collect())
}

pub fn default_endpoint() -> &'static str {
    OLLAMA_DEFAULT_ENDPOINT
}

fn normalize_endpoint(endpoint: &str) -> String {
    let trimmed = endpoint.trim();
    let endpoint = if trimmed.is_empty() {
        OLLAMA_DEFAULT_ENDPOINT
    } else {
        trimmed
    };
    endpoint.trim_end_matches('/').to_string()
}
