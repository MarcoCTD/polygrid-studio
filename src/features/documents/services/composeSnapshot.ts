/**
 * Pure Snapshot-Komposition (Modul 17): baut aus Dokumentdaten, Aussteller-
 * Stammdaten und Empfänger die eingefrorene Render-Kopie (Spec 2.2).
 *
 * Wird vom Ausstellen/Storno im Service UND von der Live-Vorschau des Editors
 * verwendet – damit rendern Entwurf-Vorschau und ausgestelltes Dokument
 * garantiert über denselben Weg.
 */
import {
  DocumentSnapshotSchema,
  KLEINUNTERNEHMER_SATZ,
  calculateDocumentTotal,
  type DocumentLayout,
  type DocumentSnapshot,
  type DocumentType,
  type LineItem,
  type SnapshotIssuer,
} from '../schemas';

const VARIABLE_REGEX = /\{\{([^}]+)\}\}/g;

/**
 * Ersetzt {{variablen}} (Registry-Syntax, Modul 07). Unbekannte oder leere
 * Variablen bleiben sichtbar stehen, damit Lücken im Dokument auffallen –
 * das Ausstellen wird dann über findUnresolvedDocumentVariables blockiert.
 */
export function resolveDocumentVariables(
  text: string | null,
  values: Record<string, string | null>,
): string | null {
  if (!text) return text;
  return text.replace(VARIABLE_REGEX, (match, rawName: string) => {
    const name = rawName.trim().toLowerCase();
    const value = values[name];
    return value === undefined || value === null || value === '' ? match : value;
  });
}

export interface DocumentVariableContext {
  issuer: SnapshotIssuer;
  clientName: string | null;
  projectName: string | null;
  /** Ausstellungsdatum bereits im deutschen Format (TT.MM.JJJJ). */
  issueDateFormatted: string;
}

/**
 * Zentrale Wertetabelle für {{variablen}} in Dokument-Bausteinen (Einleitungs-
 * und Schlusstext). Ausstellen, Storno und Editor-Vorschau bauen ihre Werte
 * ausschließlich hierüber, damit kein Weg Variablen "vergisst" (z.B. iban/bic
 * in Zahlungsbedingungen).
 */
export function buildDocumentVariableValues(
  context: DocumentVariableContext,
): Record<string, string | null> {
  return {
    kundenname: context.clientName,
    projektname: context.projectName,
    firmenname: context.issuer.company_name,
    datum: context.issueDateFormatted,
    iban: context.issuer.iban,
    bic: context.issuer.bic,
    bank: context.issuer.bank_name,
  };
}

/**
 * Variablennamen in den Texten, die mangels Wert wörtlich stehen bleiben
 * würden (gleiche Bleib-Bedingung wie resolveDocumentVariables). Reihenfolge
 * des ersten Auftretens, ohne Duplikate.
 */
export function findUnresolvedDocumentVariables(
  texts: ReadonlyArray<string | null | undefined>,
  values: Record<string, string | null>,
): string[] {
  const unresolved: string[] = [];
  for (const text of texts) {
    if (!text) continue;
    for (const match of text.matchAll(VARIABLE_REGEX)) {
      const name = (match[1] ?? '').trim().toLowerCase();
      if (!name) continue;
      const value = values[name];
      if (
        (value === undefined || value === null || value === '') &&
        !unresolved.includes(name)
      ) {
        unresolved.push(name);
      }
    }
  }
  return unresolved;
}

export interface ComposeSnapshotArgs {
  type: DocumentType;
  number: string;
  issuer: SnapshotIssuer;
  recipient: { name: string; contact_person: string | null; address: string | null };
  line_items: LineItem[];
  issue_date: string;
  due_date: string | null;
  valid_until: string | null;
  service_date: string | null;
  intro_text: string | null;
  outro_text: string | null;
  layout: DocumentLayout;
  accent_color: string;
  logo: string | null;
  related_document_number: string | null;
  /** Wertetabelle aus buildDocumentVariableValues (kundenname, iban, bic, …). */
  variable_values: Record<string, string | null>;
}

export function composeDocumentSnapshot(args: ComposeSnapshotArgs): DocumentSnapshot {
  return DocumentSnapshotSchema.parse({
    type: args.type,
    number: args.number,
    issuer: args.issuer,
    recipient: args.recipient,
    line_items: args.line_items,
    total: calculateDocumentTotal(args.line_items),
    issue_date: args.issue_date,
    due_date: args.due_date,
    valid_until: args.valid_until,
    service_date: args.service_date,
    intro_text: resolveDocumentVariables(args.intro_text, args.variable_values),
    outro_text: resolveDocumentVariables(args.outro_text, args.variable_values),
    layout: args.layout,
    accent_color: args.accent_color,
    logo: args.logo || null,
    // §19-Satz ist bei Rechnungen fix und nicht abwählbar.
    kleinunternehmer_hinweis: args.type === 'invoice' ? KLEINUNTERNEHMER_SATZ : null,
    related_document_number: args.related_document_number,
  } satisfies DocumentSnapshot);
}
