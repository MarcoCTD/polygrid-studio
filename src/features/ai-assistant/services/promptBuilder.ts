import { DEFAULTS, getSettingWithDefault } from '@/services/settings';

export interface BrandSettings {
  writingStyle: string;
  preferredWords: string[];
  forbiddenPhrases: string[];
  referenceText: string;
}

const DEFAULT_BRAND_SETTINGS: BrandSettings = {
  writingStyle: 'sachlich-minimalistisch',
  preferredWords: [],
  forbiddenPhrases: [],
  referenceText: '',
};

const PLATFORM_LIMITS = {
  etsy: 'Etsy: Titel maximal 140 Zeichen, maximal 13 Tags, keine irreführenden Keywords.',
  ebay: 'eBay: Titel maximal 80 Zeichen, HTML in Beschreibungen möglich, klare Produktspezifikationen.',
  kleinanzeigen:
    'Kleinanzeigen: Titel maximal 65 Zeichen, reine Textbeschreibung, lokal und sachlich formulieren.',
} as const;

export async function loadBrandSettings(): Promise<BrandSettings> {
  const settings = { ...DEFAULT_BRAND_SETTINGS };

  try {
    const [
      writingStyle,
      preferredWords,
      legacyPreferredWords,
      forbiddenPhrases,
      legacyForbiddenPhrases,
      referenceText,
    ] = await Promise.all([
      getSettingWithDefault('brand_writing_style', DEFAULTS.brand_writing_style),
      getSettingWithDefault('brand_keywords', DEFAULTS.brand_keywords),
      getSettingWithDefault('brand_preferred_words', DEFAULTS.brand_preferred_words),
      getSettingWithDefault('brand_no_go_phrases', DEFAULTS.brand_no_go_phrases),
      getSettingWithDefault('brand_forbidden_phrases', DEFAULTS.brand_forbidden_phrases),
      getSettingWithDefault('brand_reference_text', DEFAULTS.brand_reference_text),
    ]);

    settings.writingStyle = writingStyle;
    settings.preferredWords =
      preferredWords.length > 0 ? [...preferredWords] : [...legacyPreferredWords];
    settings.forbiddenPhrases =
      forbiddenPhrases.length > 0 ? [...forbiddenPhrases] : [...legacyForbiddenPhrases];
    settings.referenceText = referenceText;
  } catch {
    return settings;
  }

  console.info('[AI] Brand settings injected into system prompt', {
    writingStyle: settings.writingStyle,
    preferredWords: settings.preferredWords,
    forbiddenPhrases: settings.forbiddenPhrases,
    hasReferenceText: settings.referenceText.trim().length > 0,
  });

  return settings;
}

export function buildListingSystemPrompt(
  platform: 'etsy' | 'ebay' | 'kleinanzeigen',
  language: 'de' | 'en',
  brand: BrandSettings,
): string {
  return [
    'Du bist der Listing Assistant fuer PolyGrid Studio, ein deutsches 3D-Druck-Einzelunternehmen.',
    'Erstelle hochwertige E-Commerce-Texte fuer 3D-gedruckte Produkte.',
    `Schreibstil: ${brand.writingStyle}.`,
    'Schreibe praezise, clean, sachlich und hochwertig. Keine Emojis, keine uebertriebene Werbesprache.',
    'Vermeide typische KI-Formulierungen wie "Entdecke", "Erlebe" oder "Perfekt fuer".',
    PLATFORM_LIMITS[platform],
    `Sprache: ${language === 'de' ? 'Deutsch' : 'Englisch'}.`,
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

export function buildExpenseSystemPrompt(categories: string[], brand: BrandSettings): string {
  return [
    'Du bist der Expense Assistant fuer PolyGrid Studio.',
    'Klassifiziere Geschaeftsausgaben konservativ und nachvollziehbar.',
    `Gueltige Kategorien: ${categories.join(', ')}.`,
    'Antworte bei strukturierten Aufgaben ausschliesslich mit gueltigem JSON.',
    `Schreibstil fuer Freitextvorschlaege: ${brand.writingStyle}.`,
    brand.forbiddenPhrases.length > 0
      ? `Verbotene Formulierungen: ${brand.forbiddenPhrases.join(', ')}.`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}
