import { invoke } from '@tauri-apps/api/core';
import { resolvePreferredModel } from '@/services/ai';
import { DEFAULTS, getSettingWithDefault } from '@/services/settings';
import type { AIOptions, AIProviderName, AIResponse } from '../types';

const KEYCHAIN_SERVICE = 'polygrid-studio';
const AI_TIMEOUT_MS = 30_000;

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

async function preferredModel(
  provider: AIProviderName,
  explicitModel?: string,
): Promise<string | null> {
  // Abgeschaltete Modelle werden beim Lesen auf den Nachfolger migriert,
  // damit Requests nicht mit 404 scheitern.
  if (explicitModel) return resolvePreferredModel(provider, explicitModel);
  if (provider === 'claude') {
    return resolvePreferredModel('claude', await getSettingWithDefault('ai_preferred_model_claude'));
  }
  if (provider === 'openai') {
    return resolvePreferredModel('openai', await getSettingWithDefault('ai_preferred_model_openai'));
  }
  if (provider === 'gemini') {
    return resolvePreferredModel('gemini', await getSettingWithDefault('ai_preferred_model_gemini'));
  }
  if (provider === 'ollama') {
    return getSettingWithDefault('ai_preferred_model_ollama', DEFAULTS.ai_preferred_model_ollama);
  }
  return null;
}

async function commandArgs(
  provider: AIProviderName,
  systemPrompt: string,
  userPrompt: string,
  options?: AIOptions,
): Promise<Record<string, unknown>> {
  return {
    provider,
    system_prompt: systemPrompt,
    user_prompt: userPrompt,
    max_tokens: options?.maxTokens ?? null,
    temperature: options?.temperature ?? null,
    model: await preferredModel(provider, options?.model),
  };
}

function normalizeAIError(provider: string, error: unknown): Error {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const message = rawMessage.toLowerCase();

  if (message.includes('timeout') || message.includes('zeit')) {
    return new Error('KI-Vorschlag konnte nicht generiert werden: Timeout');
  }
  if (message.includes('401') || message.includes('403') || message.includes('unauthorized')) {
    return new Error('KI-Verbindung fehlgeschlagen: API-Key ungültig');
  }
  if (message.includes('429') || message.includes('rate limit')) {
    return new Error('KI-Verbindung fehlgeschlagen: Rate Limit erreicht, bitte warten');
  }
  if (message.includes('500') || message.includes('503') || message.includes('unavailable')) {
    return new Error('KI-Verbindung fehlgeschlagen: Provider nicht erreichbar');
  }
  if (provider === 'ollama') {
    return new Error('Ollama ist nicht erreichbar. Ist Ollama installiert und gestartet?');
  }
  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('internet') ||
    message.includes('connection')
  ) {
    return new Error('KI-Verbindung fehlgeschlagen: Keine Internetverbindung');
  }

  return new Error(rawMessage || 'KI-Verbindung fehlgeschlagen');
}

async function invokeWithTimeout<T>(
  command: string,
  args: Record<string, unknown>,
  provider = 'unknown',
): Promise<T> {
  let timeoutId: number | undefined;
  try {
    return await Promise.race([
      invoke<T>(command, args),
      new Promise<T>((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error('Timeout')), AI_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    throw normalizeAIError(provider, error);
  } finally {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  }
}

function ensureNonEmptyResponse(response: AIResponse): AIResponse {
  if (!response.text.trim()) {
    throw new Error('KI hat keine Antwort generiert. Bitte erneut versuchen.');
  }
  return response;
}

export async function aiGenerateText(
  provider: AIProviderName,
  systemPrompt: string,
  userPrompt: string,
  options?: AIOptions,
): Promise<AIResponse> {
  const response = await invokeWithTimeout<RustAIResponse>(
    'ai_generate_text',
    await commandArgs(provider, systemPrompt, userPrompt, options),
    provider,
  );
  return ensureNonEmptyResponse(toAIResponse(response));
}

export async function aiGenerateStructured(
  provider: AIProviderName,
  systemPrompt: string,
  userPrompt: string,
  options?: AIOptions,
): Promise<AIResponse> {
  const response = await invokeWithTimeout<RustAIResponse>(
    'ai_generate_structured',
    await commandArgs(provider, systemPrompt, userPrompt, options),
    provider,
  );
  return ensureNonEmptyResponse(toAIResponse(response));
}

export async function aiTestConnection(provider: AIProviderName): Promise<string> {
  return invokeWithTimeout<string>('ai_test_connection', { provider }, provider);
}

export async function aiListOllamaModels(endpoint?: string): Promise<string[]> {
  return invokeWithTimeout<string[]>(
    'ai_list_ollama_models',
    { endpoint: endpoint ?? null },
    'ollama',
  );
}

export async function keychainSet(key: string, value: string): Promise<void> {
  await invokeWithTimeout('keychain_set', { service: KEYCHAIN_SERVICE, key, value });
}

export async function keychainGet(key: string): Promise<string | null> {
  return invokeWithTimeout<string | null>('keychain_get', { service: KEYCHAIN_SERVICE, key });
}

export async function keychainDelete(key: string): Promise<void> {
  await invokeWithTimeout('keychain_delete', { service: KEYCHAIN_SERVICE, key });
}

export async function apiKeySet(provider: AIProviderName, key: string): Promise<void> {
  await invokeWithTimeout('set_api_key', { provider, key }, provider);
}

export async function apiKeyGet(provider: AIProviderName): Promise<string | null> {
  return invokeWithTimeout<string | null>('get_api_key', { provider }, provider);
}

export async function apiKeyDelete(provider: AIProviderName): Promise<void> {
  await invokeWithTimeout('delete_api_key', { provider }, provider);
}

export async function aiEstimateCost(
  provider: string,
  model: string,
  tokensInput: number,
  tokensOutput: number,
): Promise<number> {
  return invokeWithTimeout<number>('ai_estimate_cost', {
    provider,
    model,
    tokens_input: tokensInput,
    tokens_output: tokensOutput,
  });
}
