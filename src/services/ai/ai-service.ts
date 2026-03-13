import type { AIProvider, AIOptions, AIResponse } from "./types";
import type { ZodSchema } from "zod";
import { getDb, now } from "@/services/database/db";

/**
 * AI Service — generic abstraction layer over all providers.
 * No provider should be used directly in business logic.
 */
class AIService {
  private providers: Map<string, AIProvider> = new Map();
  private activeProvider: string | null = null;

  registerProvider(provider: AIProvider): void {
    this.providers.set(provider.name, provider);
  }

  setActiveProvider(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`AI provider "${name}" is not registered`);
    }
    this.activeProvider = name;
  }

  getActiveProvider(): AIProvider | null {
    if (!this.activeProvider) return null;
    return this.providers.get(this.activeProvider) ?? null;
  }

  getProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  async generateText(
    prompt: string,
    agent: string,
    action: string,
    options?: AIOptions
  ): Promise<AIResponse> {
    const provider = this.getActiveProvider();
    if (!provider) throw new Error("No AI provider configured");

    const jobId = crypto.randomUUID();
    const ts = now();

    // Log job start
    try {
      const db = await getDb();
      await db.execute(
        `INSERT INTO ai_jobs (id, created_at, updated_at, provider, model, agent, action, input_data, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'running')`,
        [jobId, ts, ts, provider.name, options?.model ?? "default", agent, action, JSON.stringify({ prompt })]
      );
    } catch {
      // Non-critical: job logging failure shouldn't block generation
    }

    const startTime = Date.now();

    try {
      const response = await provider.generateText(prompt, options);
      const durationMs = Date.now() - startTime;

      // Log success
      try {
        const db = await getDb();
        await db.execute(
          `UPDATE ai_jobs SET status = 'completed', output_data = ?, tokens_used = ?, duration_ms = ?, updated_at = ? WHERE id = ?`,
          [JSON.stringify({ text: response.text }), response.tokensUsed ?? null, durationMs, now(), jobId]
        );
      } catch {
        // Non-critical
      }

      return { ...response, durationMs };
    } catch (err) {
      // Log failure
      try {
        const db = await getDb();
        await db.execute(
          `UPDATE ai_jobs SET status = 'failed', error_message = ?, duration_ms = ?, updated_at = ? WHERE id = ?`,
          [String(err), Date.now() - startTime, now(), jobId]
        );
      } catch {
        // Non-critical
      }
      throw err;
    }
  }

  async generateStructured<T>(
    prompt: string,
    schema: ZodSchema<T>,
    _agent: string,
    _action: string,
    options?: AIOptions
  ): Promise<T> {
    const provider = this.getActiveProvider();
    if (!provider) throw new Error("No AI provider configured");

    return provider.generateStructured(prompt, schema, options);
  }
}

// Singleton instance
export const aiService = new AIService();
