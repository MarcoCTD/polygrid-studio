import { getSetting } from '@/services/database';

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
  kleinanzeigen: 'Kleinanzeigen: Titel maximal 65 Zeichen, reine Textbeschreibung, lokal und sachlich formulieren.',
} as const;

export async function loadBrandSettings(): Promise<BrandSettings> {
  const settings = { ...DEFAULT_BRAND_SETTINGS };

  try {
    const writingStyle = await getSetting<string>('brand_writing_style');
    if (writingStyle) settings.writingStyle = writingStyle;

    const preferredWords = await getSetting<string[]>('brand_preferred_words');
    if (Array.isArray(preferredWords)) settings.preferredWords = preferredWords;

    const forbiddenPhrases = await getSetting<string[]>('brand_forbidden_phrases');
    if (Array.isArray(forbiddenPhrases)) settings.forbiddenPhrases = forbiddenPhrases;

    const referenceText = await getSetting<string>('brand_reference_text');
    if (referenceText !== null) settings.referenceText = referenceText;
  } catch {
    return settings;
  }

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
