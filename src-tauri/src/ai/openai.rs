use std::time::Instant;

use reqwest::Client;
use serde::Deserialize;
use serde_json::json;

use super::provider::{AIRequest, AIResponse};

const OPENAI_ENDPOINT: &str = "https://api.openai.com/v1/chat/completions";
const OPENAI_DEFAULT_MODEL: &str = "gpt-5.4";

#[derive(Debug, Deserialize)]
struct OpenAIResponse {
    choices: Vec<OpenAIChoice>,
    usage: Option<OpenAIUsage>,
    model: String,
}

#[derive(Debug, Deserialize)]
struct OpenAIChoice {
    message: OpenAIMessage,
}

#[derive(Debug, Deserialize)]
struct OpenAIMessage {
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenAIUsage {
    prompt_tokens: u32,
    completion_tokens: u32,
}

#[derive(Debug, Deserialize)]
struct OpenAIErrorResponse {
    error: Option<OpenAIErrorBody>,
}

#[derive(Debug, Deserialize)]
struct OpenAIErrorBody {
    message: String,
}

pub async fn openai_generate(api_key: &str, request: &AIRequest) -> Result<AIResponse, String> {
    if api_key.trim().is_empty() {
        return Err("OpenAI API-Key fehlt.".to_string());
    }

    let model = request
        .model
        .clone()
        .unwrap_or_else(|| OPENAI_DEFAULT_MODEL.to_string());
    let mut system_prompt = request.system_prompt.clone();
    if request.json_mode {
        system_prompt.push_str("\nRespond only with valid JSON, no markdown, no preamble.");
    }

    let started = Instant::now();
    let mut body = json!({
        "model": model,
        "max_tokens": request.max_tokens.unwrap_or(1024),
        "temperature": request.temperature.unwrap_or(0.7),
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": request.user_prompt }
        ]
    });

    if request.json_mode {
        if let Some(object) = body.as_object_mut() {
            object.insert(
                "response_format".to_string(),
                json!({ "type": "json_object" }),
            );
        }
    }

    let response = Client::new()
        .post(OPENAI_ENDPOINT)
        .bearer_auth(api_key)
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|err| format!("OpenAI-Anfrage fehlgeschlagen: {err}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_else(|_| String::new());
        let message = serde_json::from_str::<OpenAIErrorResponse>(&body)
            .ok()
            .and_then(|parsed| parsed.error.map(|err| err.message))
            .unwrap_or(body);
        return Err(format!("OpenAI API-Fehler ({status}): {message}"));
    }

    let parsed = response
        .json::<OpenAIResponse>()
        .await
        .map_err(|err| format!("OpenAI-Antwort konnte nicht gelesen werden: {err}"))?;
    let text = parsed
        .choices
        .first()
        .and_then(|choice| choice.message.content.clone())
        .ok_or_else(|| "OpenAI-Antwort enthält keinen Text.".to_string())?;
    let usage = parsed.usage.unwrap_or(OpenAIUsage {
        prompt_tokens: 0,
        completion_tokens: 0,
    });

    Ok(AIResponse {
        text,
        tokens_input: usage.prompt_tokens,
        tokens_output: usage.completion_tokens,
        model: parsed.model,
        provider: "openai".to_string(),
        duration_ms: started.elapsed().as_millis() as u64,
    })
}

pub async fn openai_test_connection(api_key: &str) -> Result<String, String> {
    let request = AIRequest {
        system_prompt: "You are a connection test. Reply with OK.".to_string(),
        user_prompt: "Reply with OK.".to_string(),
        max_tokens: Some(8),
        temperature: Some(0.0),
        json_mode: false,
        model: None,
    };
    openai_generate(api_key, &request)
        .await
        .map(|response| response.model)
}
