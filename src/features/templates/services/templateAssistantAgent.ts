import { aiEstimateCost, aiGenerateText } from '@/features/ai-assistant/services/aiService';
import { checkBudget, logAIJob } from '@/features/ai-assistant/services/costTracker';
import {
  loadBrandSettings,
  type BrandSettings,
} from '@/features/ai-assistant/services/promptBuilder';
import { getAIProviderFallbackChain, useAIStore } from '@/features/ai-assistant/stores/aiStore';
import type {
  AIDiffResult,
  AIProviderName,
  AIResponse,
  TemplateAction,
} from '@/features/ai-assistant/types';
import type { TemplatePlatform } from '../schemas';

const VARIABLE_RULE =
  'WICHTIG: Alle Platzhaltervariablen im Format {{variablenname}} müssen EXAKT erhalten bleiben. Ändere, entferne oder ergänze niemals {{...}}-Platzhalter.';

const PLATFORM_LABELS: Record<TemplatePlatform, string> = {
  etsy: 'Etsy',
  ebay: 'eBay',
  kleinanzeigen: 'Kleinanzeigen',
};

function extractPlaceholders(content: string): string[] {
  return Array.from(new Set(content.match(/\{\{[^}]+\}\}/g) ?? []));
}

function cleanResponse(text: string): string {
  return text
    .trim()
    .replace(/^```(?:text|markdown)?/i, '')
    .replace(/```$/i, '')
    .trim();
}

function ensurePlaceholdersPreserved(original: string, suggested: string): void {
  const originalPlaceholders = extractPlaceholders(original);
  const suggestedPlaceholders = extractPlaceholders(suggested);
  const missing = originalPlaceholders.filter((item) => !suggestedPlaceholders.includes(item));
  const added = suggestedPlaceholders.filter((item) => !originalPlaceholders.includes(item));

  if (missing.length > 0 || added.length > 0) {
    throw new Error(
      [
        'KI-Vorschlag verworfen: Platzhaltervariablen wurden verändert.',
        missing.length > 0 ? `Fehlt: ${missing.join(', ')}` : '',
        added.length > 0 ? `Neu: ${added.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join(' '),
    );
  }
}

function buildTemplateSystemPrompt(brand: BrandSettings): string {
  return [
    'Du bist der Template Assistant fuer PolyGrid Studio, ein deutsches 3D-Druck-Einzelunternehmen.',
    'Bearbeite Vorlagentexte fuer Kundenkommunikation, Rechtstexte und Plattformtexte.',
    'Gib ausschliesslich den finalen Text aus, ohne Markdown-Einleitung und ohne Erklaerung.',
    VARIABLE_RULE,
    `Schreibstil: ${brand.writingStyle}.`,
    brand.preferredWords.length > 0
      ? `Bevorzugte Begriffe: ${brand.preferredWords.join(', ')}.`
      : '',
    brand.forbiddenPhrases.length > 0
      ? `Verbotene Formulierungen: ${brand.forbiddenPhrases.join(', ')}.`
      : '',
    brand.referenceText ? `Referenztext fuer Tonalitaet: ${brand.referenceText}` : '',
  ]
    .filter(Boolean)
    .join('\n');
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

async function runTemplateCall(params: {
  action: TemplateAction;
  currentContent: string;
  userPrompt: string;
  brand?: BrandSettings;
}): Promise<{ response: AIResponse; provider: AIProviderName; jobId: string; suggested: string }> {
  let lastError: unknown = null;
  const providers = getAIProviderFallbackChain();
  const brand = params.brand ?? (await loadBrandSettings());
  const systemPrompt = buildTemplateSystemPrompt(brand);

  if (providers.length === 0) {
    throw new Error('Kein KI-Provider verfügbar. Bitte in den Einstellungen konfigurieren.');
  }

  for (const provider of providers) {
    try {
      await ensureBudget(provider);
      const response = await aiGenerateText(provider, systemPrompt, params.userPrompt, {
        temperature: 0.25,
        maxTokens: 2200,
      });
      const suggested = cleanResponse(response.text);
      ensurePlaceholdersPreserved(params.currentContent, suggested);

      const estimatedCost = await aiEstimateCost(
        response.provider,
        response.model,
        response.tokensInput,
        response.tokensOutput,
      );
      const jobId = await logAIJob({
        provider,
        model: response.model,
        agent: 'template_assistant',
        action: params.action,
        input: params.userPrompt,
        output: suggested,
        tokensUsed: response.tokensInput + response.tokensOutput,
        durationMs: response.durationMs,
        status: 'success',
        estimatedCost,
      });
      await useAIStore.getState().refreshBudget();
      return { response, provider, jobId, suggested };
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
          agent: 'template_assistant',
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

async function createTemplateDiff(params: {
  action: TemplateAction;
  currentContent: string;
  userPrompt: string;
  brand?: BrandSettings;
}): Promise<AIDiffResult> {
  const { response, provider, jobId, suggested } = await runTemplateCall(params);

  return {
    agent: 'template_assistant',
    action: params.action,
    provider,
    model: response.model,
    jobId,
    fields: [
      {
        fieldName: 'content',
        fieldLabel: 'Vorlagentext',
        currentValue: params.currentContent,
        suggestedValue: suggested,
      },
    ],
  };
}

export async function shortenText(content: string): Promise<AIDiffResult> {
  return createTemplateDiff({
    action: 'shorten_text',
    currentContent: content,
    userPrompt: [
      'Kuerze den folgenden Vorlagentext auf ungefaehr 50 Prozent der Laenge.',
      'Erhalte alle konkreten Informationen, Tonalitaet und alle Platzhalter exakt.',
      'Gib nur den gekuerzten Text aus.',
      '',
      content,
    ].join('\n'),
  });
}

export async function expandText(content: string): Promise<AIDiffResult> {
  return createTemplateDiff({
    action: 'expand_text',
    currentContent: content,
    userPrompt: [
      'Erweitere den folgenden Vorlagentext sinnvoll und praxisnah.',
      'Ergaenze hilfreiche Details, ohne neue Fakten zu erfinden. Erhalte alle Platzhalter exakt.',
      'Gib nur den erweiterten Text aus.',
      '',
      content,
    ].join('\n'),
  });
}

export async function reformulateText(
  content: string,
  brandSettings?: BrandSettings,
): Promise<AIDiffResult> {
  const brand = brandSettings ?? (await loadBrandSettings());

  return createTemplateDiff({
    action: 'reformulate_text',
    currentContent: content,
    brand,
    userPrompt: [
      'Formuliere den folgenden Vorlagentext im Brand-Stil um.',
      `Schreibstil: ${brand.writingStyle}.`,
      brand.preferredWords.length > 0
        ? `Bevorzugte Begriffe: ${brand.preferredWords.join(', ')}.`
        : '',
      brand.forbiddenPhrases.length > 0
        ? `Verbotene Formulierungen vermeiden: ${brand.forbiddenPhrases.join(', ')}.`
        : '',
      'Erhalte Bedeutung, Fakten und alle Platzhalter exakt. Gib nur den umformulierten Text aus.',
      '',
      content,
    ]
      .filter(Boolean)
      .join('\n'),
  });
}

export async function adaptForPlatform(
  content: string,
  targetPlatform: TemplatePlatform,
): Promise<AIDiffResult> {
  return createTemplateDiff({
    action: 'adapt_for_platform',
    currentContent: content,
    userPrompt: [
      `Passe den folgenden Vorlagentext fuer ${PLATFORM_LABELS[targetPlatform]} an.`,
      'Beruecksichtige typische Tonalitaet, Laenge und Format der Plattform.',
      'Erhalte Bedeutung, Fakten und alle Platzhalter exakt. Gib nur den angepassten Text aus.',
      '',
      content,
    ].join('\n'),
  });
}
