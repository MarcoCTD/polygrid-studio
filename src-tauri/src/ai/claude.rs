use std::time::Instant;

use reqwest::Client;
use serde::Deserialize;
use serde_json::json;

use super::provider::{AIRequest, AIResponse};

const CLAUDE_ENDPOINT: &str = "https://api.anthropic.com/v1/messages";
const CLAUDE_DEFAULT_MODEL: &str = "claude-sonnet-5";

/// Migriert abgeschaltete Claude-Modelle auf ihren Nachfolger,
/// damit Requests nicht mit 404 scheitern.
fn resolve_claude_model(model: String) -> String {
    match model.as_str() {
        "claude-sonnet-4-20250514"
        | "claude-3-7-sonnet-20250219"
        | "claude-3-5-sonnet-20241022"
        | "claude-3-5-sonnet-20240620" => "claude-sonnet-5".to_string(),
        "claude-opus-4-20250514" | "claude-3-opus-20240229" => "claude-opus-4-8".to_string(),
        "claude-3-5-haiku-20241022" | "claude-3-haiku-20240307" => "claude-haiku-4-5".to_string(),
        _ => model,
    }
}
const ANTHROPIC_VERSION: &str = "2023-06-01";

#[derive(Debug, Deserialize)]
struct ClaudeResponse {
    content: Vec<ClaudeContentBlock>,
    usage: ClaudeUsage,
    model: String,
}

#[derive(Debug, Deserialize)]
struct ClaudeContentBlock {
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ClaudeUsage {
    input_tokens: u32,
    output_tokens: u32,
}

#[derive(Debug, Deserialize)]
struct ClaudeErrorResponse {
    error: Option<ClaudeErrorBody>,
}

#[derive(Debug, Deserialize)]
struct ClaudeErrorBody {
    message: String,
}

pub async fn claude_generate(api_key: &str, request: &AIRequest) -> Result<AIResponse, String> {
    if api_key.trim().is_empty() {
        return Err("Claude API-Key fehlt.".to_string());
    }

    let model = resolve_claude_model(
        request
            .model
            .clone()
            .unwrap_or_else(|| CLAUDE_DEFAULT_MODEL.to_string()),
    );
    let mut system_prompt = request.system_prompt.clone();
    if request.json_mode {
        system_prompt.push_str("\nRespond only with valid JSON, no markdown, no preamble.");
    }

    let started = Instant::now();
    let body = json!({
        "model": model,
        "max_tokens": request.max_tokens.unwrap_or(1024),
        "temperature": request.temperature.unwrap_or(0.7),
        "system": system_prompt,
        "messages": [
            { "role": "user", "content": request.user_prompt }
        ]
    });

    let response = Client::new()
        .post(CLAUDE_ENDPOINT)
        .header("x-api-key", api_key)
        .header("anthropic-version", ANTHROPIC_VERSION)
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|err| format!("Claude-Anfrage fehlgeschlagen: {err}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_else(|_| String::new());
        let message = serde_json::from_str::<ClaudeErrorResponse>(&body)
            .ok()
            .and_then(|parsed| parsed.error.map(|err| err.message))
            .unwrap_or(body);
        return Err(format!("Claude API-Fehler ({status}): {message}"));
    }

    let parsed = response
        .json::<ClaudeResponse>()
        .await
        .map_err(|err| format!("Claude-Antwort konnte nicht gelesen werden: {err}"))?;
    let text = parsed
        .content
        .iter()
        .find_map(|block| block.text.clone())
        .ok_or_else(|| "Claude-Antwort enthält keinen Text.".to_string())?;

    Ok(AIResponse {
        text,
        tokens_input: parsed.usage.input_tokens,
        tokens_output: parsed.usage.output_tokens,
        model: parsed.model,
        provider: "claude".to_string(),
        duration_ms: started.elapsed().as_millis() as u64,
    })
}

pub async fn claude_test_connection(api_key: &str) -> Result<String, String> {
    let request = AIRequest {
        system_prompt: "You are a connection test. Reply with OK.".to_string(),
        user_prompt: "Reply with OK.".to_string(),
        max_tokens: Some(8),
        temperature: Some(0.0),
        json_mode: false,
        model: None,
    };
    claude_generate(api_key, &request)
        .await
        .map(|response| response.model)
}
