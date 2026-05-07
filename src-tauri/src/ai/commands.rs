use super::claude::{claude_generate, claude_test_connection};
use super::cost::estimate_cost_eur;
use super::keychain::keychain_get_secret;
use super::ollama::{
    default_endpoint, ollama_generate, ollama_list_models, ollama_test_connection,
};
use super::openai::{openai_generate, openai_test_connection};
use super::provider::{AIRequest, AIResponse};

const KEYCHAIN_SERVICE: &str = "polygrid-studio";
const CLAUDE_KEY: &str = "claude_api_key";
const OPENAI_KEY: &str = "openai_api_key";

#[tauri::command]
pub async fn ai_generate_text(
    provider: String,
    system_prompt: String,
    user_prompt: String,
    max_tokens: Option<u32>,
    temperature: Option<f32>,
    model: Option<String>,
) -> Result<AIResponse, String> {
    generate(
        provider,
        system_prompt,
        user_prompt,
        max_tokens,
        temperature,
        model,
        false,
    )
    .await
}

#[tauri::command]
pub async fn ai_generate_structured(
    provider: String,
    system_prompt: String,
    user_prompt: String,
    max_tokens: Option<u32>,
    temperature: Option<f32>,
    model: Option<String>,
) -> Result<AIResponse, String> {
    generate(
        provider,
        system_prompt,
        user_prompt,
        max_tokens,
        temperature,
        model,
        true,
    )
    .await
}

#[tauri::command]
pub async fn ai_test_connection(provider: String) -> Result<String, String> {
    match provider.trim().to_lowercase().as_str() {
        "claude" => {
            let api_key = required_key(CLAUDE_KEY)?;
            claude_test_connection(&api_key).await
        }
        "openai" => {
            let api_key = required_key(OPENAI_KEY)?;
            openai_test_connection(&api_key).await
        }
        "ollama" => ollama_test_connection(default_endpoint()).await,
        other => Err(format!("Unbekannter KI-Provider: {other}")),
    }
}

#[tauri::command]
pub async fn ai_list_ollama_models(endpoint: Option<String>) -> Result<Vec<String>, String> {
    let endpoint = endpoint.unwrap_or_else(|| default_endpoint().to_string());
    ollama_list_models(&endpoint).await
}

#[tauri::command]
pub fn ai_estimate_cost(
    provider: String,
    model: String,
    tokens_input: u32,
    tokens_output: u32,
) -> f64 {
    estimate_cost_eur(&provider, &model, tokens_input, tokens_output)
}

async fn generate(
    provider: String,
    system_prompt: String,
    user_prompt: String,
    max_tokens: Option<u32>,
    temperature: Option<f32>,
    model: Option<String>,
    json_mode: bool,
) -> Result<AIResponse, String> {
    let request = AIRequest {
        system_prompt,
        user_prompt,
        max_tokens,
        temperature,
        json_mode,
        model,
    };

    match provider.trim().to_lowercase().as_str() {
        "claude" => {
            let api_key = required_key(CLAUDE_KEY)?;
            claude_generate(&api_key, &request).await
        }
        "openai" => {
            let api_key = required_key(OPENAI_KEY)?;
            openai_generate(&api_key, &request).await
        }
        "ollama" => ollama_generate(default_endpoint(), &request).await,
        other => Err(format!("Unbekannter KI-Provider: {other}")),
    }
}

fn required_key(key: &str) -> Result<String, String> {
    keychain_get_secret(KEYCHAIN_SERVICE, key)?
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| format!("API-Key fehlt im Keychain: {key}"))
}
