import { invoke } from '@tauri-apps/api/core';
import { z } from 'zod';
import { getDatabase, getSetting } from '@/services/database';
import { loadBrandSettings } from '@/features/ai-assistant/services/promptBuilder';
import { taskPriorityEnum, type TaskPriority } from '../schemas';

const AI_PROVIDER_KEYS = ['ai_preferred_provider', 'active_ai_provider', 'ai_active_provider'];

export const taskSuggestionSchema = z.array(
  z.object({
    title: z.string().trim().min(1).max(100),
    priority: taskPriorityEnum,
    due_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    description: z.string().trim().optional(),
  }),
);

export type TaskSuggestion = z.infer<typeof taskSuggestionSchema>[number];

interface RawAIResponse {
  text?: string;
  tokens_input?: number;
  tokensInput?: number;
  tokens_output?: number;
  tokensOutput?: number;
  model?: string;
  provider?: string;
  duration_ms?: number;
  durationMs?: number;
}

interface AIJobLogInput {
  provider: string;
  model: string;
  input: string;
  output: string | null;
  tokensUsed: number | null;
  durationMs: number | null;
  status: 'success' | 'error';
  errorMessage: string | null;
}

async function buildSystemPrompt(): Promise<string> {
  const brand = await loadBrandSettings();
  return [
    `Berücksichtige die Brand-Sprache: ${brand.writingStyle}.`,
    brand.preferredWords.length > 0
      ? `Bevorzugte Formulierungen: ${brand.preferredWords.join(', ')}.`
      : '',
    brand.forbiddenPhrases.length > 0
      ? `Verbotene Formulierungen/Wörter: ${brand.forbiddenPhrases.join(', ')}.`
      : '',
    brand.referenceText ? `Stilreferenz: ${brand.referenceText}` : '',
    'Du extrahierst konkrete, actionable Aufgaben aus dem folgenden Text.',
    'Pro Aufgabe: Titel (kurz, max 100 Zeichen), Priorität (low/medium/high/urgent), optionales Fälligkeitsdatum (ISO-Format YYYY-MM-DD), optionale Beschreibung.',
    'Ignoriere allgemeine Aussagen die keine Handlungsaufforderung enthalten.',
    'Antworte ausschließlich als JSON-Array.',
  ]
    .filter(Boolean)
    .join(' ');
}

function buildUserPrompt(text: string): string {
  return `Extrahiere Aufgaben aus diesem Text:\n\n${text.trim()}`;
}

function normalizeJsonText(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1]?.trim() ?? trimmed;
}

async function getConfiguredProvider(): Promise<string | null> {
  for (const key of AI_PROVIDER_KEYS) {
    const provider = await getSetting<string>(key);
    if (provider && provider.trim().length > 0) {
      return provider;
    }
  }
  return null;
}

async function logAIJob(input: AIJobLogInput): Promise<void> {
  try {
    await getDatabase().execute(
      `INSERT INTO ai_jobs (
         id, provider, model, agent, action, input, output, tokens_used,
         duration_ms, status, error_message, estimated_cost, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        crypto.randomUUID(),
        input.provider,
        input.model,
        'task_extractor',
        'extractTasks',
        input.input,
        input.output,
        input.tokensUsed,
        input.durationMs,
        input.status,
        input.errorMessage,
        null,
        new Date().toISOString(),
      ],
    );
  } catch (error) {
    throw new Error(
      `KI-Job konnte nicht protokolliert werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function isTaskExtractorAvailable(): Promise<boolean> {
  try {
    return (await getConfiguredProvider()) !== null;
  } catch {
    return false;
  }
}

export async function extractTasks(text: string): Promise<TaskSuggestion[]> {
  const inputText = text.trim();
  if (inputText.length === 0) {
    throw new Error('Bitte gib zuerst Text ein, aus dem Aufgaben extrahiert werden sollen.');
  }

  const provider = await getConfiguredProvider();
  const systemPrompt = await buildSystemPrompt();
  const userPrompt = buildUserPrompt(inputText);
  const logInput = JSON.stringify({ systemPrompt, userPrompt });

  if (!provider) {
    await logAIJob({
      provider: 'none',
      model: 'none',
      input: logInput,
      output: null,
      tokensUsed: null,
      durationMs: null,
      status: 'error',
      errorMessage: 'Kein KI-Provider konfiguriert.',
    });
    throw new Error('Kein KI-Provider konfiguriert. Bitte richte zuerst einen Provider ein.');
  }

  try {
    const response = await invoke<RawAIResponse>('ai_generate_structured', {
      provider,
      system_prompt: systemPrompt,
      user_prompt: userPrompt,
      max_tokens: 1200,
      temperature: 0.1,
      model: null,
    });

    const responseText = response.text?.trim();
    if (!responseText) {
      throw new Error('KI hat keine Antwort generiert. Bitte erneut versuchen.');
    }

    const parsedJson = JSON.parse(normalizeJsonText(responseText)) as unknown;
    const suggestions = taskSuggestionSchema.parse(parsedJson);
    const tokensUsed =
      (response.tokens_input ?? response.tokensInput ?? 0) +
      (response.tokens_output ?? response.tokensOutput ?? 0);

    await logAIJob({
      provider: response.provider ?? provider,
      model: response.model ?? 'unknown',
      input: logInput,
      output: responseText,
      tokensUsed,
      durationMs: response.duration_ms ?? response.durationMs ?? null,
      status: 'success',
      errorMessage: null,
    });

    return suggestions;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logAIJob({
      provider,
      model: 'unknown',
      input: logInput,
      output: null,
      tokensUsed: null,
      durationMs: null,
      status: 'error',
      errorMessage: message,
    });
    throw new Error(`Aufgaben konnten nicht per KI extrahiert werden: ${message}`);
  }
}

export const TASK_EXTRACTOR_PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];
