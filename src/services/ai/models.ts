/**
 * Zentrale Registry aller KI-Modelle pro Provider (Stand: Juli 2026).
 *
 * Einzige Quelle fuer Modell-Dropdowns, Defaults und die Migration
 * abgeschalteter Modelle. Rust-seitige Fallbacks (src-tauri/src/ai/*)
 * muessen zu den Defaults hier passen.
 */

export type AIModelProvider = 'claude' | 'openai' | 'gemini' | 'ollama';

export interface AIModelOption {
  value: string;
  label: string;
}

export const CLAUDE_MODELS: AIModelOption[] = [
  { value: 'claude-sonnet-5', label: 'Claude Sonnet 5 — empfohlen' },
  { value: 'claude-opus-4-8', label: 'Claude Opus 4.8 — leistungsstärkstes Modell' },
  { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — schnell & günstig' },
];

export const OPENAI_MODELS: AIModelOption[] = [
  { value: 'gpt-5.4', label: 'GPT-5.4 — empfohlen' },
  { value: 'gpt-5.5', label: 'GPT-5.5 — leistungsstärkstes Modell' },
  { value: 'gpt-5.4-mini', label: 'GPT-5.4 Mini — schnell & günstig' },
  { value: 'gpt-4o', label: 'GPT-4o — Legacy, weiterhin verfügbar' },
];

export const GEMINI_MODELS: AIModelOption[] = [
  { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash — empfohlen' },
  { value: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro — stärkstes Reasoning' },
  { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite — günstig, z.B. Klassifikation' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash — stabil, weiterhin verfügbar' },
];

export const OLLAMA_MODEL_SUGGESTIONS = ['llama3', 'mistral', 'phi3'];

export const DEFAULT_MODELS: Record<AIModelProvider, string> = {
  claude: 'claude-sonnet-5',
  openai: 'gpt-5.4',
  gemini: 'gemini-3.5-flash',
  ollama: 'llama3',
};

/** Von Anthropic abgeschaltete bzw. zurueckgezogene Modelle -> Nachfolger. */
const RETIRED_CLAUDE_MODELS: Record<string, string> = {
  'claude-sonnet-4-20250514': 'claude-sonnet-5',
  'claude-3-7-sonnet-20250219': 'claude-sonnet-5',
  'claude-3-5-sonnet-20241022': 'claude-sonnet-5',
  'claude-3-5-sonnet-20240620': 'claude-sonnet-5',
  'claude-opus-4-20250514': 'claude-opus-4-8',
  'claude-3-opus-20240229': 'claude-opus-4-8',
  'claude-3-5-haiku-20241022': 'claude-haiku-4-5',
  'claude-3-haiku-20240307': 'claude-haiku-4-5',
};

/** Von OpenAI zurueckgezogene bzw. abgeloeste Modelle -> Nachfolger. */
const RETIRED_OPENAI_MODELS: Record<string, string> = {
  'gpt-4.5-preview': 'gpt-5.4',
  'gpt-5': 'gpt-5.4',
  'gpt-5.1': 'gpt-5.4',
  'gpt-5.2': 'gpt-5.4',
};

/** Google hat alle Gemini-1.x- und 2.0-Modelle abgeschaltet (Juni 2026). */
function isRetiredGeminiModel(model: string): boolean {
  return model.startsWith('gemini-1.') || model.startsWith('gemini-2.0');
}

/**
 * Loest ein gespeichertes Modell-Setting auf: leere Werte fallen auf den
 * Provider-Default zurueck, abgeschaltete Modelle werden auf ihren
 * Nachfolger migriert (statt spaeter mit 404 zu scheitern). Unbekannte,
 * manuell eingetragene Modelle bleiben unangetastet.
 */
export function resolvePreferredModel(
  provider: AIModelProvider,
  model: string | null | undefined,
): string {
  const trimmed = model?.trim();
  if (!trimmed) return DEFAULT_MODELS[provider];

  if (provider === 'gemini' && isRetiredGeminiModel(trimmed)) return DEFAULT_MODELS.gemini;
  if (provider === 'claude' && trimmed in RETIRED_CLAUDE_MODELS) {
    return RETIRED_CLAUDE_MODELS[trimmed];
  }
  if (provider === 'openai' && trimmed in RETIRED_OPENAI_MODELS) {
    return RETIRED_OPENAI_MODELS[trimmed];
  }

  return trimmed;
}

/**
 * Baut die `items`-Map fuer das Select (Wert -> Label). Ein unbekanntes,
 * manuell gepflegtes Modell wird als eigener Eintrag ergaenzt, damit das
 * Select den aktuellen Wert anzeigen kann.
 */
export function modelSelectItems(
  models: AIModelOption[],
  currentValue: string,
): Record<string, string> {
  const items: Record<string, string> = {};
  for (const model of models) {
    items[model.value] = model.label;
  }
  if (currentValue && !(currentValue in items)) {
    items[currentValue] = currentValue;
  }
  return items;
}
