import type { Product } from '@/features/products/schema';
import { aiEstimateCost, aiGenerateStructured, aiGenerateText } from '../services/aiService';
import { checkBudget, logAIJob } from '../services/costTracker';
import { buildListingSystemPrompt, loadBrandSettings } from '../services/promptBuilder';
import { useAIStore } from '../stores/aiStore';
import type { AIAction, AIDiffResult, AIProviderName, AIResponse } from '../types';

type ListingPlatform = 'etsy' | 'ebay' | 'kleinanzeigen';
type Language = 'de' | 'en';

const TAG_LIMITS: Record<ListingPlatform, number> = {
  etsy: 13,
  ebay: 20,
  kleinanzeigen: 10,
};

const TITLE_LIMITS: Record<ListingPlatform, number> = {
  etsy: 140,
  ebay: 80,
  kleinanzeigen: 65,
};

function productContext(product: Product): string {
  return [
    `Name: ${product.name}`,
    product.short_name ? `Kurzname: ${product.short_name}` : '',
    `Kategorie: ${product.category}`,
    product.subcategory ? `Unterkategorie: ${product.subcategory}` : '',
    `Material: ${product.material_type}`,
    product.description_internal ? `Beschreibung intern: ${product.description_internal}` : '',
    product.material_grams ? `Materialverbrauch: ${product.material_grams} g` : '',
    product.print_time_minutes ? `Druckzeit: ${product.print_time_minutes} Minuten` : '',
    product.target_price ? `Zielpreis: ${product.target_price} EUR` : '',
    product.notes ? `Notizen: ${product.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function parseLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.replace(/^\s*[-*\d.)]+\s*/, '').trim())
    .filter(Boolean);
}

function parseStringArray(text: string): string[] {
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
    throw new Error('KI-Antwort ist kein JSON-Array aus Strings.');
  }
  return parsed;
}

function activeProvider(): AIProviderName {
  return useAIStore.getState().activeProvider ?? 'ollama';
}

async function ensureBudget(provider: AIProviderName): Promise<void> {
  if (provider === 'ollama') return;
  const budget = await checkBudget();
  if (budget.isBlocked) {
    throw new Error('KI-Budget fuer diesen Monat erreicht.');
  }
}

async function runListingCall(params: {
  action: AIAction;
  provider: AIProviderName;
  systemPrompt: string;
  userPrompt: string;
  structured: boolean;
  model?: string;
}): Promise<{ response: AIResponse; jobId: string }> {
  await ensureBudget(params.provider);
  try {
    const response = params.structured
      ? await aiGenerateStructured(params.provider, params.systemPrompt, params.userPrompt, {
          model: params.model,
        })
      : await aiGenerateText(params.provider, params.systemPrompt, params.userPrompt, {
          model: params.model,
        });
    const estimatedCost = await aiEstimateCost(
      response.provider,
      response.model,
      response.tokensInput,
      response.tokensOutput,
    );
    const jobId = await logAIJob({
      provider: params.provider,
      model: response.model,
      agent: 'listing_assistant',
      action: params.action,
      input: params.userPrompt,
      output: response.text,
      tokensUsed: response.tokensInput + response.tokensOutput,
      durationMs: response.durationMs,
      status: 'success',
      estimatedCost,
    });
    await useAIStore.getState().refreshBudget();
    return { response, jobId };
  } catch (error) {
    await logAIJob({
      provider: params.provider,
      model: params.model ?? 'unknown',
      agent: 'listing_assistant',
      action: params.action,
      input: params.userPrompt,
      output: null,
      tokensUsed: null,
      durationMs: null,
      status: 'error',
      errorMessage: error instanceof Error ? error.message : String(error),
      estimatedCost: 0,
    });
    throw error;
  }
}

export async function generateTitle(
  product: Product,
  platform: ListingPlatform,
  language: Language,
): Promise<AIDiffResult> {
  const brand = await loadBrandSettings();
  const provider = activeProvider();
  const systemPrompt = buildListingSystemPrompt(platform, language, brand);
  const userPrompt = `Erstelle 3 SEO-optimierte Titel fuer folgendes Produkt auf ${platform} (max. ${TITLE_LIMITS[platform]} Zeichen pro Titel). Antworte NUR mit den 3 Titeln, je einer pro Zeile, ohne Nummerierung.\n\n${productContext(product)}`;
  const { response, jobId } = await runListingCall({
    action: 'generate_title',
    provider,
    systemPrompt,
    userPrompt,
    structured: false,
  });

  return {
    agent: 'listing_assistant',
    action: 'generate_title',
    provider,
    model: response.model,
    jobId,
    fields: [
      {
        fieldName: 'title',
        fieldLabel: 'Titel',
        currentValue: product.name,
        suggestedValue: parseLines(response.text),
      },
    ],
  };
}

export async function generateDescription(
  product: Product,
  platform: ListingPlatform,
  style: 'short' | 'long',
  language: Language,
): Promise<AIDiffResult> {
  const brand = await loadBrandSettings();
  const provider = activeProvider();
  const systemPrompt = buildListingSystemPrompt(platform, language, brand);
  const userPrompt = `Erstelle eine ${style === 'short' ? 'kurze' : 'ausfuehrliche'} Produktbeschreibung fuer ${platform}. Keine Markdown-Formatierung.\n\n${productContext(product)}`;
  const { response, jobId } = await runListingCall({
    action: 'generate_description',
    provider,
    systemPrompt,
    userPrompt,
    structured: false,
  });

  return {
    agent: 'listing_assistant',
    action: 'generate_description',
    provider,
    model: response.model,
    jobId,
    fields: [
      {
        fieldName: style === 'short' ? 'short_description' : 'long_description',
        fieldLabel: style === 'short' ? 'Kurzbeschreibung' : 'Beschreibung',
        currentValue: product.description_internal,
        suggestedValue: response.text.trim(),
      },
    ],
  };
}

export async function generateTags(
  product: Product,
  platform: ListingPlatform,
  language: Language,
): Promise<AIDiffResult> {
  const brand = await loadBrandSettings();
  const provider = activeProvider();
  const systemPrompt = buildListingSystemPrompt(platform, language, brand);
  const userPrompt = `Erstelle ${TAG_LIMITS[platform]} SEO-Tags fuer ${platform} fuer folgendes Produkt. Antworte als JSON-Array: ["tag1", "tag2"].\n\n${productContext(product)}`;
  const { response, jobId } = await runListingCall({
    action: 'generate_tags',
    provider,
    systemPrompt,
    userPrompt,
    structured: true,
  });

  return {
    agent: 'listing_assistant',
    action: 'generate_tags',
    provider,
    model: response.model,
    jobId,
    fields: [
      {
        fieldName: 'tags',
        fieldLabel: 'Tags',
        currentValue: null,
        suggestedValue: parseStringArray(response.text),
      },
    ],
  };
}

export async function generateBulletPoints(
  product: Product,
  language: Language,
): Promise<AIDiffResult> {
  const brand = await loadBrandSettings();
  const provider = activeProvider();
  const systemPrompt = buildListingSystemPrompt('etsy', language, brand);
  const userPrompt = `Erstelle 5 sachliche Bullet Points fuer folgendes Produkt. Antworte als JSON-Array aus Strings.\n\n${productContext(product)}`;
  const { response, jobId } = await runListingCall({
    action: 'generate_bullet_points',
    provider,
    systemPrompt,
    userPrompt,
    structured: true,
  });

  return {
    agent: 'listing_assistant',
    action: 'generate_bullet_points',
    provider,
    model: response.model,
    jobId,
    fields: [
      {
        fieldName: 'bullet_points',
        fieldLabel: 'Bullet Points',
        currentValue: null,
        suggestedValue: parseStringArray(response.text),
      },
    ],
  };
}

export async function rewriteForPlatform(
  text: string,
  sourcePlatform: string,
  targetPlatform: string,
): Promise<AIDiffResult> {
  const brand = await loadBrandSettings();
  const provider = activeProvider();
  const target = targetPlatform as ListingPlatform;
  const systemPrompt = buildListingSystemPrompt(target, 'de', brand);
  const userPrompt = `Schreibe den folgenden Text von ${sourcePlatform} fuer ${targetPlatform} um. Behalte Fakten bei und beachte Plattform-Limits.\n\n${text}`;
  const { response, jobId } = await runListingCall({
    action: 'rewrite_for_platform',
    provider,
    systemPrompt,
    userPrompt,
    structured: false,
  });

  return {
    agent: 'listing_assistant',
    action: 'rewrite_for_platform',
    provider,
    model: response.model,
    jobId,
    fields: [
      {
        fieldName: 'text',
        fieldLabel: 'Text',
        currentValue: text,
        suggestedValue: response.text.trim(),
      },
    ],
  };
}
