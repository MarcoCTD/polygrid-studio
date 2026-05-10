import { invoke } from '@tauri-apps/api/core';
import type { ZodSchema } from 'zod';
import type { AIResponse } from '@/features/ai-assistant/types';

export const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-pro',
] as const;

export interface AIOptions {
  maxTokens?: number;
  temperature?: number;
  model?: (typeof GEMINI_MODELS)[number] | string;
  systemPrompt?: string;
}

export interface AIProvider {
  name: 'gemini';
  isAvailable(): Promise<boolean>;
  generateText(prompt: string, options?: AIOptions): Promise<AIResponse>;
  generateStructured<T>(prompt: string, schema: ZodSchema<T>, options?: AIOptions): Promise<T>;
}

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

function cleanJson(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

export class GeminiProvider implements AIProvider {
  name = 'gemini' as const;

  async isAvailable(): Promise<boolean> {
    try {
      await invoke<string>('ai_test_connection', { provider: this.name });
      return true;
    } catch {
      return false;
    }
  }

  async generateText(prompt: string, options?: AIOptions): Promise<AIResponse> {
    const response = await invoke<RustAIResponse>('ai_generate_text', {
      provider: this.name,
      system_prompt: options?.systemPrompt ?? '',
      user_prompt: prompt,
      max_tokens: options?.maxTokens ?? null,
      temperature: options?.temperature ?? null,
      model: options?.model ?? GEMINI_MODELS[0],
    });
    return toAIResponse(response);
  }

  async generateStructured<T>(
    prompt: string,
    schema: ZodSchema<T>,
    options?: AIOptions,
  ): Promise<T> {
    const response = await invoke<RustAIResponse>('ai_generate_structured', {
      provider: this.name,
      system_prompt: options?.systemPrompt ?? '',
      user_prompt: `${prompt}\n\nAntworte ausschließlich mit gültigem JSON.`,
      max_tokens: options?.maxTokens ?? null,
      temperature: options?.temperature ?? null,
      model: options?.model ?? GEMINI_MODELS[0],
    });

    return schema.parse(JSON.parse(cleanJson(response.text)));
  }
}
