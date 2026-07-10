/**
 * Angebote und Rechnungen (Modul 17): Zod-Schemas als Single Source of Truth.
 *
 * Kernregeln (Spec 2.2):
 * - Drafts haben keine Nummer; die Nummer wird transaktional beim Ausstellen
 *   gezogen (lückenlos pro Typ und Jahr).
 * - Beim Ausstellen wird ein Snapshot ALLER gerenderten Daten eingefroren
 *   (inkl. Firmen-Stammdaten und Kundenadresse). Druck/PDF rendert immer
 *   aus dem Snapshot, nie aus den Livedaten.
 * - Ausgestellte Dokumente sind inhaltlich unveränderbar; Rechnungen sind
 *   nach Ausstellung nicht löschbar, nur stornierbar (Gegenrechnung).
 */
import { z } from 'zod';

export const DocumentTypeEnum = z.enum(['quote', 'invoice']);

/**
 * Statusfluss:
 * - quote:   draft → issued → accepted | rejected
 * - invoice: draft → issued → paid | cancelled
 */
export const DocumentStatusEnum = z.enum([
  'draft',
  'issued',
  'accepted',
  'rejected',
  'paid',
  'cancelled',
]);

export const DocumentLayoutEnum = z.enum(['modern', 'classic']);

/** Pflichtsatz §19 UStG – fix, nicht abwählbar, steht auf jeder Rechnung. */
export const KLEINUNTERNEHMER_SATZ = 'Gemäß §19 UStG wird keine Umsatzsteuer berechnet.';

// ------------------------------------------------------------
// Text-Bausteine (Addendum Modul 17)
// ------------------------------------------------------------
export const ContentBlockKindEnum = z.enum([
  'included',
  'excluded',
  'cooperation',
  'process',
  'payment_terms',
  'optional_offer',
  'validity_signature',
  'custom',
]);

export const ContentBlockBodyTypeEnum = z.enum(['bullets', 'paragraph']);

/**
 * Ein Baustein: pro Dokument an-/abwählbar (enabled), editierbar und
 * umsortierbar (Array-Reihenfolge). body_type entscheidet, ob items
 * (Bullet-Liste) oder text (Absatz) gerendert wird – das jeweils andere
 * Feld bleibt leer mit Default.
 */
export const ContentBlockSchema = z.object({
  id: z.string().min(1),
  kind: ContentBlockKindEnum,
  enabled: z.boolean(),
  title: z.string(),
  body_type: ContentBlockBodyTypeEnum,
  items: z.array(z.string()).default([]),
  text: z.string().default(''),
});

export const ContentBlockListSchema = z.array(ContentBlockSchema);

const uuid = z.string().uuid();
const nullableText = z.string().trim().nullable();
const optionalNullableText = z.string().trim().nullable().optional();
const isoDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Datum muss im ISO-Format sein');

/**
 * Position: Menge strikt positiv, Einzelpreis darf negativ sein
 * (Storno-Rechnungen tragen negierte Einzelpreise, Spec 1.1).
 */
export const LineItemSchema = z.object({
  description: z.string().trim().min(1, 'Beschreibung ist erforderlich'),
  quantity: z.number().positive('Menge muss größer 0 sein'),
  unit_price: z.number().finite(),
});

const lineItemsList = z.array(LineItemSchema);

/** Zeilensumme einer Position, kaufmännisch auf Cent gerundet. */
export function lineItemTotal(item: z.infer<typeof LineItemSchema>): number {
  return Math.round(item.quantity * item.unit_price * 100) / 100;
}

/** Gesamtsumme (brutto = netto, Kleinunternehmer). */
export function calculateDocumentTotal(items: readonly z.infer<typeof LineItemSchema>[]): number {
  const total = items.reduce((sum, item) => sum + lineItemTotal(item), 0);
  return Math.round(total * 100) / 100;
}

// ------------------------------------------------------------
// Snapshot: eingefrorene Kopie aller gerenderten Daten
// ------------------------------------------------------------
export const SnapshotIssuerSchema = z.object({
  company_name: z.string(),
  owner_name: z.string(),
  street: z.string(),
  zip: z.string(),
  city: z.string(),
  tax_number: z.string(),
  vat_id: z.string(),
  iban: z.string(),
  bic: z.string(),
  bank_name: z.string(),
  // Addendum (Layout polygrid: VON-Block und Fußzeile). Defaults, damit
  // vor dem Addendum eingefrorene Snapshots weiter parsen.
  email: z.string().default(''),
  phone: z.string().default(''),
  website: z.string().default(''),
});

export const SnapshotRecipientSchema = z.object({
  name: z.string(),
  contact_person: z.string().nullable(),
  address: z.string().nullable(),
  // Addendum (Layout polygrid: AN-Block). Default für Alt-Snapshots.
  email: z.string().nullable().default(null),
});

export const DocumentSnapshotSchema = z.object({
  type: DocumentTypeEnum,
  number: z.string(),
  issuer: SnapshotIssuerSchema,
  recipient: SnapshotRecipientSchema,
  line_items: lineItemsList,
  total: z.number(),
  issue_date: isoDateString,
  due_date: isoDateString.nullable(),
  valid_until: isoDateString.nullable(),
  service_date: z.string().nullable(),
  /** Intro/Outro mit bereits aufgelösten {{variablen}}. */
  intro_text: z.string().nullable(),
  outro_text: z.string().nullable(),
  layout: DocumentLayoutEnum,
  /** Beim Ausstellen aufgelöste Akzentfarbe (Hex) für das Layout. */
  accent_color: z.string(),
  /** Logo als Data-URL (Kopie, unabhängig von späteren Settings-Änderungen). */
  logo: z.string().nullable(),
  /** §19-Satz – bei Rechnungen immer gesetzt, nicht abwählbar. */
  kleinunternehmer_hinweis: z.string().nullable(),
  /** Referenznummer des verknüpften Dokuments (Storno → Original, Rechnung → Angebot). */
  related_document_number: z.string().nullable(),
  /**
   * Eingefrorene Bausteine (Addendum): nur die beim Ausstellen aktivierten
   * Blöcke, in Reihenfolge, mit bereits aufgelösten {{variablen}}.
   * Default [], damit Alt-Snapshots weiter parsen.
   */
  content_blocks: ContentBlockListSchema.default([]),
});

// ------------------------------------------------------------
// documents
// ------------------------------------------------------------
export const DocumentSchema = z.object({
  id: uuid,
  type: DocumentTypeEnum,
  number: z.string().nullable(),
  status: DocumentStatusEnum,
  client_id: uuid,
  project_id: uuid.nullable(),
  order_id: uuid.nullable(),
  related_document_id: uuid.nullable(),
  line_items: lineItemsList,
  total: z.number(),
  issue_date: isoDateString.nullable(),
  due_date: isoDateString.nullable(),
  valid_until: isoDateString.nullable(),
  service_date: nullableText,
  intro_text: nullableText,
  outro_text: nullableText,
  layout: DocumentLayoutEnum,
  /** Bausteine des Dokuments (auch abgewählte); [] bei Alt-Dokumenten. */
  content_blocks: ContentBlockListSchema,
  snapshot: DocumentSnapshotSchema.nullable(),
  pdf_path: nullableText,
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
  deleted_at: z.string().nullable(),
});

export const NewDocumentSchema = z.object({
  type: DocumentTypeEnum,
  client_id: uuid,
  project_id: uuid.nullable().optional(),
  order_id: uuid.nullable().optional(),
  line_items: lineItemsList.optional(),
  service_date: optionalNullableText,
  intro_text: optionalNullableText,
  outro_text: optionalNullableText,
  layout: DocumentLayoutEnum.optional(),
  /** Ohne Angabe: Standard-Bausteine des Typs (Nutzer-Standard oder Konstanten). */
  content_blocks: ContentBlockListSchema.optional(),
});

/**
 * Nur für Drafts: inhaltliche Felder. Der Service lehnt Updates auf
 * ausgestellte Dokumente ab (Unveränderbarkeit, Spec 2.2).
 */
export const UpdateDocumentSchema = z.object({
  client_id: uuid.optional(),
  project_id: uuid.nullable().optional(),
  order_id: uuid.nullable().optional(),
  line_items: lineItemsList.optional(),
  service_date: optionalNullableText,
  intro_text: optionalNullableText,
  outro_text: optionalNullableText,
  layout: DocumentLayoutEnum.optional(),
  content_blocks: ContentBlockListSchema.optional(),
});

// ------------------------------------------------------------
// Typen
// ------------------------------------------------------------
export type DocumentType = z.infer<typeof DocumentTypeEnum>;
export type DocumentStatus = z.infer<typeof DocumentStatusEnum>;
export type DocumentLayout = z.infer<typeof DocumentLayoutEnum>;
export type ContentBlockKind = z.infer<typeof ContentBlockKindEnum>;
export type ContentBlockBodyType = z.infer<typeof ContentBlockBodyTypeEnum>;
export type ContentBlock = z.infer<typeof ContentBlockSchema>;
export type LineItem = z.infer<typeof LineItemSchema>;
export type DocumentSnapshot = z.infer<typeof DocumentSnapshotSchema>;
export type SnapshotIssuer = z.infer<typeof SnapshotIssuerSchema>;
export type BusinessDocument = z.infer<typeof DocumentSchema>;
export type NewDocumentInput = z.infer<typeof NewDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof UpdateDocumentSchema>;

/** Listen-Item mit aufgelöstem Kundennamen für den Dokumente-Tab. */
export interface DocumentListItem extends BusinessDocument {
  client_name: string;
}

/** Rechnung issued mit überschrittener Fälligkeit (Smart Action, Filter, Badge). */
export function isInvoiceOverdue(
  document: Pick<BusinessDocument, 'type' | 'status' | 'due_date'>,
  today: string,
): boolean {
  return (
    document.type === 'invoice' &&
    document.status === 'issued' &&
    document.due_date !== null &&
    document.due_date < today
  );
}

// ------------------------------------------------------------
// Labels (UI)
// ------------------------------------------------------------
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  quote: 'Angebot',
  invoice: 'Rechnung',
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  draft: 'Entwurf',
  issued: 'Ausgestellt',
  accepted: 'Angenommen',
  rejected: 'Abgelehnt',
  paid: 'Bezahlt',
  cancelled: 'Storniert',
};

export const DOCUMENT_LAYOUT_LABELS: Record<DocumentLayout, string> = {
  modern: 'Modern',
  classic: 'Klassisch',
};
