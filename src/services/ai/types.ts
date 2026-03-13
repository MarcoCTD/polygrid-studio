import type { ZodSchema } from "zod";

export interface AIOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  model?: string;
}

export interface AIResponse {
  text: string;
  tokensUsed?: number;
  model: string;
  durationMs: number;
}

export interface AIProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  generateText(prompt: string, options?: AIOptions): Promise<AIResponse>;
  generateStructured<T>(prompt: string, schema: ZodSchema<T>, options?: AIOptions): Promise<T>;
}
