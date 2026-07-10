/**
 * Standard-Bausteine (Addendum Modul 17, Spec 3.2).
 *
 * Die Startwerte sind aus der Design-Referenz (docs/assets/referenz-angebot.pdf)
 * abgeleitet und ohne Auftrags-Spezifika verallgemeinert – pro Dokument frei
 * editierbar. {{variablen}} werden beim Ausstellen in den Snapshot aufgelöst
 * (zahlungsziel_tage, iban, bic, kontoinhaber, gueltig_bis, kundenname, …).
 *
 * Harte Regel: Der §19-Satz ist KEIN Baustein – er bleibt fest und nicht
 * abwählbar (KLEINUNTERNEHMER_SATZ in schemas.ts).
 */
import type { ContentBlock, ContentBlockKind, DocumentType } from './schemas';

export const CONTENT_BLOCK_KIND_LABELS: Record<ContentBlockKind, string> = {
  included: 'Im Festpreis enthalten',
  excluded: 'Nicht enthalten (separat möglich)',
  cooperation: 'Ihre Mitwirkung',
  process: 'Ablauf & Zeitrahmen',
  payment_terms: 'Zahlungsbedingungen',
  optional_offer: 'Optional, nicht Teil dieses Auftrags',
  validity_signature: 'Gültigkeit und Auftragserteilung',
  custom: 'Eigener Baustein',
};

/** Zahlungsbedingungen für Angebote: Festpreis-Formulierung wie in der Referenz. */
const PAYMENT_TERMS_TEXT_QUOTE =
  'Der Festpreis ist vollständig nach Abnahme fällig, zahlbar per Überweisung ' +
  'innerhalb von {{zahlungsziel_tage}} Tagen nach Rechnungserhalt auf folgendes Konto:\n' +
  'Kontoinhaber: {{kontoinhaber}} · IBAN: {{iban}} · BIC: {{bic}}';

/** Zahlungsbedingungen für Rechnungen: Fälligkeit plus Bankverbindung (Spec 3.2). */
const PAYMENT_TERMS_TEXT_INVOICE =
  'Zahlbar ohne Abzug innerhalb von {{zahlungsziel_tage}} Tagen nach Rechnungserhalt ' +
  'per Überweisung auf folgendes Konto:\n' +
  'Kontoinhaber: {{kontoinhaber}} · IBAN: {{iban}} · BIC: {{bic}}';

interface ContentBlockTemplate {
  kind: ContentBlockKind;
  body_type: ContentBlock['body_type'];
  items?: string[];
  text?: string;
  /** enabled-Default je Dokumenttyp; validity_signature existiert bei Rechnungen nicht. */
  enabled: Partial<Record<DocumentType, boolean>>;
  /** Abweichender Startwert-Text je Typ (payment_terms). */
  textByType?: Partial<Record<DocumentType, string>>;
}

/**
 * Reihenfolge = Default-Reihenfolge im Dokument (wie in der Referenz,
 * Seite 2). custom-Bausteine werden nur über den Editor hinzugefügt.
 */
const CONTENT_BLOCK_TEMPLATES: ContentBlockTemplate[] = [
  {
    kind: 'included',
    body_type: 'bullets',
    items: [
      'Konzeption und Umsetzung der Website',
      'Kontaktbereich mit Telefon, E-Mail und Karte',
      'Kontaktformular mit Weiterleitung an Ihre E-Mail',
      'Vollständige mobile Optimierung (Smartphone, Tablet, Desktop)',
      'Technische Grundoptimierung für die Auffindbarkeit bei Google',
      'Einrichtung und Veröffentlichung',
    ],
    enabled: { quote: true, invoice: false },
  },
  {
    kind: 'excluded',
    body_type: 'bullets',
    items: [
      'Logo-Design / Branding',
      'Professionelles Fotoshooting',
      'Laufende Pflege (siehe optionales Angebot)',
    ],
    enabled: { quote: true, invoice: false },
  },
  {
    kind: 'cooperation',
    body_type: 'bullets',
    items: [
      'Texte oder Stichpunkte zu den Inhalten',
      'Bildmaterial (eigene Fotos genügen)',
      'Zeitnahes Feedback in der Abstimmungsrunde',
    ],
    enabled: { quote: true, invoice: false },
  },
  {
    kind: 'process',
    body_type: 'paragraph',
    text:
      'Briefing und Material → Umsetzung → Vorschau und Feedbackrunde → Einarbeitung → ' +
      'Veröffentlichung. Voraussichtliche Dauer rund 1–2 Wochen ab Vorliegen aller Inhalte.',
    enabled: { quote: true, invoice: false },
  },
  {
    kind: 'payment_terms',
    body_type: 'paragraph',
    text: PAYMENT_TERMS_TEXT_QUOTE,
    textByType: { quote: PAYMENT_TERMS_TEXT_QUOTE, invoice: PAYMENT_TERMS_TEXT_INVOICE },
    enabled: { quote: true, invoice: true },
  },
  {
    kind: 'optional_offer',
    body_type: 'paragraph',
    text:
      'Auf Wunsch übernehme ich nach der Veröffentlichung Hosting sowie kleinere Änderungen ' +
      'für 10,00 € pro Monat, jederzeit kündbar. Dieses Pflegepaket ist freiwillig und kann ' +
      'auch später hinzugebucht werden.',
    enabled: { quote: false, invoice: false },
  },
  {
    kind: 'validity_signature',
    body_type: 'paragraph',
    text:
      'Dieses Angebot ist bis zum {{gueltig_bis}} gültig. Mit Ihrer Unterschrift erteilen ' +
      'Sie den Auftrag zu den oben genannten Bedingungen.',
    // Rechnung: existiert nicht (Spec 3.2) – Template wird dort ausgelassen.
    enabled: { quote: true },
  },
];

/** Frische Standard-Bausteine für ein neues Dokument des Typs (eigene ids). */
export function buildDefaultContentBlocks(type: DocumentType): ContentBlock[] {
  return CONTENT_BLOCK_TEMPLATES.filter(
    (template) => !(type === 'invoice' && template.kind === 'validity_signature'),
  ).map((template) => ({
    id: crypto.randomUUID(),
    kind: template.kind,
    enabled: template.enabled[type] ?? false,
    title: CONTENT_BLOCK_KIND_LABELS[template.kind],
    body_type: template.body_type,
    items: [...(template.items ?? [])],
    text: template.textByType?.[type] ?? template.text ?? '',
  }));
}

/** Leerer eigener Baustein (Spec 3.2: beliebig viele hinzufügbar). */
export function createCustomContentBlock(): ContentBlock {
  return {
    id: crypto.randomUUID(),
    kind: 'custom',
    enabled: true,
    title: CONTENT_BLOCK_KIND_LABELS.custom,
    body_type: 'paragraph',
    items: [],
    text: '',
  };
}

/** app_settings-Keys für die Nutzer-Standards (Spec 3.3). */
export const DOCUMENT_DEFAULT_BLOCKS_SETTING_KEYS: Record<DocumentType, string> = {
  quote: 'document_default_blocks_quote',
  invoice: 'document_default_blocks_invoice',
};
