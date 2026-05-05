use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AIRequest {
    pub system_prompt: String,
    pub user_prompt: String,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
    pub json_mode: bool,
    pub model: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AIResponse {
    pub text: String,
    pub tokens_input: u32,
    pub tokens_output: u32,
    pub model: String,
    pub provider: String,
    pub duration_ms: u64,
}

#[derive(Debug, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct AIError {
    pub code: String,
    pub message: String,
}
