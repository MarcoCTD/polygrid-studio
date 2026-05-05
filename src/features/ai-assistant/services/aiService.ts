import { invoke } from '@tauri-apps/api/core';
import type { AIOptions, AIProviderName, AIResponse } from '../types';

const KEYCHAIN_SERVICE = 'polygrid-studio';

interface RustAIResponse {
  text: string;
  tokens_input?: number;
  tokensInput?: number;
  tokens_output?: number;
  tokensOutput?: number;
  model: string;
  provider: string;
  duration_ms?: number;
  durationMs?: number;
}

function toAIResponse(response: RustAIResponse): AIResponse {
  return {
    text: response.text,
    tokensInput: response.tokens_input ?? response.tokensInput ?? 0,
    tokensOutput: response.tokens_output ?? response.tokensOutput ?? 0,
    model: response.model,
    provider: response.provider,
    durationMs: response.duration_ms ?? response.durationMs ?? 0,
  };
}

function commandArgs(provider: AIProviderName, systemPrompt: string, userPrompt: string, options?: AIOptions) {
  return {
    provider,
    system_prompt: systemPrompt,
    user_prompt: userPrompt,
    max_tokens: options?.maxTokens ?? null,
    temperature: options?.temperature ?? null,
    model: options?.model ?? null,
  };
}

export async function aiGenerateText(
  provider: AIProviderName,
  systemPrompt: string,
  userPrompt: string,
  options?: AIOptions,
): Promise<AIResponse> {
  const response = await invoke<RustAIResponse>(
    'ai_generate_text',
    commandArgs(provider, systemPrompt, userPrompt, options),
  );
  return toAIResponse(response);
}

export async function aiGenerateStructured(
  provider: AIProviderName,
  systemPrompt: string,
  userPrompt: string,
  options?: AIOptions,
): Promise<AIResponse> {
  const response = await invoke<RustAIResponse>(
    'ai_generate_structured',
    commandArgs(provider, systemPrompt, userPrompt, options),
  );
  return toAIResponse(response);
}

export async function aiTestConnection(provider: AIProviderName): Promise<string> {
  return invoke<string>('ai_test_connection', { provider });
}

export async function aiListOllamaModels(endpoint?: string): Promise<string[]> {
  return invoke<string[]>('ai_list_ollama_models', { endpoint: endpoint ?? null });
}

export async function keychainSet(key: string, value: string): Promise<void> {
  await invoke('keychain_set', { service: KEYCHAIN_SERVICE, key, value });
}

export async function keychainGet(key: string): Promise<string | null> {
  return invoke<string | null>('keychain_get', { service: KEYCHAIN_SERVICE, key });
}

export async function keychainDelete(key: string): Promise<void> {
  await invoke('keychain_delete', { service: KEYCHAIN_SERVICE, key });
}

export async function aiEstimateCost(
  provider: string,
  model: string,
  tokensInput: number,
  tokensOutput: number,
): Promise<number> {
  return invoke<number>('ai_estimate_cost', {
    provider,
    model,
    tokens_input: tokensInput,
    tokens_output: tokensOutput,
  });
}
