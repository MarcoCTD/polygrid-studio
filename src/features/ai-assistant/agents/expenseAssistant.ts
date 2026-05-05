import { aiEstimateCost, aiGenerateStructured, aiGenerateText } from '../services/aiService';
import { checkBudget, logAIJob } from '../services/costTracker';
import { buildExpenseSystemPrompt, loadBrandSettings } from '../services/promptBuilder';
import { getAIProviderFallbackChain, useAIStore } from '../stores/aiStore';
import type {
  AIAction,
  AIDiffResult,
  AIProviderName,
  AIResponse,
  DuplicateCheck,
  ExpenseClassification,
} from '../types';

const EXPENSE_CATEGORIES = [
  'Filament',
  'Verpackung',
  'Werkzeuge',
  'Druckerzubehör',
  'Maschinen/Hardware',
  'Software/SaaS',
  'Werbung',
  'Versand',
  'Reisekosten',
  'Büro',
  'Sonstiges',
];

function providerCandidates(preferOllama: boolean): AIProviderName[] {
  return getAIProviderFallbackChain(preferOllama);
}

async function ensureBudget(provider: AIProviderName): Promise<void> {
  if (provider === 'ollama') return;
  const budget = await checkBudget();
  if (budget.isBlocked) {
    throw new Error(
      `KI-Budget erschöpft (${budget.spent.toFixed(2)} / ${budget.limit.toFixed(2)} EUR). Limit in den Einstellungen anpassen oder Ollama nutzen.`,
    );
  }
}

async function runExpenseCall(params: {
  action: AIAction;
  systemPrompt: string;
  userPrompt: string;
  structured: boolean;
  preferOllama?: boolean;
}): Promise<{ response: AIResponse; provider: AIProviderName; jobId: string }> {
  let lastError: unknown = null;
  const providers = providerCandidates(Boolean(params.preferOllama));

  if (providers.length === 0) {
    throw new Error('Kein KI-Provider verfügbar. Bitte in den Einstellungen konfigurieren.');
  }

  for (const provider of providers) {
    try {
      await ensureBudget(provider);
      const response = params.structured
        ? await aiGenerateStructured(provider, params.systemPrompt, params.userPrompt)
        : await aiGenerateText(provider, params.systemPrompt, params.userPrompt);
      const estimatedCost = await aiEstimateCost(
        response.provider,
        response.model,
        response.tokensInput,
        response.tokensOutput,
      );
      const jobId = await logAIJob({
        provider,
        model: response.model,
        agent: 'expense_assistant',
        action: params.action,
        input: params.userPrompt,
        output: response.text,
        tokensUsed: response.tokensInput + response.tokensOutput,
        durationMs: response.durationMs,
        status: 'success',
        estimatedCost,
      });
      await useAIStore.getState().refreshBudget();
      return { response, provider, jobId };
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (
        message.includes('API-Key ungültig') ||
        message.includes('Provider nicht erreichbar') ||
        message.includes('Ollama ist nicht erreichbar') ||
        message.includes('Keine Internetverbindung') ||
        message.includes('Timeout')
      ) {
        useAIStore.getState().markProviderUnavailable(provider);
      }
      try {
        await logAIJob({
          provider,
          model: 'unknown',
          agent: 'expense_assistant',
          action: params.action,
          input: params.userPrompt,
          output: null,
          tokensUsed: null,
          durationMs: null,
          status: 'error',
          errorMessage: message,
          estimatedCost: 0,
        });
      } catch {
        // Logging darf die Fallback-Kette nicht blockieren.
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError ?? 'KI-Aufruf fehlgeschlagen'));
}

function parseClassification(text: string): ExpenseClassification {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  const parsed: unknown = JSON.parse(cleaned);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('KI-Antwort ist kein Klassifikationsobjekt.');
  }
  const record = parsed as Record<string, unknown>;
  const confidence = record.confidence;
  if (
    typeof record.category !== 'string' ||
    typeof record.subcategory !== 'string' ||
    (confidence !== 'high' && confidence !== 'medium' && confidence !== 'low')
  ) {
    throw new Error('KI-Klassifikation hat ein unerwartetes Format.');
  }
  return {
    category: record.category,
    subcategory: record.subcategory,
    confidence,
  };
}

function parseDuplicateCheck(text: string): DuplicateCheck {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  const parsed: unknown = JSON.parse(cleaned);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('KI-Antwort ist kein Duplikatobjekt.');
  }
  const record = parsed as Record<string, unknown>;
  if (typeof record.isDuplicate !== 'boolean') {
    throw new Error('Duplikatantwort hat kein isDuplicate-Boolean.');
  }
  return {
    isDuplicate: record.isDuplicate,
    matchId: typeof record.matchId === 'string' ? record.matchId : undefined,
    reason: typeof record.reason === 'string' ? record.reason : undefined,
  };
}

export async function classifyExpense(
  vendor: string,
  amount: number,
  purpose?: string,
): Promise<AIDiffResult> {
  const brand = await loadBrandSettings();
  const systemPrompt = buildExpenseSystemPrompt(EXPENSE_CATEGORIES, brand);
  const userPrompt = [
    'Klassifiziere diese Ausgabe:',
    `Händler: ${vendor}`,
    `Betrag: ${amount.toFixed(2)} EUR`,
    `Verwendungszweck: ${purpose ?? 'nicht angegeben'}`,
    '',
    `Gültige Kategorien: ${EXPENSE_CATEGORIES.join(', ')}`,
    '',
    'Antworte als JSON: { "category": "...", "subcategory": "...", "confidence": "high|medium|low" }',
  ].join('\n');
  const { response, provider, jobId } = await runExpenseCall({
    action: 'classify_expense',
    systemPrompt,
    userPrompt,
    structured: true,
    preferOllama: true,
  });
  const classification = parseClassification(response.text);

  return {
    agent: 'expense_assistant',
    action: 'classify_expense',
    provider,
    model: response.model,
    jobId,
    fields: [
      {
        fieldName: 'category',
        fieldLabel: 'Kategorie',
        currentValue: null,
        suggestedValue: classification.category,
      },
      {
        fieldName: 'subcategory',
        fieldLabel: 'Unterkategorie',
        currentValue: null,
        suggestedValue: classification.subcategory,
      },
    ],
  };
}

export async function detectDuplicate(
  vendor: string,
  amount: number,
  date: string,
  existingExpenses: Array<{ id: string; vendor: string; amount: number; date: string }>,
): Promise<DuplicateCheck> {
  const brand = await loadBrandSettings();
  const systemPrompt = buildExpenseSystemPrompt(EXPENSE_CATEGORIES, brand);
  const userPrompt = `Prüfe, ob diese Ausgabe ein Duplikat ist: ${JSON.stringify({
    vendor,
    amount,
    date,
  })}. Bestehende Ausgaben: ${JSON.stringify(existingExpenses.slice(0, 50))}. Antworte als JSON: {"isDuplicate":false,"matchId":"optional","reason":"optional"}.`;
  const { response } = await runExpenseCall({
    action: 'detect_duplicate',
    systemPrompt,
    userPrompt,
    structured: true,
    preferOllama: true,
  });
  return parseDuplicateCheck(response.text);
}

export async function suggestPurpose(vendor: string, category: string): Promise<string> {
  const brand = await loadBrandSettings();
  const systemPrompt = buildExpenseSystemPrompt(EXPENSE_CATEGORIES, brand);
  const userPrompt = [
    'Schlage einen kurzen Verwendungszweck vor (max. 50 Zeichen) für:',
    `Händler: ${vendor}, Kategorie: ${category}`,
    'Antworte NUR mit dem Verwendungszweck, ohne Erklärung.',
  ].join('\n');
  const { response } = await runExpenseCall({
    action: 'suggest_purpose',
    systemPrompt,
    userPrompt,
    structured: false,
    preferOllama: true,
  });
  return response.text.trim();
}
