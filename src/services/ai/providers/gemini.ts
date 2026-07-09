import { invoke } from '@tauri-apps/api/core';
import type { ZodSchema } from 'zod';
import type { AIResponse } from '@/features/ai-assistant/types';
import { GEMINI_MODELS as GEMINI_MODEL_OPTIONS, resolvePreferredModel } from '../models';

/** Reine String-Liste der aktuellen Gemini-Modelle (aus der zentralen Registry). */
export const GEMINI_MODELS = GEMINI_MODEL_OPTIONS.map((option) => option.value);

/**
 * Migriert veraltete gespeicherte Gemini-Modellnamen auf aktuell verfügbare
 * Modelle, bevor sie in einen Request oder die UI gelangen. Gemini 1.5/2.0
 * sind im Free Tier abgeschaltet (HTTP 429, limit: 0); "gemini-3.1-pro"
 * existiert in der API nur als "gemini-3.1-pro-preview" (sonst HTTP 404).
 * Dünner Wrapper um die zentrale Registry; das Mapping dort muss mit
 * normalize_model in src-tauri/src/ai/gemini.rs übereinstimmen.
 */
export function normalizeGeminiModel(model: string | null | undefined): string {
  return resolvePreferredModel('gemini', model);
}

export interface AIOptions {
  maxTokens?: number;
  temperature?: number;
  model?: string;
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
  lastError: string | null = null;

  async isAvailable(): Promise<boolean> {
    try {
      this.lastError = null;
      const key = await invoke<string | null>('get_api_key', { provider: this.name });
      if (!key?.trim()) {
        this.lastError = 'Kein API-Key konfiguriert';
        return false;
      }
      await invoke<string>('ai_test_connection', { provider: this.name });
      return true;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      return false;
    }
  }

  async generateText(prompt: string, options?: AIOptions): Promise<AIResponse> {
    // Tauri 2 erwartet invoke-Argumente in camelCase (siehe andere Commands).
    const response = await invoke<RustAIResponse>('ai_generate_text', {
      provider: this.name,
      systemPrompt: options?.systemPrompt ?? '',
      userPrompt: prompt,
      maxTokens: options?.maxTokens ?? null,
      temperature: options?.temperature ?? null,
      model: normalizeGeminiModel(options?.model),
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
      systemPrompt: options?.systemPrompt ?? '',
      userPrompt: `${prompt}\n\nAntworte ausschließlich mit gültigem JSON.`,
      maxTokens: options?.maxTokens ?? null,
      temperature: options?.temperature ?? null,
      model: normalizeGeminiModel(options?.model),
    });

    return schema.parse(JSON.parse(cleanJson(response.text)));
  }
}
