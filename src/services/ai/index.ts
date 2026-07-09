// GEMINI_MODELS (AIModelOption[]) kommt aus der zentralen Registry;
// providers/gemini.ts exportiert zusätzlich eine reine String-Liste
// gleichen Namens für Tests – hier nicht re-exportieren (Namenskollision).
export { GeminiProvider, normalizeGeminiModel } from './providers/gemini';
export type { AIOptions, AIProvider } from './providers/gemini';
export {
  CLAUDE_MODELS,
  DEFAULT_MODELS,
  GEMINI_MODELS,
  OLLAMA_MODEL_SUGGESTIONS,
  OPENAI_MODELS,
  modelSelectItems,
  resolvePreferredModel,
} from './models';
export type { AIModelOption, AIModelProvider } from './models';
