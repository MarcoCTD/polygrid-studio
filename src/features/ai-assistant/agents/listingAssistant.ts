import type { Product } from '@/features/products/schema';
import type { Listing } from '@/features/listings/schemas';
import { aiEstimateCost, aiGenerateStructured, aiGenerateText } from '../services/aiService';
import { checkBudget, logAIJob } from '../services/costTracker';
import { buildListingSystemPrompt, loadBrandSettings } from '../services/promptBuilder';
import { getAIProviderFallbackChain, useAIStore } from '../stores/aiStore';
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

function productContext(product: Product, listing?: Listing): string {
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
    listing?.master_title ? `Aktueller Listing-Titel: ${listing.master_title}` : '',
    listing?.master_short_description
      ? `Aktuelle Kurzbeschreibung: ${listing.master_short_description}`
      : '',
    listing?.master_long_description
      ? `Aktuelle Langbeschreibung: ${listing.master_long_description}`
      : '',
    listing?.master_tags.length ? `Aktuelle Tags: ${listing.master_tags.join(', ')}` : '',
    listing?.master_bullet_points?.length
      ? `Aktuelle Bullet Points: ${listing.master_bullet_points.join(' | ')}`
      : '',
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
  try {
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/i, '')
      .trim();
    const parsed: unknown = JSON.parse(cleaned);
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
      return [];
    }
    return parsed;
  } catch {
    return [];
  }
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

async function runListingCall(params: {
  action: AIAction;
  systemPrompt: string;
  userPrompt: string;
  structured: boolean;
  model?: string;
}): Promise<{ response: AIResponse; provider: AIProviderName; jobId: string }> {
  let lastError: unknown = null;
  const providers = getAIProviderFallbackChain();

  if (providers.length === 0) {
    throw new Error('Kein KI-Provider verfügbar. Bitte in den Einstellungen konfigurieren.');
  }

  for (const provider of providers) {
    try {
      await ensureBudget(provider);
      const response = params.structured
        ? await aiGenerateStructured(provider, params.systemPrompt, params.userPrompt, {
            model: params.model,
          })
        : await aiGenerateText(provider, params.systemPrompt, params.userPrompt, {
            model: params.model,
          });
      const estimatedCost = await aiEstimateCost(
        response.provider,
        response.model,
        response.tokensInput,
        response.tokensOutput,
      );
      const jobId = await logAIJob({
        provider,
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
          model: params.model ?? 'unknown',
          agent: 'listing_assistant',
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

export async function generateTitle(
  product: Product,
  platform: ListingPlatform,
  language: Language,
  listing?: Listing,
): Promise<AIDiffResult> {
  const brand = await loadBrandSettings();
  const systemPrompt = buildListingSystemPrompt(platform, language, brand);
  const userPrompt = [
    `Erstelle 3 SEO-optimierte Produkttitel fuer ${platform} (max. ${TITLE_LIMITS[platform]} Zeichen pro Titel).`,
    'Antworte NUR mit den 3 Titeln, einer pro Zeile, ohne Nummerierung und ohne Anfuehrungszeichen.',
    '',
    productContext(product, listing),
  ].join('\n');
  const { response, provider, jobId } = await runListingCall({
    action: 'generate_title',
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
        fieldName: 'master_title',
        fieldLabel: 'Titel',
        currentValue: listing?.master_title ?? product.name,
        suggestedValue: parseLines(response.text)[0] ?? response.text.trim(),
      },
    ],
  };
}

export async function generateDescription(
  product: Product,
  platform: ListingPlatform,
  style: 'short' | 'long',
  language: Language,
  listing?: Listing,
): Promise<AIDiffResult> {
  const brand = await loadBrandSettings();
  const systemPrompt = buildListingSystemPrompt(platform, language, brand);
  const userPrompt =
    style === 'short'
      ? [
          `Erstelle eine kurze Produktbeschreibung fuer ${platform}.`,
          'Maximal 2 kurze Absaetze, keine Markdown-Formatierung, sachlich und praezise.',
          '',
          productContext(product, listing),
        ].join('\n')
      : [
          `Erstelle eine ausfuehrliche Produktbeschreibung fuer ${platform}.`,
          'Die Beschreibung soll sachlich und praezise sein, technische Details betonen und in 3-4 Absaetze gegliedert sein.',
          'Keine Markdown-Formatierung.',
          '',
          productContext(product, listing),
        ].join('\n');
  const { response, provider, jobId } = await runListingCall({
    action: 'generate_description',
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
        fieldName: style === 'short' ? 'master_short_description' : 'master_long_description',
        fieldLabel: style === 'short' ? 'Kurzbeschreibung' : 'Beschreibung',
        currentValue:
          style === 'short'
            ? (listing?.master_short_description ?? product.description_internal)
            : (listing?.master_long_description ?? product.description_internal),
        suggestedValue: response.text.trim(),
      },
    ],
  };
}

export async function generateTags(
  product: Product,
  platform: ListingPlatform,
  language: Language,
  listing?: Listing,
): Promise<AIDiffResult> {
  const brand = await loadBrandSettings();
  const systemPrompt = buildListingSystemPrompt(platform, language, brand);
  const userPrompt = [
    `Erstelle genau ${TAG_LIMITS[platform]} SEO-optimierte Tags fuer dieses ${platform}-Listing.`,
    'Antworte als JSON-Array: ["tag1", "tag2", ...].',
    platform === 'etsy'
      ? 'Beachte: Jeder Tag maximal 20 Zeichen. Keine Duplikate.'
      : 'Keine Duplikate.',
    '',
    productContext(product, listing),
  ].join('\n');
  const { response, provider, jobId } = await runListingCall({
    action: 'generate_tags',
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
        fieldName: 'master_tags',
        fieldLabel: 'Tags',
        currentValue: listing?.master_tags ?? null,
        suggestedValue: parseStringArray(response.text).slice(0, TAG_LIMITS[platform]),
      },
    ],
  };
}

export async function generateBulletPoints(
  product: Product,
  language: Language,
  listing?: Listing,
): Promise<AIDiffResult> {
  const brand = await loadBrandSettings();
  const systemPrompt = buildListingSystemPrompt('etsy', language, brand);
  const userPrompt = [
    'Erstelle 5 sachliche Bullet Points fuer folgendes Produkt.',
    'Fokus: Nutzen, Material, technische Details, Verarbeitung, Einsatzbereich.',
    'Antworte als JSON-Array aus Strings.',
    '',
    productContext(product, listing),
  ].join('\n');
  const { response, provider, jobId } = await runListingCall({
    action: 'generate_bullet_points',
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
        fieldName: 'master_bullet_points',
        fieldLabel: 'Bullet Points',
        currentValue: listing?.master_bullet_points ?? null,
        suggestedValue: parseStringArray(response.text),
      },
    ],
  };
}

export async function rewriteForPlatform(
  text: string,
  sourcePlatform: string,
  targetPlatform: string,
  language: Language = 'de',
): Promise<AIDiffResult> {
  const brand = await loadBrandSettings();
  const target = targetPlatform as ListingPlatform;
  const systemPrompt = buildListingSystemPrompt(target, language, brand);
  const userPrompt = [
    `Schreibe den folgenden Text von ${sourcePlatform} fuer ${targetPlatform} um.`,
    'Behalte alle Fakten bei, entferne nicht belegbare Aussagen und beachte die Plattform-Limits.',
    'Gib nur den umgeschriebenen Text aus, ohne Markdown und ohne Einleitung.',
    '',
    text,
  ].join('\n');
  const { response, provider, jobId } = await runListingCall({
    action: 'rewrite_for_platform',
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
        fieldName: 'master_long_description',
        fieldLabel: `Text fuer ${targetPlatform}`,
        currentValue: text,
        suggestedValue: response.text.trim(),
      },
    ],
  };
}
