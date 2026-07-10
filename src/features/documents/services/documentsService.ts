/**
 * Dokument-Service für Angebote und Rechnungen (Modul 17).
 *
 * Garantien auf Service-Ebene (Spec 2.2):
 * - updateDocument/softDeleteDocument arbeiten NUR auf Drafts. Ausgestellte
 *   Dokumente sind inhaltlich unveränderbar und nicht löschbar.
 * - issueDocument zieht die lückenlose Nummer, friert den Snapshot ein und
 *   erzwingt vorher die Pflichtangaben (Rechnung, Spec 2.3).
 * - Ausstellen und Storno laufen serialisiert (Promise-Queue analog
 *   Recurring-Engine Modul 16): paralleles Ausstellen erzeugt keine
 *   doppelten Nummern und kein doppeltes Ausstellen desselben Drafts.
 * - Storno erzeugt eine Gegenrechnung (negierte Einzelpreise) mit eigener
 *   Nummer und Referenz auf das Original; das Original wird nur im Status
 *   auf cancelled gesetzt, sein Snapshot bleibt unverändert.
 */
import { getDatabase } from '@/services/database';
import { getSettingWithDefault } from '@/services/settings';
import { createOrder, getOrderById, updateOrder } from '@/features/orders/services';
import type { Order } from '@/features/orders/types';
import { ACCENT_PRESETS, type AccentPresetKey } from '@/utils/colors';
import {
  DocumentSchema,
  DocumentSnapshotSchema,
  KLEINUNTERNEHMER_SATZ,
  NewDocumentSchema,
  UpdateDocumentSchema,
  calculateDocumentTotal,
  type BusinessDocument,
  type DocumentListItem,
  type DocumentSnapshot,
  type DocumentStatus,
  type DocumentType,
  type LineItem,
  type NewDocumentInput,
  type SnapshotIssuer,
  type UpdateDocumentInput,
} from '../schemas';
import { generateDocumentNumber } from './documentNumber';

type Row = Record<string, unknown>;

function now(): string {
  return new Date().toISOString();
}

function toISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(year, month - 1, day + days);
  return toISODate(date);
}

function formatGermanDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}.${month}.${year}`;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseJsonColumn<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value !== 'string') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function rowToDocument(row: Row): BusinessDocument {
  return DocumentSchema.parse({
    id: row.id,
    type: row.type,
    number: row.number ?? null,
    status: row.status,
    client_id: row.client_id,
    project_id: row.project_id ?? null,
    order_id: row.order_id ?? null,
    related_document_id: row.related_document_id ?? null,
    line_items: parseJsonColumn<LineItem[]>(row.line_items, []),
    total: Number(row.total ?? 0),
    issue_date: row.issue_date ?? null,
    due_date: row.due_date ?? null,
    valid_until: row.valid_until ?? null,
    service_date: row.service_date ?? null,
    intro_text: row.intro_text ?? null,
    outro_text: row.outro_text ?? null,
    layout: row.layout,
    snapshot: parseJsonColumn<DocumentSnapshot | null>(row.snapshot, null),
    pdf_path: row.pdf_path ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at ?? null,
  });
}

// ------------------------------------------------------------
// Firmen-Stammdaten (Settings) und Kunde
// ------------------------------------------------------------
export interface InvoiceSettings {
  issuer: SnapshotIssuer;
  payment_terms_days: number;
  quote_validity_days: number;
  logo: string;
  brand_color: string;
  default_layout: string;
  accent_color_key: string;
}

export async function loadInvoiceSettings(): Promise<InvoiceSettings> {
  const [
    companyName,
    ownerName,
    street,
    zip,
    city,
    taxNumber,
    vatId,
    iban,
    bic,
    bankName,
    paymentTermsDays,
    quoteValidityDays,
    logo,
    brandColor,
    defaultLayout,
    accentColorKey,
  ] = await Promise.all([
    getSettingWithDefault('company_name'),
    getSettingWithDefault('invoice_owner_name'),
    getSettingWithDefault('invoice_street'),
    getSettingWithDefault('invoice_zip'),
    getSettingWithDefault('invoice_city'),
    getSettingWithDefault('invoice_tax_number'),
    getSettingWithDefault('invoice_vat_id'),
    getSettingWithDefault('invoice_iban'),
    getSettingWithDefault('invoice_bic'),
    getSettingWithDefault('invoice_bank_name'),
    getSettingWithDefault('invoice_payment_terms_days'),
    getSettingWithDefault('invoice_quote_validity_days'),
    getSettingWithDefault('invoice_logo'),
    getSettingWithDefault('invoice_brand_color'),
    getSettingWithDefault('invoice_default_layout'),
    getSettingWithDefault('accent_color'),
  ]);

  return {
    issuer: {
      company_name: String(companyName ?? '').trim(),
      owner_name: String(ownerName ?? '').trim(),
      street: String(street ?? '').trim(),
      zip: String(zip ?? '').trim(),
      city: String(city ?? '').trim(),
      tax_number: String(taxNumber ?? '').trim(),
      vat_id: String(vatId ?? '').trim(),
      iban: String(iban ?? '').trim(),
      bic: String(bic ?? '').trim(),
      bank_name: String(bankName ?? '').trim(),
    },
    payment_terms_days: Number(paymentTermsDays) || 14,
    quote_validity_days: Number(quoteValidityDays) || 30,
    logo: String(logo ?? ''),
    brand_color: String(brandColor ?? '').trim(),
    default_layout: String(defaultLayout ?? 'modern'),
    accent_color_key: String(accentColorKey ?? 'sap_blue'),
  };
}

/** Markenfarbe aus den Einstellungen, sonst die App-Akzentfarbe (Hell-Variante). */
export function resolveDocumentAccentColor(settings: InvoiceSettings): string {
  if (/^#[0-9a-fA-F]{6}$/.test(settings.brand_color)) {
    return settings.brand_color.toUpperCase();
  }
  const preset = ACCENT_PRESETS[settings.accent_color_key as AccentPresetKey];
  return preset ? preset.light : ACCENT_PRESETS.sap_blue.light;
}

interface DocumentClient {
  id: string;
  name: string;
  contact_person: string | null;
  address: string | null;
}

async function loadClient(clientId: string): Promise<DocumentClient | null> {
  const rows = await getDatabase().select<Row[]>(
    'SELECT id, name, contact_person, address FROM clients WHERE id = $1 LIMIT 1',
    [clientId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    contact_person: (row.contact_person as string | null) ?? null,
    address: (row.address as string | null) ?? null,
  };
}

async function loadProjectName(projectId: string | null): Promise<string | null> {
  if (!projectId) return null;
  const rows = await getDatabase().select<Row[]>(
    'SELECT name FROM website_projects WHERE id = $1 LIMIT 1',
    [projectId],
  );
  return (rows[0]?.name as string | undefined) ?? null;
}

// ------------------------------------------------------------
// Variablen ({{kundenname}}, {{projektname}}, … über die Registry-Syntax)
// ------------------------------------------------------------
const VARIABLE_REGEX = /\{\{([^}]+)\}\}/g;

export function resolveDocumentVariables(
  text: string | null,
  values: Record<string, string | null>,
): string | null {
  if (!text) return text;
  return text.replace(VARIABLE_REGEX, (match, rawName: string) => {
    const name = rawName.trim().toLowerCase();
    const value = values[name];
    // Unbekannte oder leere Variablen bleiben sichtbar stehen,
    // damit fehlende Angaben im Dokument auffallen.
    return value === undefined || value === null || value === '' ? match : value;
  });
}

// ------------------------------------------------------------
// Pflichtangaben-Validierung (Spec 2.3)
// ------------------------------------------------------------
/** Fehlende Aussteller-Pflichtangaben (auch für die Settings-Checkliste). */
export function getMissingIssuerFields(issuer: SnapshotIssuer): string[] {
  const missing: string[] = [];
  if (!issuer.company_name && !issuer.owner_name) {
    missing.push('Name des Ausstellers (Firmenname oder Inhabername)');
  }
  if (!issuer.street) missing.push('Straße des Ausstellers');
  if (!issuer.zip || !issuer.city) missing.push('PLZ/Ort des Ausstellers');
  if (!issuer.tax_number && !issuer.vat_id) {
    missing.push('Steuernummer oder USt-IdNr des Ausstellers');
  }
  return missing;
}

export function getMissingIssueRequirements(
  document: Pick<BusinessDocument, 'type' | 'line_items' | 'service_date'>,
  issuer: SnapshotIssuer,
  client: Pick<DocumentClient, 'name' | 'address'> | null,
): string[] {
  const missing: string[] = [];

  if (document.line_items.length === 0) {
    missing.push('Mindestens eine Position (Menge und Art der Leistung)');
  }

  if (!client) {
    missing.push('Kunde');
  } else {
    if (!client.name.trim()) missing.push('Name des Empfängers');
    if (document.type === 'invoice' && !client.address?.trim()) {
      missing.push('Anschrift des Empfängers (am Kunden hinterlegen)');
    }
  }

  if (document.type !== 'invoice') {
    return missing;
  }

  missing.push(...getMissingIssuerFields(issuer));
  if (!document.service_date?.trim()) {
    missing.push('Leistungsdatum oder -zeitraum');
  }

  return missing;
}

// ------------------------------------------------------------
// CRUD (Drafts)
// ------------------------------------------------------------
export async function createDocument(data: NewDocumentInput): Promise<BusinessDocument> {
  try {
    const input = NewDocumentSchema.parse(data);
    const settings = await loadInvoiceSettings();
    const db = getDatabase();
    const id = crypto.randomUUID();
    const timestamp = now();
    const lineItems = input.line_items ?? [];
    const layout = input.layout ?? (settings.default_layout === 'classic' ? 'classic' : 'modern');

    await db.execute(
      `INSERT INTO documents (
        id, type, number, status, client_id, project_id, order_id,
        related_document_id, line_items, total, issue_date, due_date,
        valid_until, service_date, intro_text, outro_text, layout,
        snapshot, pdf_path, created_at, updated_at, deleted_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
      [
        id,
        input.type,
        null,
        'draft',
        input.client_id,
        input.project_id ?? null,
        input.order_id ?? null,
        null,
        JSON.stringify(lineItems),
        calculateDocumentTotal(lineItems),
        null,
        null,
        null,
        input.service_date ?? null,
        input.intro_text ?? null,
        input.outro_text ?? null,
        layout,
        null,
        null,
        timestamp,
        timestamp,
        null,
      ],
    );

    const document = await getDocumentById(id);
    if (!document) throw new Error('Dokument wurde nach dem Erstellen nicht gefunden.');
    return document;
  } catch (error) {
    throw new Error(`Dokument konnte nicht erstellt werden: ${errorText(error)}`);
  }
}

const DOCUMENT_UPDATE_FIELDS = [
  'client_id',
  'project_id',
  'order_id',
  'service_date',
  'intro_text',
  'outro_text',
  'layout',
] as const;

export async function updateDocument(
  id: string,
  data: UpdateDocumentInput,
): Promise<BusinessDocument> {
  try {
    const input = UpdateDocumentSchema.parse(data);
    const existing = await getDocumentById(id);
    if (!existing) throw new Error(`Dokument ${id} nicht gefunden.`);
    if (existing.status !== 'draft') {
      throw new Error('Ausgestellte Dokumente sind unveränderbar (nur Entwürfe bearbeitbar).');
    }

    const setClauses = ['updated_at = $1'];
    const params: unknown[] = [now()];

    for (const field of DOCUMENT_UPDATE_FIELDS) {
      if (!(field in input) || input[field] === undefined) continue;
      params.push(input[field] ?? null);
      setClauses.push(`${field} = $${params.length}`);
    }

    if (input.line_items !== undefined) {
      params.push(JSON.stringify(input.line_items));
      setClauses.push(`line_items = $${params.length}`);
      params.push(calculateDocumentTotal(input.line_items));
      setClauses.push(`total = $${params.length}`);
    }

    if (setClauses.length > 1) {
      params.push(id);
      await getDatabase().execute(
        `UPDATE documents SET ${setClauses.join(', ')} WHERE id = $${params.length}`,
        params,
      );
    }

    const updated = await getDocumentById(id);
    if (!updated) throw new Error(`Dokument ${id} nicht gefunden nach Update.`);
    return updated;
  } catch (error) {
    throw new Error(`Dokument konnte nicht aktualisiert werden: ${errorText(error)}`);
  }
}

export async function softDeleteDocument(id: string): Promise<void> {
  try {
    const existing = await getDocumentById(id);
    if (!existing) throw new Error(`Dokument ${id} nicht gefunden.`);
    if (existing.status !== 'draft') {
      throw new Error(
        'Nur Entwürfe können gelöscht werden. Ausgestellte Rechnungen sind nur stornierbar.',
      );
    }

    const timestamp = now();
    await getDatabase().execute(
      'UPDATE documents SET deleted_at = $1, updated_at = $2 WHERE id = $3',
      [timestamp, timestamp, id],
    );
  } catch (error) {
    throw new Error(`Dokument konnte nicht gelöscht werden: ${errorText(error)}`);
  }
}

export interface DocumentFilters {
  type?: DocumentType;
  status?: DocumentStatus[];
  overdueOnly?: boolean;
  showDeleted?: boolean;
}

export async function getDocuments(filters?: DocumentFilters): Promise<DocumentListItem[]> {
  try {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (!filters?.showDeleted) clauses.push('d.deleted_at IS NULL');
    if (filters?.type) {
      params.push(filters.type);
      clauses.push(`d.type = $${params.length}`);
    }
    if (filters?.status && filters.status.length > 0) {
      const placeholders = filters.status.map((status) => {
        params.push(status);
        return `$${params.length}`;
      });
      clauses.push(`d.status IN (${placeholders.join(', ')})`);
    }
    if (filters?.overdueOnly) {
      params.push(toISODate(new Date()));
      clauses.push(
        `d.type = 'invoice' AND d.status = 'issued' AND d.due_date IS NOT NULL AND d.due_date < $${params.length}`,
      );
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await getDatabase().select<Row[]>(
      `SELECT d.*, c.name AS client_name
       FROM documents d
       JOIN clients c ON c.id = d.client_id
       ${where}
       ORDER BY d.created_at DESC`,
      params,
    );

    return rows.map((row) => ({
      ...rowToDocument(row),
      client_name: String(row.client_name ?? ''),
    }));
  } catch (error) {
    throw new Error(`Dokumente konnten nicht geladen werden: ${errorText(error)}`);
  }
}

export async function getDocumentById(id: string): Promise<BusinessDocument | null> {
  try {
    const rows = await getDatabase().select<Row[]>(
      'SELECT * FROM documents WHERE id = $1 LIMIT 1',
      [id],
    );
    return rows[0] ? rowToDocument(rows[0]) : null;
  } catch (error) {
    throw new Error(`Dokument konnte nicht geladen werden: ${errorText(error)}`);
  }
}

// ------------------------------------------------------------
// Ausstellen (Nummer + Snapshot), serialisiert
// ------------------------------------------------------------
let issueQueue: Promise<unknown> = Promise.resolve();

function runIssueExclusive<T>(operation: () => Promise<T>): Promise<T> {
  const run = issueQueue.then(operation);
  // Fehler eines Vorgängers dürfen die Queue nicht vergiften.
  issueQueue = run.catch(() => undefined);
  return run;
}

export function issueDocument(id: string, nowDate = new Date()): Promise<BusinessDocument> {
  return runIssueExclusive(() => issueDocumentExclusive(id, nowDate));
}

async function issueDocumentExclusive(id: string, nowDate: Date): Promise<BusinessDocument> {
  try {
    const document = await getDocumentById(id);
    if (!document) throw new Error(`Dokument ${id} nicht gefunden.`);
    if (document.deleted_at) throw new Error('Gelöschte Entwürfe können nicht ausgestellt werden.');
    if (document.status !== 'draft') {
      throw new Error('Dokument ist bereits ausgestellt.');
    }

    const [settings, client] = await Promise.all([
      loadInvoiceSettings(),
      loadClient(document.client_id),
    ]);

    const missing = getMissingIssueRequirements(document, settings.issuer, client);
    if (missing.length > 0) {
      throw new Error(`Pflichtangaben fehlen: ${missing.join(', ')}`);
    }
    if (!client) throw new Error('Kunde nicht gefunden.');

    const db = getDatabase();
    const issueDate = toISODate(nowDate);
    const year = nowDate.getFullYear();
    const number = await generateDocumentNumber(db, document.type, year);
    const dueDate =
      document.type === 'invoice' ? addDays(issueDate, settings.payment_terms_days) : null;
    const validUntil =
      document.type === 'quote' ? addDays(issueDate, settings.quote_validity_days) : null;

    const projectName = await loadProjectName(document.project_id);
    const variableValues: Record<string, string | null> = {
      kundenname: client.name,
      projektname: projectName,
      firmenname: settings.issuer.company_name,
      datum: formatGermanDate(issueDate),
    };

    const relatedNumber = document.related_document_id
      ? ((await getDocumentById(document.related_document_id))?.number ?? null)
      : null;

    const snapshot = DocumentSnapshotSchema.parse({
      type: document.type,
      number,
      issuer: settings.issuer,
      recipient: {
        name: client.name,
        contact_person: client.contact_person,
        address: client.address,
      },
      line_items: document.line_items,
      total: document.total,
      issue_date: issueDate,
      due_date: dueDate,
      valid_until: validUntil,
      service_date: document.service_date,
      intro_text: resolveDocumentVariables(document.intro_text, variableValues),
      outro_text: resolveDocumentVariables(document.outro_text, variableValues),
      layout: document.layout,
      accent_color: resolveDocumentAccentColor(settings),
      logo: settings.logo || null,
      kleinunternehmer_hinweis: document.type === 'invoice' ? KLEINUNTERNEHMER_SATZ : null,
      related_document_number: relatedNumber,
    } satisfies DocumentSnapshot);

    await db.execute(
      `UPDATE documents
       SET number = $1, status = 'issued', issue_date = $2, due_date = $3,
           valid_until = $4, snapshot = $5, updated_at = $6
       WHERE id = $7 AND status = 'draft'`,
      [number, issueDate, dueDate, validUntil, JSON.stringify(snapshot), now(), id],
    );

    const issued = await getDocumentById(id);
    if (!issued || issued.status !== 'issued') {
      throw new Error('Dokument konnte nicht ausgestellt werden.');
    }
    return issued;
  } catch (error) {
    throw new Error(`Dokument konnte nicht ausgestellt werden: ${errorText(error)}`);
  }
}

// ------------------------------------------------------------
// Statuswechsel auf ausgestellten Dokumenten (kein Inhalt, nur Status/Links)
// ------------------------------------------------------------
async function setDocumentStatus(id: string, status: DocumentStatus): Promise<BusinessDocument> {
  await getDatabase().execute('UPDATE documents SET status = $1, updated_at = $2 WHERE id = $3', [
    status,
    now(),
    id,
  ]);
  const updated = await getDocumentById(id);
  if (!updated) throw new Error(`Dokument ${id} nicht gefunden nach Statuswechsel.`);
  return updated;
}

export async function markQuoteAccepted(id: string): Promise<BusinessDocument> {
  try {
    const document = await getDocumentById(id);
    if (!document) throw new Error(`Dokument ${id} nicht gefunden.`);
    if (document.type !== 'quote' || document.status !== 'issued') {
      throw new Error('Nur ausgestellte Angebote können angenommen werden.');
    }
    return await setDocumentStatus(id, 'accepted');
  } catch (error) {
    throw new Error(`Angebot konnte nicht angenommen werden: ${errorText(error)}`);
  }
}

export async function markQuoteRejected(id: string): Promise<BusinessDocument> {
  try {
    const document = await getDocumentById(id);
    if (!document) throw new Error(`Dokument ${id} nicht gefunden.`);
    if (document.type !== 'quote' || document.status !== 'issued') {
      throw new Error('Nur ausgestellte Angebote können abgelehnt werden.');
    }
    return await setDocumentStatus(id, 'rejected');
  } catch (error) {
    throw new Error(`Angebot konnte nicht abgelehnt werden: ${errorText(error)}`);
  }
}

/**
 * Angebot → Rechnung: erzeugt einen Rechnungs-Draft mit übernommenen
 * Positionen und Referenz auf das Angebot; das Angebot wird (falls noch
 * issued) als angenommen markiert.
 */
export async function convertQuoteToInvoice(
  quoteId: string,
): Promise<{ invoice: BusinessDocument; quote: BusinessDocument }> {
  try {
    const quote = await getDocumentById(quoteId);
    if (!quote) throw new Error(`Angebot ${quoteId} nicht gefunden.`);
    if (quote.type !== 'quote') throw new Error('Nur Angebote können umgewandelt werden.');
    if (!['issued', 'accepted'].includes(quote.status)) {
      throw new Error('Nur ausgestellte oder angenommene Angebote können umgewandelt werden.');
    }

    const invoice = await createDocument({
      type: 'invoice',
      client_id: quote.client_id,
      project_id: quote.project_id,
      line_items: quote.line_items,
      intro_text: quote.intro_text,
      outro_text: quote.outro_text,
      layout: quote.layout,
    });

    await getDatabase().execute(
      'UPDATE documents SET related_document_id = $1, updated_at = $2 WHERE id = $3',
      [quote.id, now(), invoice.id],
    );

    const updatedQuote =
      quote.status === 'issued' ? await setDocumentStatus(quote.id, 'accepted') : quote;
    const linkedInvoice = await getDocumentById(invoice.id);
    if (!linkedInvoice) throw new Error('Rechnungs-Entwurf nicht gefunden nach Verknüpfung.');
    return { invoice: linkedInvoice, quote: updatedQuote };
  } catch (error) {
    throw new Error(`Angebot konnte nicht umgewandelt werden: ${errorText(error)}`);
  }
}

// ------------------------------------------------------------
// Als bezahlt markieren (mit Auftrags-Kopplung, Spec Abschnitt 5)
// ------------------------------------------------------------

/** Setzt den verknüpften Auftrag so, dass Umsatz und EÜR stimmen (Zuflussprinzip). */
async function markLinkedOrderPaid(orderId: string, paymentDate: string): Promise<Order> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error(`Verknüpfter Auftrag ${orderId} nicht gefunden.`);

  // Die EÜR zählt nur completed/shipped mit payment_status paid
  // (EUER_INCOME_STATUSES, Modul 14) – deshalb wird der Status mitgezogen.
  const statusUpdate =
    order.status === 'completed' || order.status === 'shipped'
      ? {}
      : { status: 'completed' as const };

  return updateOrder(orderId, {
    ...statusUpdate,
    payment_status: 'paid',
    payment_received_date: order.payment_received_date ?? paymentDate,
  });
}

export async function markInvoicePaid(
  id: string,
  nowDate = new Date(),
): Promise<{ document: BusinessDocument; order: Order | null }> {
  try {
    const document = await getDocumentById(id);
    if (!document) throw new Error(`Dokument ${id} nicht gefunden.`);
    if (document.type !== 'invoice' || document.status !== 'issued') {
      throw new Error('Nur ausgestellte Rechnungen können als bezahlt markiert werden.');
    }

    const order = document.order_id
      ? await markLinkedOrderPaid(document.order_id, toISODate(nowDate))
      : null;
    const updated = await setDocumentStatus(id, 'paid');
    return { document: updated, order };
  } catch (error) {
    throw new Error(`Rechnung konnte nicht als bezahlt markiert werden: ${errorText(error)}`);
  }
}

/**
 * Bezahlt markieren OHNE verknüpften Auftrag: erzeugt auf Wunsch des Nutzers
 * einen Auftrag (Plattform website, bezahlt), verknüpft ihn und setzt die
 * Rechnung auf paid.
 */
export async function markInvoicePaidWithNewOrder(
  id: string,
  nowDate = new Date(),
): Promise<{ document: BusinessDocument; order: Order }> {
  try {
    const document = await getDocumentById(id);
    if (!document) throw new Error(`Dokument ${id} nicht gefunden.`);
    if (document.type !== 'invoice' || document.status !== 'issued') {
      throw new Error('Nur ausgestellte Rechnungen können als bezahlt markiert werden.');
    }
    if (document.order_id) {
      throw new Error('Rechnung hat bereits einen verknüpften Auftrag.');
    }
    if (document.total < 0) {
      throw new Error('Für Storno-Rechnungen wird kein Auftrag erzeugt.');
    }

    const client = await loadClient(document.client_id);
    const paymentDate = toISODate(nowDate);
    const order = await createOrder({
      platform: 'website',
      customer_name: client?.name ?? null,
      sale_price: document.total,
      status: 'completed',
      payment_status: 'paid',
      payment_received_date: paymentDate,
      order_date: document.issue_date ?? paymentDate,
      notes: `Rechnung ${document.number ?? ''}`.trim(),
    });

    await getDatabase().execute(
      'UPDATE documents SET order_id = $1, updated_at = $2 WHERE id = $3',
      [order.id, now(), id],
    );

    const updated = await setDocumentStatus(id, 'paid');
    return { document: updated, order };
  } catch (error) {
    throw new Error(`Rechnung konnte nicht als bezahlt markiert werden: ${errorText(error)}`);
  }
}

// ------------------------------------------------------------
// Storno (Gegenrechnung mit Referenz, Spec 2.2)
// ------------------------------------------------------------
export function cancelInvoice(
  id: string,
  nowDate = new Date(),
): Promise<{ storno: BusinessDocument; original: BusinessDocument }> {
  return runIssueExclusive(() => cancelInvoiceExclusive(id, nowDate));
}

async function cancelInvoiceExclusive(
  id: string,
  nowDate: Date,
): Promise<{ storno: BusinessDocument; original: BusinessDocument }> {
  try {
    const original = await getDocumentById(id);
    if (!original) throw new Error(`Dokument ${id} nicht gefunden.`);
    if (original.type !== 'invoice') throw new Error('Nur Rechnungen können storniert werden.');
    if (!['issued', 'paid'].includes(original.status)) {
      throw new Error('Nur ausgestellte oder bezahlte Rechnungen können storniert werden.');
    }
    if (!original.number || !original.snapshot) {
      throw new Error('Rechnung hat keine Nummer/Snapshot – Storno nicht möglich.');
    }
    if (original.total < 0) {
      throw new Error('Storno-Rechnungen können nicht erneut storniert werden.');
    }

    const settings = await loadInvoiceSettings();
    const db = getDatabase();
    const issueDate = toISODate(nowDate);
    const number = await generateDocumentNumber(db, 'invoice', nowDate.getFullYear());

    const stornoItems: LineItem[] = original.line_items.map((item) => ({
      ...item,
      unit_price: -item.unit_price,
    }));
    const stornoTotal = calculateDocumentTotal(stornoItems);
    const introText = `Stornorechnung zur Rechnung ${original.number} vom ${formatGermanDate(
      original.issue_date ?? issueDate,
    )}.`;

    // Empfänger aus dem Original-Snapshot: Das Storno gehört kaufmännisch
    // zum Original und darf spätere Kundenänderungen nicht aufnehmen.
    const snapshot = DocumentSnapshotSchema.parse({
      type: 'invoice',
      number,
      issuer: settings.issuer,
      recipient: original.snapshot.recipient,
      line_items: stornoItems,
      total: stornoTotal,
      issue_date: issueDate,
      due_date: null,
      valid_until: null,
      service_date: original.service_date,
      intro_text: introText,
      outro_text: null,
      layout: original.layout,
      accent_color: resolveDocumentAccentColor(settings),
      logo: settings.logo || null,
      kleinunternehmer_hinweis: KLEINUNTERNEHMER_SATZ,
      related_document_number: original.number,
    } satisfies DocumentSnapshot);

    const stornoId = crypto.randomUUID();
    const timestamp = now();
    await db.execute(
      `INSERT INTO documents (
        id, type, number, status, client_id, project_id, order_id,
        related_document_id, line_items, total, issue_date, due_date,
        valid_until, service_date, intro_text, outro_text, layout,
        snapshot, pdf_path, created_at, updated_at, deleted_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
      [
        stornoId,
        'invoice',
        number,
        'issued',
        original.client_id,
        original.project_id,
        original.order_id,
        original.id,
        JSON.stringify(stornoItems),
        stornoTotal,
        issueDate,
        null,
        null,
        original.service_date,
        introText,
        null,
        original.layout,
        JSON.stringify(snapshot),
        null,
        timestamp,
        timestamp,
        null,
      ],
    );

    const cancelledOriginal = await setDocumentStatus(original.id, 'cancelled');
    const storno = await getDocumentById(stornoId);
    if (!storno) throw new Error('Stornorechnung wurde nach dem Erstellen nicht gefunden.');
    return { storno, original: cancelledOriginal };
  } catch (error) {
    throw new Error(`Rechnung konnte nicht storniert werden: ${errorText(error)}`);
  }
}

// ------------------------------------------------------------
// PDF-Metadaten (kein Inhalt – auch auf ausgestellten Dokumenten erlaubt)
// ------------------------------------------------------------
export async function updateDocumentPdfPath(id: string, pdfPath: string): Promise<void> {
  try {
    await getDatabase().execute(
      'UPDATE documents SET pdf_path = $1, updated_at = $2 WHERE id = $3',
      [pdfPath, now(), id],
    );
  } catch (error) {
    throw new Error(`PDF-Pfad konnte nicht gespeichert werden: ${errorText(error)}`);
  }
}
