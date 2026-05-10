import { aiEstimateCost, aiGenerateText } from '@/features/ai-assistant/services/aiService';
import { checkBudget, logAIJob } from '@/features/ai-assistant/services/costTracker';
import { loadBrandSettings } from '@/features/ai-assistant/services/promptBuilder';
import { getAIProviderFallbackChain, useAIStore } from '@/features/ai-assistant/stores/aiStore';
import type { AIProviderName, AIResponse } from '@/features/ai-assistant/types';
import type { DashboardAnalysisInput } from '../types';

function formatEUR(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

async function ensureBudget(provider: AIProviderName): Promise<void> {
  if (provider === 'ollama') return;
  const budget = await checkBudget();
  if (budget.isBlocked) {
    throw new Error(
      `KI-Budget erschöpft (${budget.spent.toFixed(2)} / ${budget.limit.toFixed(2)} EUR). Limit in Einstellungen anpassen oder Ollama nutzen.`,
    );
  }
}

function listLines<T>(items: T[], formatter: (item: T) => string, emptyText: string): string {
  return items.length > 0 ? items.map(formatter).join('\n') : emptyText;
}

function buildPrompt(input: DashboardAnalysisInput): string {
  return [
    `Zeitraum: ${input.startDate} bis ${input.endDate}`,
    '',
    'KPIs:',
    `- Umsatz: ${formatEUR(input.kpis.revenueTotal)}`,
    `- Ausgaben: ${formatEUR(input.kpis.expensesTotal)}`,
    `- Durchschnittsmarge: ${
      input.kpis.averageMargin === null ? 'keine Daten' : `${input.kpis.averageMargin.toFixed(1)} %`
    }`,
    '',
    'Top 3 Produkte nach Umsatz:',
    listLines(
      input.topProductsByRevenue,
      (item) => `- ${item.name}: ${formatEUR(item.revenue)}`,
      '- keine Daten',
    ),
    '',
    'Bottom-Produkte nach Marge:',
    listLines(
      input.bottomMarginProducts.slice(0, 3),
      (item) => `- ${item.name}: ${item.estimated_margin.toFixed(1)} %`,
      '- keine Daten',
    ),
    '',
    'Größte Ausgabenkategorien:',
    listLines(
      input.expensesByCategory.slice(0, 5),
      (item) => `- ${item.category}: ${formatEUR(item.amount)}`,
      '- keine Daten',
    ),
    '',
    'Umsatz nach Plattform:',
    listLines(
      input.revenueByPlatform,
      (item) => `- ${item.month} ${item.platform}: ${formatEUR(item.revenue)}`,
      '- keine Daten',
    ),
  ].join('\n');
}

async function runDashboardAnalysisCall(
  userPrompt: string,
): Promise<{ response: AIResponse; provider: AIProviderName; jobId: string }> {
  const providers = getAIProviderFallbackChain();
  let lastError: unknown = null;

  if (providers.length === 0) {
    throw new Error('Kein KI-Provider verfügbar. Bitte in den Einstellungen konfigurieren.');
  }

  for (const provider of providers) {
    try {
      await ensureBudget(provider);
      const brand = await loadBrandSettings();
      const response = await aiGenerateText(
        provider,
        [
          'Du bist der Product Analyst für PolyGrid Studio.',
          'Analysiere Dashboard- und Geschäftsdaten für ein deutsches 3D-Druck-Einzelunternehmen.',
          'Antworte mit 3-5 kurzen, konkreten Sätzen auf Deutsch.',
          'Benutze keine Markdown-Tabelle und keine übertriebene Werbesprache.',
          `Schreibstil: ${brand.writingStyle}.`,
          brand.preferredWords.length > 0
            ? `Bevorzugte Formulierungen: ${brand.preferredWords.join(', ')}.`
            : '',
          brand.forbiddenPhrases.length > 0
            ? `Verbotene Formulierungen/Wörter: ${brand.forbiddenPhrases.join(', ')}.`
            : '',
          brand.referenceText ? `Stilreferenz: ${brand.referenceText}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
        userPrompt,
        { temperature: 0.2, maxTokens: 700 },
      );
      const estimatedCost = await aiEstimateCost(
        response.provider,
        response.model,
        response.tokensInput,
        response.tokensOutput,
      );
      const jobId = await logAIJob({
        provider,
        model: response.model,
        agent: 'product_analyst',
        action: 'dashboard_analysis',
        input: userPrompt,
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
          agent: 'product_analyst',
          action: 'dashboard_analysis',
          input: userPrompt,
          output: null,
          tokensUsed: null,
          durationMs: null,
          status: 'error',
          errorMessage: message,
          estimatedCost: 0,
        });
      } catch {
        // Logging darf die Provider-Fallback-Kette nicht blockieren.
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError ?? 'KI-Analyse fehlgeschlagen'));
}

export async function generateDashboardAnalysis(input: DashboardAnalysisInput): Promise<string> {
  try {
    const prompt = buildPrompt(input);
    const { response } = await runDashboardAnalysisCall(prompt);
    return response.text.trim();
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'KI-Analyse konnte nicht laden');
  }
}
