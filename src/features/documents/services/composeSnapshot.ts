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
  type ContentBlock,
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
  /** Zahlungsziel in Tagen (für {{zahlungsziel_tage}} in den Bausteinen). */
  paymentTermsDays: number;
  /** Gültig-bis-Datum im deutschen Format, sonst null (Angebote). */
  validUntilFormatted: string | null;
}

/**
 * Zentrale Wertetabelle für {{variablen}} in Einleitungs-/Schlusstext UND in
 * den Bausteinen (Addendum). Ausstellen, Storno und Editor-Vorschau bauen ihre
 * Werte ausschließlich hierüber, damit kein Weg Variablen "vergisst" (z.B.
 * iban/bic/kontoinhaber in den Zahlungsbedingungen).
 */
export function buildDocumentVariableValues(
  context: DocumentVariableContext,
): Record<string, string | null> {
  return {
    kundenname: context.clientName,
    projektname: context.projectName,
    firmenname: context.issuer.company_name || null,
    datum: context.issueDateFormatted,
    // Bausteine-Variablen aus den Rechnungsstellungs-Settings (Addendum)
    zahlungsziel_tage: String(context.paymentTermsDays),
    iban: context.issuer.iban || null,
    bic: context.issuer.bic || null,
    bank: context.issuer.bank_name || null,
    kontoinhaber: context.issuer.owner_name || context.issuer.company_name || null,
    gueltig_bis: context.validUntilFormatted,
  };
}

/**
 * Aktivierte Baustein-Texte (Titel, Fließtext, aktivierte Stichpunkte) als
 * flache Liste – exakt das, was freezeContentBlocks später einfriert. Damit
 * scannt die Unaufgelöst-Prüfung genau die gerenderten Texte.
 */
export function collectContentBlockTexts(blocks: ContentBlock[]): Array<string | null> {
  const texts: Array<string | null> = [];
  for (const block of blocks) {
    if (!block.enabled) continue;
    texts.push(block.title, block.text);
    for (const item of block.items) {
      if (item.enabled) texts.push(item.text);
    }
  }
  return texts;
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
      if ((value === undefined || value === null || value === '') && !unresolved.includes(name)) {
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
  recipient: {
    name: string;
    contact_person: string | null;
    address: string | null;
    email: string | null;
  };
  line_items: LineItem[];
  /** Bausteine des Dokuments – eingefroren werden nur die aktivierten. */
  content_blocks: ContentBlock[];
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
  /**
   * Wertetabelle aus buildDocumentVariableValues: {{kundenname}},
   * {{projektname}}, {{firmenname}}, {{datum}} sowie {{zahlungsziel_tage}},
   * {{iban}}, {{bic}}, {{bank}}, {{kontoinhaber}}, {{gueltig_bis}}
   * (Addendum, Bausteine).
   */
  variable_values: Record<string, string | null>;
}

/**
 * Nur aktivierte Bausteine, in Reihenfolge, mit aufgelösten Variablen in
 * Titel, Text und Bullets. validity_signature existiert bei Rechnungen
 * nicht (Spec 3.2) und wird dort auch defensiv herausgefiltert.
 *
 * Stichpunkte (Addendum 2): der Snapshot ist die Render-Kopie (EA-06) –
 * deaktivierte Punkte werden nicht gerendert und daher nicht eingefroren;
 * sie bleiben nur am Dokument (content_blocks) erhalten.
 */
function freezeContentBlocks(
  type: DocumentType,
  blocks: ContentBlock[],
  values: Record<string, string | null>,
): ContentBlock[] {
  return blocks
    .filter((block) => block.enabled)
    .filter((block) => !(type === 'invoice' && block.kind === 'validity_signature'))
    .map((block) => ({
      ...block,
      title: resolveDocumentVariables(block.title, values) ?? block.title,
      text: resolveDocumentVariables(block.text, values) ?? block.text,
      items: block.items
        .filter((item) => item.enabled)
        .map((item) => ({
          ...item,
          text: resolveDocumentVariables(item.text, values) ?? item.text,
        })),
    }));
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
    // §19-Satz ist fix und nicht abwählbar. Seit dem Addendum auch auf
    // Angeboten (wie in der Design-Referenz); eingefrorene Alt-Snapshots
    // bleiben unverändert (EA-05 in ENTSCHEIDUNGEN_MODUL_17_ADDENDUM.md).
    kleinunternehmer_hinweis: KLEINUNTERNEHMER_SATZ,
    related_document_number: args.related_document_number,
    content_blocks: freezeContentBlocks(args.type, args.content_blocks, args.variable_values),
  } satisfies DocumentSnapshot);
}
