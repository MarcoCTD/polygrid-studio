/**
 * Integrationstests Dokument-Service (Modul 17, Etappe A) gegen eine echte
 * In-Memory-SQLite (sql.js) mit den echten Drizzle-Migrationen der App –
 * gleiches Muster wie websitesCrud.test.ts.
 *
 * Abgedeckt: Nummernkreis-Parallelität, Snapshot-Isolation, Unveränderbarkeit,
 * Storno, Pflichtangaben-Gate, Angebot→Rechnung, Bezahlt-Markieren inkl.
 * EÜR-Aggregation (Modul 14).
 */
import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic } from 'sql.js';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MIGRATIONS } from '@/services/database/migrations';

type SqlValue = string | number | null;
type Row = Record<string, unknown>;

function toSqlValue(value: unknown): SqlValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number' || typeof value === 'string') return value;
  return JSON.stringify(value);
}

function toBindParams(query: string, values: unknown[]): Record<string, SqlValue> | SqlValue[] {
  if (/\$\d+/.test(query)) {
    const params: Record<string, SqlValue> = {};
    values.forEach((value, index) => {
      params[`$${index + 1}`] = toSqlValue(value);
    });
    return params;
  }
  return values.map(toSqlValue);
}

/** Minimaler Ersatz für die Tauri-SQL-Plugin-Database im Test. */
class TestDatabase {
  constructor(private readonly db: SqlJsDatabase) {}

  async execute(query: string, values: unknown[] = []): Promise<unknown> {
    if (values.length > 0) {
      this.db.run(query, toBindParams(query, values));
    } else {
      this.db.run(query);
    }
    return [this.db.getRowsModified(), 0];
  }

  async select<T>(query: string, values: unknown[] = []): Promise<T> {
    const stmt = this.db.prepare(query);
    try {
      if (values.length > 0) stmt.bind(toBindParams(query, values));
      const rows: Row[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      return rows as T;
    } finally {
      stmt.free();
    }
  }
}

const holder = vi.hoisted(() => ({
  db: null as unknown as {
    select: <T>(q: string, v?: unknown[]) => Promise<T>;
    execute: (q: string, v?: unknown[]) => Promise<unknown>;
  },
}));

vi.mock('@/services/database', () => ({
  getDatabase: () => holder.db,
  initDatabase: async () => undefined,
  getSetting: async <T>(key: string): Promise<T | null> => {
    const rows = await holder.db.select<{ value: string }[]>(
      'SELECT value FROM app_settings WHERE key = $1',
      [key],
    );
    if (rows.length === 0) return null;
    return JSON.parse(rows[0].value) as T;
  },
  setSetting: async (key: string, value: unknown): Promise<void> => {
    await holder.db.execute(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, $3)
       ON CONFLICT(key) DO UPDATE SET value = $2, updated_at = $3`,
      [key, JSON.stringify(value), new Date().toISOString()],
    );
  },
}));

// Nach dem Mock importieren, damit alle Services die Test-DB nutzen.
const {
  cancelInvoice,
  convertQuoteToInvoice,
  createDocument,
  getDefaultContentBlocksForType,
  getDefaultDocumentTexts,
  getDocumentById,
  getDocuments,
  getMissingIssueRequirements,
  issueDocument,
  markInvoicePaid,
  markInvoicePaidWithNewOrder,
  markQuoteRejected,
  saveDefaultContentBlocksForType,
  saveDefaultDocumentTexts,
  softDeleteDocument,
  updateDocument,
  updateDocumentPdfPath,
} = await import('./documentsService');
const {
  DOCUMENT_POSITION_TEMPLATES_SETTING_KEY,
  getPositionTemplates,
  lineItemFromPositionTemplate,
  savePositionTemplates,
} = await import('./positionTemplates');
const { resetDocumentNumberGeneratorForTests } = await import('./documentNumber');
const { KLEINUNTERNEHMER_SATZ } = await import('../schemas');
const { buildDefaultContentBlocks } = await import('../contentBlocks');
const { buildEuerYearReport } = await import('@/features/finance/services/euerYear');
const { resetReceiptNumberGeneratorForTests } =
  await import('@/features/orders/services/receiptNumber');

let SQL: SqlJsStatic;
let rawDb: SqlJsDatabase;

function select(query: string, values: unknown[] = []): Row[] {
  const stmt = rawDb.prepare(query);
  try {
    if (values.length > 0) stmt.bind(toBindParams(query, values));
    const rows: Row[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
}

function execute(query: string, values: unknown[] = []): void {
  if (values.length > 0) {
    rawDb.run(query, toBindParams(query, values));
  } else {
    rawDb.run(query);
  }
}

function setSettingRow(key: string, value: unknown): void {
  execute(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, $3)
     ON CONFLICT(key) DO UPDATE SET value = $2, updated_at = $3`,
    [key, JSON.stringify(value), new Date().toISOString()],
  );
}

/** Vollständige Aussteller-Stammdaten, damit Rechnungen ausstellbar sind. */
function seedIssuerSettings(): void {
  setSettingRow('company_name', 'PolyGrid Studio');
  setSettingRow('invoice_owner_name', 'Marco Kromer');
  setSettingRow('invoice_street', 'Musterstraße 1');
  setSettingRow('invoice_zip', '12345');
  setSettingRow('invoice_city', 'Musterstadt');
  setSettingRow('invoice_tax_number', '12/345/67890');
  setSettingRow('invoice_iban', 'DE02120300000000202051');
  setSettingRow('invoice_bic', 'BYLADEM1001');
  setSettingRow('invoice_bank_name', 'Testbank');
}

const CLIENT_ID = 'aaaaaaaa-1111-4111-8111-111111111111';

function seedClient(options: { id?: string; name?: string; address?: string | null } = {}): string {
  const id = options.id ?? CLIENT_ID;
  const timestamp = new Date().toISOString();
  execute(
    `INSERT INTO clients (id, name, address, credentials, created_at, updated_at)
     VALUES ($1, $2, $3, '[]', $4, $5)`,
    [
      id,
      options.name ?? 'Malerbetrieb Weber',
      options.address === undefined ? 'Wandweg 3\n54321 Pinselhausen' : options.address,
      timestamp,
      timestamp,
    ],
  );
  return id;
}

const LINE_ITEMS = [
  { description: 'Website-Erstellung', quantity: 1, unit_price: 1200 },
  { description: 'Wartung Juli', quantity: 2, unit_price: 45.5 },
];

async function createInvoiceDraft(overrides: Record<string, unknown> = {}) {
  return createDocument({
    type: 'invoice',
    client_id: CLIENT_ID,
    line_items: LINE_ITEMS,
    service_date: '2026-07-01',
    ...overrides,
  });
}

beforeAll(async () => {
  SQL = await initSqlJs();
});

beforeEach(() => {
  rawDb = new SQL.Database();
  for (const migration of MIGRATIONS) {
    for (const statement of migration.sql.split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed) rawDb.run(trimmed);
    }
  }
  holder.db = new TestDatabase(rawDb);
  resetDocumentNumberGeneratorForTests();
  resetReceiptNumberGeneratorForTests();
  seedIssuerSettings();
  seedClient();
});

describe('Drafts und Nummernkreis', () => {
  it('legt Drafts ohne Nummer an und berechnet die Summe', async () => {
    const draft = await createInvoiceDraft();

    expect(draft.number).toBeNull();
    expect(draft.status).toBe('draft');
    expect(draft.total).toBe(1291);
  });

  it('verworfene Drafts verbrauchen keine Nummern', async () => {
    const discarded = await createInvoiceDraft();
    await softDeleteDocument(discarded.id);

    const draft = await createInvoiceDraft();
    const issued = await issueDocument(draft.id, new Date(2026, 6, 10));

    expect(issued.number).toBe('R-2026-001');
  });

  it('vergibt beim parallelen Ausstellen keine doppelten Nummern', async () => {
    const drafts = await Promise.all([
      createInvoiceDraft(),
      createInvoiceDraft(),
      createInvoiceDraft(),
    ]);

    const issued = await Promise.all(
      drafts.map((draft) => issueDocument(draft.id, new Date(2026, 6, 10))),
    );

    const numbers = issued.map((document) => document.number).sort();
    expect(numbers).toEqual(['R-2026-001', 'R-2026-002', 'R-2026-003']);
  });

  it('doppeltes Ausstellen desselben Drafts schlägt fehl', async () => {
    const draft = await createInvoiceDraft();
    const results = await Promise.allSettled([
      issueDocument(draft.id, new Date(2026, 6, 10)),
      issueDocument(draft.id, new Date(2026, 6, 10)),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const rows = select('SELECT number FROM documents WHERE id = $1', [draft.id]);
    expect(rows[0].number).toBe('R-2026-001');
  });

  it('führt Angebote und Rechnungen als getrennte Kreise', async () => {
    const quote = await createDocument({
      type: 'quote',
      client_id: CLIENT_ID,
      line_items: LINE_ITEMS,
    });
    const invoice = await createInvoiceDraft();

    const issuedQuote = await issueDocument(quote.id, new Date(2026, 6, 10));
    const issuedInvoice = await issueDocument(invoice.id, new Date(2026, 6, 10));

    expect(issuedQuote.number).toBe('A-2026-001');
    expect(issuedInvoice.number).toBe('R-2026-001');
  });
});

describe('Pflichtangaben (Spec 2.3)', () => {
  it('blockiert das Ausstellen einer Rechnung ohne Positionen', async () => {
    const draft = await createDocument({
      type: 'invoice',
      client_id: CLIENT_ID,
      service_date: '2026-07-01',
    });

    await expect(issueDocument(draft.id)).rejects.toThrow(/Position/);
  });

  it('blockiert das Ausstellen ohne Aussteller-Anschrift und nennt die Lücken', async () => {
    setSettingRow('invoice_street', '');
    const draft = await createInvoiceDraft();

    await expect(issueDocument(draft.id)).rejects.toThrow(/Straße des Ausstellers/);
  });

  it('blockiert das Ausstellen ohne Steuernummer/USt-IdNr', async () => {
    setSettingRow('invoice_tax_number', '');
    const draft = await createInvoiceDraft();

    await expect(issueDocument(draft.id)).rejects.toThrow(/Steuernummer oder USt-IdNr/);
  });

  it('blockiert das Ausstellen ohne Leistungsdatum', async () => {
    const draft = await createDocument({
      type: 'invoice',
      client_id: CLIENT_ID,
      line_items: LINE_ITEMS,
    });

    await expect(issueDocument(draft.id)).rejects.toThrow(/Leistungsdatum/);
  });

  it('blockiert das Ausstellen ohne Kundenanschrift', async () => {
    const clientId = seedClient({
      id: 'bbbbbbbb-2222-4222-8222-222222222222',
      name: 'Ohne Adresse',
      address: null,
    });
    const draft = await createInvoiceDraft({ client_id: clientId });

    await expect(issueDocument(draft.id)).rejects.toThrow(/Anschrift des Empfängers/);
  });

  it('Angebote brauchen nur Kunde und Positionen', async () => {
    setSettingRow('invoice_street', '');
    setSettingRow('invoice_tax_number', '');
    const quote = await createDocument({
      type: 'quote',
      client_id: CLIENT_ID,
      line_items: LINE_ITEMS,
    });

    const issued = await issueDocument(quote.id, new Date(2026, 6, 10));
    expect(issued.status).toBe('issued');
    expect(issued.valid_until).toBe('2026-08-09');
  });

  it('getMissingIssueRequirements listet alle fehlenden Angaben', () => {
    const missing = getMissingIssueRequirements(
      { type: 'invoice', line_items: [], service_date: null },
      {
        company_name: '',
        owner_name: '',
        street: '',
        zip: '',
        city: '',
        tax_number: '',
        vat_id: '',
        iban: '',
        bic: '',
        bank_name: '',
        email: '',
        phone: '',
        website: '',
      },
      { name: 'Kunde', address: null },
    );

    expect(missing).toEqual([
      'Mindestens eine Position (Menge und Art der Leistung)',
      'Anschrift des Empfängers (am Kunden hinterlegen)',
      'Name des Ausstellers (Firmenname oder Inhabername)',
      'Straße des Ausstellers',
      'PLZ/Ort des Ausstellers',
      'Steuernummer oder USt-IdNr des Ausstellers',
      'Leistungsdatum oder -zeitraum',
    ]);
  });
});

describe('Snapshot und Unveränderbarkeit (Spec 2.2)', () => {
  it('friert beim Ausstellen alle gerenderten Daten ein (Snapshot-Isolation)', async () => {
    const draft = await createInvoiceDraft({
      intro_text: 'Sehr geehrte Damen und Herren von {{kundenname}},',
    });
    const issued = await issueDocument(draft.id, new Date(2026, 6, 10));

    expect(issued.snapshot).not.toBeNull();
    expect(issued.snapshot?.number).toBe('R-2026-001');
    expect(issued.snapshot?.issuer.street).toBe('Musterstraße 1');
    expect(issued.snapshot?.recipient.name).toBe('Malerbetrieb Weber');
    expect(issued.snapshot?.intro_text).toBe(
      'Sehr geehrte Damen und Herren von Malerbetrieb Weber,',
    );
    expect(issued.snapshot?.kleinunternehmer_hinweis).toBe(KLEINUNTERNEHMER_SATZ);
    expect(issued.due_date).toBe('2026-07-24');

    // Livedaten NACH dem Ausstellen ändern – der Snapshot bleibt unberührt.
    execute('UPDATE clients SET name = $1, address = $2 WHERE id = $3', [
      'Umbenannter Kunde GmbH',
      'Neue Straße 99',
      CLIENT_ID,
    ]);
    setSettingRow('invoice_street', 'Umgezogene Straße 42');
    setSettingRow('company_name', 'Umbenannte Firma');

    const reloaded = await getDocumentById(issued.id);
    expect(reloaded?.snapshot?.recipient.name).toBe('Malerbetrieb Weber');
    expect(reloaded?.snapshot?.recipient.address).toBe('Wandweg 3\n54321 Pinselhausen');
    expect(reloaded?.snapshot?.issuer.street).toBe('Musterstraße 1');
    expect(reloaded?.snapshot?.issuer.company_name).toBe('PolyGrid Studio');
  });

  it('lehnt inhaltliche Updates auf ausgestellten Dokumenten ab', async () => {
    const draft = await createInvoiceDraft();
    await issueDocument(draft.id, new Date(2026, 6, 10));

    await expect(
      updateDocument(draft.id, {
        line_items: [{ description: 'Manipuliert', quantity: 1, unit_price: 1 }],
      }),
    ).rejects.toThrow(/unveränderbar/);
  });

  it('lehnt das Löschen ausgestellter Rechnungen ab', async () => {
    const draft = await createInvoiceDraft();
    await issueDocument(draft.id, new Date(2026, 6, 10));

    await expect(softDeleteDocument(draft.id)).rejects.toThrow(/stornierbar/);
  });

  it('erlaubt Updates auf Drafts und rechnet die Summe neu', async () => {
    const draft = await createInvoiceDraft();
    const updated = await updateDocument(draft.id, {
      line_items: [{ description: 'Nur eine Position', quantity: 3, unit_price: 10 }],
    });

    expect(updated.total).toBe(30);
  });
});

describe('Storno (Gegenrechnung)', () => {
  it('erzeugt eine Gegenrechnung mit negierten Preisen, Referenz und eigener Nummer', async () => {
    const draft = await createInvoiceDraft();
    const issued = await issueDocument(draft.id, new Date(2026, 6, 10));

    const { storno, original } = await cancelInvoice(issued.id, new Date(2026, 6, 12));

    expect(original.status).toBe('cancelled');
    expect(original.number).toBe('R-2026-001');
    expect(storno.number).toBe('R-2026-002');
    expect(storno.status).toBe('issued');
    expect(storno.related_document_id).toBe(issued.id);
    expect(storno.total).toBe(-1291);
    expect(storno.line_items.map((item) => item.unit_price)).toEqual([-1200, -45.5]);
    expect(storno.snapshot?.related_document_number).toBe('R-2026-001');
    expect(storno.snapshot?.kleinunternehmer_hinweis).toBe(KLEINUNTERNEHMER_SATZ);
  });

  it('Stornos können nicht erneut storniert werden', async () => {
    const draft = await createInvoiceDraft();
    const issued = await issueDocument(draft.id, new Date(2026, 6, 10));
    const { storno } = await cancelInvoice(issued.id, new Date(2026, 6, 12));

    await expect(cancelInvoice(storno.id)).rejects.toThrow(/nicht erneut storniert/);
  });

  it('Drafts können nicht storniert werden', async () => {
    const draft = await createInvoiceDraft();

    await expect(cancelInvoice(draft.id)).rejects.toThrow(/ausgestellte oder bezahlte/);
  });

  it('Storno übernimmt den Empfänger aus dem Original-Snapshot', async () => {
    const draft = await createInvoiceDraft();
    const issued = await issueDocument(draft.id, new Date(2026, 6, 10));

    execute('UPDATE clients SET name = $1 WHERE id = $2', ['Später umbenannt', CLIENT_ID]);
    const { storno } = await cancelInvoice(issued.id, new Date(2026, 6, 12));

    expect(storno.snapshot?.recipient.name).toBe('Malerbetrieb Weber');
  });
});

describe('Angebot → Rechnung', () => {
  it('übernimmt Positionen und verknüpft beide Dokumente', async () => {
    const quote = await createDocument({
      type: 'quote',
      client_id: CLIENT_ID,
      line_items: LINE_ITEMS,
      intro_text: 'Angebotstext',
    });
    await issueDocument(quote.id, new Date(2026, 6, 10));

    const { invoice, quote: updatedQuote } = await convertQuoteToInvoice(quote.id);

    expect(invoice.type).toBe('invoice');
    expect(invoice.status).toBe('draft');
    expect(invoice.number).toBeNull();
    expect(invoice.line_items).toEqual(LINE_ITEMS);
    expect(invoice.related_document_id).toBe(quote.id);
    expect(updatedQuote.status).toBe('accepted');
  });

  it('abgelehnte Angebote können nicht umgewandelt werden', async () => {
    const quote = await createDocument({
      type: 'quote',
      client_id: CLIENT_ID,
      line_items: LINE_ITEMS,
    });
    await issueDocument(quote.id, new Date(2026, 6, 10));
    await markQuoteRejected(quote.id);

    await expect(convertQuoteToInvoice(quote.id)).rejects.toThrow(/ausgestellte oder angenommene/);
  });
});

describe('Als bezahlt markieren + EÜR (Modul 14)', () => {
  /** Lädt die Auftragsdaten wie euerYearService.loadOrderInputs. */
  function loadEuerOrderInputs() {
    return select(
      `SELECT o.id, o.receipt_number, o.external_order_id, o.platform, o.variant, o.quantity,
              o.sale_price, o.shipping_revenue, o.status, o.payment_status,
              o.payment_received_date, o.order_date, o.deleted_at,
              NULL AS product_name,
              (SELECT MIN(ev.created_at)
               FROM order_events ev
               WHERE ev.order_id = o.id
                 AND ev.event_type = 'status_change'
                 AND ev.to_value IN ('paid', 'completed')) AS paid_event_date
       FROM orders o
       WHERE o.deleted_at IS NULL
         AND o.status IN ('completed', 'shipped')`,
    ).map((row) => ({
      id: String(row.id),
      receipt_number: String(row.receipt_number),
      external_order_id: (row.external_order_id as string | null) ?? null,
      platform: String(row.platform),
      product_name: null,
      variant: (row.variant as string | null) ?? null,
      quantity: Number(row.quantity ?? 1),
      sale_price: Number(row.sale_price ?? 0),
      shipping_revenue:
        row.shipping_revenue === null || row.shipping_revenue === undefined
          ? null
          : Number(row.shipping_revenue),
      status: String(row.status),
      payment_status: String(row.payment_status),
      payment_received_date: (row.payment_received_date as string | null) ?? null,
      paid_event_date: (row.paid_event_date as string | null) ?? null,
      order_date: String(row.order_date),
      deleted_at: (row.deleted_at as string | null) ?? null,
    }));
  }

  it('setzt den verknüpften Auftrag auf paid/completed – die EÜR zählt ihn danach', async () => {
    const { createOrder } = await import('@/features/orders/services');
    const order = await createOrder({
      platform: 'website',
      customer_name: 'Malerbetrieb Weber',
      sale_price: 1291,
      status: 'ordered',
      payment_status: 'pending',
      order_date: '2026-07-01',
    });

    const draft = await createInvoiceDraft({ order_id: order.id });
    const issued = await issueDocument(draft.id, new Date(2026, 6, 10));

    // Vorher: Auftrag pending → EÜR zählt ihn nicht
    let report = buildEuerYearReport(2026, loadEuerOrderInputs(), []);
    expect(report.incomeTotal).toBe(0);

    const { document, order: paidOrder } = await markInvoicePaid(issued.id, new Date(2026, 6, 15));

    expect(document.status).toBe('paid');
    expect(paidOrder?.payment_status).toBe('paid');
    expect(paidOrder?.status).toBe('completed');
    expect(paidOrder?.payment_received_date).toBe('2026-07-15');

    // Nachher: Umsatz taucht in der EÜR-Aggregation auf (Zuflussprinzip)
    report = buildEuerYearReport(2026, loadEuerOrderInputs(), []);
    expect(report.incomeTotal).toBe(1291);
    expect(report.incomeLines).toHaveLength(1);
    expect(report.incomeLines[0].date).toBe('2026-07-15');
  });

  it('erzeugt ohne verknüpften Auftrag auf Wunsch einen bezahlten Website-Auftrag', async () => {
    const draft = await createInvoiceDraft();
    const issued = await issueDocument(draft.id, new Date(2026, 6, 10));

    const { document, order } = await markInvoicePaidWithNewOrder(issued.id, new Date(2026, 6, 15));

    expect(document.status).toBe('paid');
    expect(document.order_id).toBe(order.id);
    expect(order.platform).toBe('website');
    expect(order.status).toBe('completed');
    expect(order.payment_status).toBe('paid');
    expect(order.sale_price).toBe(1291);

    const report = buildEuerYearReport(2026, loadEuerOrderInputs(), []);
    expect(report.incomeTotal).toBe(1291);
  });

  it('Drafts können nicht als bezahlt markiert werden', async () => {
    const draft = await createInvoiceDraft();

    await expect(markInvoicePaid(draft.id)).rejects.toThrow(/ausgestellte Rechnungen/);
  });
});

describe('Bausteine (Addendum Modul 17)', () => {
  it('neue Dokumente erhalten die Standard-Bausteine ihres Typs', async () => {
    const quote = await createDocument({ type: 'quote', client_id: CLIENT_ID });
    const invoice = await createInvoiceDraft();

    // Angebot: included/excluded/cooperation/process/payment_terms/validity_signature an
    const quoteEnabled = quote.content_blocks
      .filter((block) => block.enabled)
      .map((block) => block.kind);
    expect(quoteEnabled).toEqual([
      'included',
      'excluded',
      'cooperation',
      'process',
      'payment_terms',
      'validity_signature',
    ]);
    const optionalOffer = quote.content_blocks.find((block) => block.kind === 'optional_offer');
    expect(optionalOffer?.enabled).toBe(false);

    // Rechnung: nur payment_terms an, validity_signature existiert nicht
    const invoiceEnabled = invoice.content_blocks
      .filter((block) => block.enabled)
      .map((block) => block.kind);
    expect(invoiceEnabled).toEqual(['payment_terms']);
    expect(invoice.content_blocks.some((block) => block.kind === 'validity_signature')).toBe(false);
  });

  it('friert beim Ausstellen nur aktivierte Bausteine mit aufgelösten Variablen ein', async () => {
    setSettingRow('invoice_payment_terms_days', 21);
    const quote = await createDocument({
      type: 'quote',
      client_id: CLIENT_ID,
      line_items: LINE_ITEMS,
    });

    const issued = await issueDocument(quote.id, new Date(2026, 6, 10));
    const frozen = issued.snapshot?.content_blocks ?? [];

    // Nur aktivierte Blöcke, optional_offer (Default aus) fehlt
    expect(frozen.every((block) => block.enabled)).toBe(true);
    expect(frozen.some((block) => block.kind === 'optional_offer')).toBe(false);

    // payment_terms: IBAN/BIC/Kontoinhaber/Zahlungsziel aus den Settings aufgelöst
    const payment = frozen.find((block) => block.kind === 'payment_terms');
    expect(payment?.text).toContain('innerhalb von 21 Tagen');
    expect(payment?.text).toContain('IBAN: DE02120300000000202051');
    expect(payment?.text).toContain('BIC: BYLADEM1001');
    expect(payment?.text).toContain('Kontoinhaber: Marco Kromer');
    expect(payment?.text).not.toContain('{{');

    // validity_signature: {{gueltig_bis}} = Ausstelldatum + Angebots-Gültigkeit (30 Tage)
    const validity = frozen.find((block) => block.kind === 'validity_signature');
    expect(validity?.text).toContain('bis zum 09.08.2026 gültig');
  });

  it('nachträgliche Änderung der Standard-Bausteine verändert ausgestellte Dokumente nicht', async () => {
    const quote = await createDocument({
      type: 'quote',
      client_id: CLIENT_ID,
      line_items: LINE_ITEMS,
    });
    const issued = await issueDocument(quote.id, new Date(2026, 6, 10));
    const frozenBefore = issued.snapshot?.content_blocks;
    expect(frozenBefore?.length).toBeGreaterThan(0);

    // Nutzer-Standard NACH dem Ausstellen komplett umkrempeln
    const manipulated = buildDefaultContentBlocks('quote').map((block) => ({
      ...block,
      title: 'GEÄNDERT',
      text: 'GEÄNDERT',
      items: [{ text: 'GEÄNDERT', enabled: true }],
    }));
    await saveDefaultContentBlocksForType('quote', manipulated);
    // Auch die Settings-Variablenquellen ändern
    setSettingRow('invoice_iban', 'DE99999999999999999999');
    setSettingRow('invoice_payment_terms_days', 99);

    const reloaded = await getDocumentById(issued.id);
    expect(reloaded?.snapshot?.content_blocks).toEqual(frozenBefore);
    const payment = reloaded?.snapshot?.content_blocks.find(
      (block) => block.kind === 'payment_terms',
    );
    expect(payment?.text).toContain('DE02120300000000202051');
    expect(payment?.text).not.toContain('DE99999999999999999999');

    // Neue Dokumente nutzen dagegen den geänderten Standard
    const next = await createDocument({ type: 'quote', client_id: CLIENT_ID });
    expect(next.content_blocks[0]?.title).toBe('GEÄNDERT');
  });

  it('Nutzer-Standard aus app_settings überschreibt die Konstanten, defekte Werte fallen zurück', async () => {
    const custom = buildDefaultContentBlocks('invoice').map((block) => ({
      ...block,
      enabled: block.kind === 'payment_terms' || block.kind === 'included',
    }));
    await saveDefaultContentBlocksForType('invoice', custom);

    const withDefault = await getDefaultContentBlocksForType('invoice');
    expect(withDefault.filter((block) => block.enabled).map((block) => block.kind)).toEqual([
      'included',
      'payment_terms',
    ]);

    // Defekter Settings-Wert → Konstanten
    setSettingRow('document_default_blocks_invoice', { kaputt: true });
    const fallback = await getDefaultContentBlocksForType('invoice');
    expect(fallback.map((block) => block.kind)).toEqual(
      buildDefaultContentBlocks('invoice').map((block) => block.kind),
    );
  });

  it('Umwandlung Angebot→Rechnung lädt Rechnungs-Defaults statt Angebots-Bausteine (Spec 3.5)', async () => {
    const quote = await createDocument({
      type: 'quote',
      client_id: CLIENT_ID,
      line_items: LINE_ITEMS,
    });
    // Angebots-Bausteine individuell anpassen – dürfen NICHT übernommen werden
    await updateDocument(quote.id, {
      content_blocks: quote.content_blocks.map((block) => ({
        ...block,
        title: `Individuell: ${block.title}`,
      })),
    });
    await issueDocument(quote.id, new Date(2026, 6, 10));

    const { invoice } = await convertQuoteToInvoice(quote.id);

    expect(invoice.content_blocks.some((block) => block.title.startsWith('Individuell:'))).toBe(
      false,
    );
    expect(
      invoice.content_blocks.filter((block) => block.enabled).map((block) => block.kind),
    ).toEqual(['payment_terms']);
    expect(invoice.content_blocks.some((block) => block.kind === 'validity_signature')).toBe(false);
  });

  it('validity_signature wird bei Rechnungen auch defensiv nie eingefroren', async () => {
    const draft = await createInvoiceDraft();
    // Manipulierter Draft mit einem (eigentlich unzulässigen) Unterschrifts-Block
    await updateDocument(draft.id, {
      content_blocks: [
        ...draft.content_blocks,
        {
          id: 'sig-1',
          kind: 'validity_signature',
          enabled: true,
          title: 'Unterschrift',
          body_type: 'paragraph',
          items: [],
          text: 'Sollte nie erscheinen',
        },
      ],
    });

    const issued = await issueDocument(draft.id, new Date(2026, 6, 10));
    expect(
      issued.snapshot?.content_blocks.some((block) => block.kind === 'validity_signature'),
    ).toBe(false);
  });

  it('Alt-Dokumente ohne content_blocks-Spalte parsen als leere Liste', async () => {
    const draft = await createInvoiceDraft();
    execute('UPDATE documents SET content_blocks = NULL WHERE id = $1', [draft.id]);

    const reloaded = await getDocumentById(draft.id);
    expect(reloaded?.content_blocks).toEqual([]);
  });

  it('Storno übernimmt keine Bausteine (EA-07)', async () => {
    const draft = await createInvoiceDraft();
    const issued = await issueDocument(draft.id, new Date(2026, 6, 10));

    const { storno } = await cancelInvoice(issued.id, new Date(2026, 6, 12));
    expect(storno.content_blocks).toEqual([]);
    expect(storno.snapshot?.content_blocks).toEqual([]);
  });
});

describe('Addendum 2: Stichpunkt-Flags und Abwärtskompatibilität', () => {
  /** Baustein im ALTEN Format (items als string[]), wie vor Addendum 2 gespeichert. */
  function legacyBlock(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: 'legacy-1',
      kind: 'included',
      enabled: true,
      title: 'Im Festpreis enthalten',
      body_type: 'bullets',
      items: ['Konzeption und Umsetzung', 'Mobile Optimierung'],
      text: '',
      ...overrides,
    };
  }

  function insertLegacyDocumentRow(options: { snapshot?: unknown } = {}): string {
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    execute(
      `INSERT INTO documents (
         id, type, number, status, client_id, line_items, total,
         service_date, layout, content_blocks, snapshot, created_at, updated_at
       ) VALUES ($1, 'invoice', $2, $3, $4, $5, 1200, 'Juli 2026', 'polygrid', $6, $7, $8, $9)`,
      [
        id,
        options.snapshot ? 'R-2026-001' : null,
        options.snapshot ? 'issued' : 'draft',
        CLIENT_ID,
        JSON.stringify([{ description: 'Website-Erstellung', quantity: 1, unit_price: 1200 }]),
        JSON.stringify([legacyBlock()]),
        options.snapshot ? JSON.stringify(options.snapshot) : null,
        timestamp,
        timestamp,
      ],
    );
    return id;
  }

  it('altes Dokument mit string[]-items parst als enabled-Stichpunkte, DB bleibt unangetastet', async () => {
    const id = insertLegacyDocumentRow();
    const rawBefore = String(
      select('SELECT content_blocks FROM documents WHERE id = $1', [id])[0].content_blocks,
    );

    const loaded = await getDocumentById(id);
    expect(loaded?.content_blocks[0].items).toEqual([
      { text: 'Konzeption und Umsetzung', enabled: true },
      { text: 'Mobile Optimierung', enabled: true },
    ]);

    // Reine Lese-Normalisierung: die gespeicherte Zeile wird nicht umgeschrieben
    const rawAfter = String(
      select('SELECT content_blocks FROM documents WHERE id = $1', [id])[0].content_blocks,
    );
    expect(rawAfter).toBe(rawBefore);
  });

  it('alter Snapshot mit string[]-items parst fehlerfrei und wird nie umgeschrieben', async () => {
    const legacySnapshot = {
      type: 'invoice',
      number: 'R-2026-001',
      issuer: {
        company_name: 'PolyGrid Studio',
        owner_name: 'Marco Kromer',
        street: 'Musterstraße 1',
        zip: '12345',
        city: 'Musterstadt',
        tax_number: '12/345/67890',
        vat_id: '',
        iban: 'DE02120300000000202051',
        bic: 'BYLADEM1001',
        bank_name: 'Testbank',
      },
      recipient: { name: 'Malerbetrieb Weber', contact_person: null, address: 'Wandweg 3' },
      line_items: [{ description: 'Website-Erstellung', quantity: 1, unit_price: 1200 }],
      total: 1200,
      issue_date: '2026-07-01',
      due_date: '2026-07-15',
      valid_until: null,
      service_date: 'Juli 2026',
      intro_text: null,
      outro_text: null,
      layout: 'polygrid',
      accent_color: '#0070F2',
      logo: null,
      kleinunternehmer_hinweis: KLEINUNTERNEHMER_SATZ,
      related_document_number: null,
      content_blocks: [legacyBlock()],
    };
    const id = insertLegacyDocumentRow({ snapshot: legacySnapshot });
    const rawBefore = String(
      select('SELECT snapshot FROM documents WHERE id = $1', [id])[0].snapshot,
    );

    const loaded = await getDocumentById(id);
    expect(loaded?.snapshot?.content_blocks[0].items).toEqual([
      { text: 'Konzeption und Umsetzung', enabled: true },
      { text: 'Mobile Optimierung', enabled: true },
    ]);

    // Lesen und ein erlaubtes Nicht-Inhalts-Update lassen den Snapshot byte-identisch
    await updateDocumentPdfPath(id, '/01_Finanzen/Rechnungen_2026/R-2026-001_weber.pdf');
    const rawAfter = String(
      select('SELECT snapshot FROM documents WHERE id = $1', [id])[0].snapshot,
    );
    expect(rawAfter).toBe(rawBefore);
  });

  it('migriert alte Standard-Keys (string[]-items) beim ersten Laden', async () => {
    // "Als Standard speichern"-Wert aus der Zeit vor dem Konfigurator
    setSettingRow('document_default_blocks_quote', [
      legacyBlock({ id: 'old-default', title: 'Alter Standard' }),
    ]);

    const defaults = await getDefaultContentBlocksForType('quote');
    expect(defaults).toHaveLength(1);
    expect(defaults[0].title).toBe('Alter Standard');
    expect(defaults[0].items).toEqual([
      { text: 'Konzeption und Umsetzung', enabled: true },
      { text: 'Mobile Optimierung', enabled: true },
    ]);

    // Neue Dokumente übernehmen den migrierten Standard unverändert
    const quote = await createDocument({ type: 'quote', client_id: CLIENT_ID });
    expect(quote.content_blocks[0].title).toBe('Alter Standard');
    expect(quote.content_blocks[0].items[0]).toEqual({
      text: 'Konzeption und Umsetzung',
      enabled: true,
    });
  });

  it('friert nur aktivierte Stichpunkte ein; deaktivierte bleiben am Dokument erhalten', async () => {
    const quote = await createDocument({
      type: 'quote',
      client_id: CLIENT_ID,
      line_items: LINE_ITEMS,
    });
    const included = quote.content_blocks.find((block) => block.kind === 'included');
    expect(included).toBeDefined();
    // Beispiel des Nutzers (Spec 2.3): einen Punkt abschalten, ohne ihn zu löschen
    await updateDocument(quote.id, {
      content_blocks: quote.content_blocks.map((block) =>
        block.kind === 'included'
          ? {
              ...block,
              items: block.items.map((item, index) =>
                index === 0 ? { ...item, enabled: false } : item,
              ),
            }
          : block,
      ),
    });

    const issued = await issueDocument(quote.id, new Date(2026, 6, 10));
    const frozen = issued.snapshot?.content_blocks.find((block) => block.kind === 'included');
    const disabledText = included?.items[0]?.text ?? '';
    expect(frozen?.items.some((item) => item.text === disabledText)).toBe(false);
    expect(frozen?.items.every((item) => item.enabled)).toBe(true);

    // Am Dokument bleibt der deaktivierte Punkt gespeichert
    const reloaded = await getDocumentById(quote.id);
    const kept = reloaded?.content_blocks.find((block) => block.kind === 'included');
    expect(kept?.items[0]).toEqual({ text: disabledText, enabled: false });
  });
});

describe('Addendum 2: Positionsvorlagen', () => {
  it('seedet beim ersten Laden drei Vorlagen aus der Referenz und persistiert sie', async () => {
    const templates = await getPositionTemplates();

    expect(templates.map((template) => [template.name, template.unit_price])).toEqual([
      ['Komplettpaket', 590],
      ['Onepager', 390],
      ['Refresh', 490],
    ]);
    expect(templates.every((template) => template.default_quantity === 1)).toBe(true);

    // Persistiert: zweites Laden liefert dieselben ids
    const again = await getPositionTemplates();
    expect(again.map((template) => template.id)).toEqual(templates.map((template) => template.id));
  });

  it('respektiert eine bewusst geleerte Liste und überschreibt defekte Werte nicht', async () => {
    setSettingRow(DOCUMENT_POSITION_TEMPLATES_SETTING_KEY, []);
    expect(await getPositionTemplates()).toEqual([]);

    setSettingRow(DOCUMENT_POSITION_TEMPLATES_SETTING_KEY, { kaputt: true });
    const fallback = await getPositionTemplates();
    expect(fallback.map((template) => template.name)).toEqual([
      'Komplettpaket',
      'Onepager',
      'Refresh',
    ]);
    // Der defekte Wert bleibt stehen (kein stilles Überschreiben)
    const raw = select('SELECT value FROM app_settings WHERE key = $1', [
      DOCUMENT_POSITION_TEMPLATES_SETTING_KEY,
    ]);
    expect(String(raw[0].value)).toBe(JSON.stringify({ kaputt: true }));
  });

  it('savePositionTemplates validiert und persistiert (CRUD-Roundtrip)', async () => {
    const templates = await getPositionTemplates();
    const edited = [
      ...templates.slice(1),
      { ...templates[0], id: crypto.randomUUID(), name: 'Kopie', unit_price: 640 },
    ];
    await savePositionTemplates(edited);

    const reloaded = await getPositionTemplates();
    expect(reloaded.map((template) => template.name)).toEqual(['Onepager', 'Refresh', 'Kopie']);
    expect(reloaded[2].unit_price).toBe(640);
  });

  it('lineItemFromPositionTemplate setzt den Titel als erste Beschreibungszeile (EB-03)', async () => {
    const [komplettpaket] = await getPositionTemplates();
    const item = lineItemFromPositionTemplate(komplettpaket);

    expect(item.description.split('\n')[0]).toBe('Website-Erstellung (Komplettpaket)');
    expect(item.description).toContain('Neuerstellung einer modernen');
    expect(item.quantity).toBe(1);
    expect(item.unit_price).toBe(590);
  });
});

describe('Addendum 2: Standard-Einleitungstexte', () => {
  it('belegt neue Dokumente je Typ vor; explizite Angaben gewinnen', async () => {
    await saveDefaultDocumentTexts('quote', {
      intro_text: 'Sehr geehrte/r {{kundenname}}, vielen Dank für Ihr Vertrauen.',
      outro_text: 'Ich freue mich auf die Zusammenarbeit.',
    });

    const prefilled = await createDocument({ type: 'quote', client_id: CLIENT_ID });
    expect(prefilled.intro_text).toBe(
      'Sehr geehrte/r {{kundenname}}, vielen Dank für Ihr Vertrauen.',
    );
    expect(prefilled.outro_text).toBe('Ich freue mich auf die Zusammenarbeit.');

    // Rechnungen haben einen eigenen (hier leeren) Standard
    const invoice = await createInvoiceDraft();
    expect(invoice.intro_text).toBeNull();

    // Explizite Angabe (auch null) gewinnt über die Vorbelegung
    const explicit = await createDocument({
      type: 'quote',
      client_id: CLIENT_ID,
      intro_text: 'Eigener Text',
      outro_text: null,
    });
    expect(explicit.intro_text).toBe('Eigener Text');
    expect(explicit.outro_text).toBeNull();
  });

  it('Variablen der Vorbelegung werden beim Ausstellen aufgelöst', async () => {
    await saveDefaultDocumentTexts('quote', {
      intro_text: 'Sehr geehrte/r {{kundenname}},',
      outro_text: '',
    });
    const quote = await createDocument({
      type: 'quote',
      client_id: CLIENT_ID,
      line_items: LINE_ITEMS,
    });

    const issued = await issueDocument(quote.id, new Date(2026, 6, 10));
    expect(issued.snapshot?.intro_text).toBe('Sehr geehrte/r Malerbetrieb Weber,');

    const texts = await getDefaultDocumentTexts('quote');
    expect(texts).toEqual({ intro_text: 'Sehr geehrte/r {{kundenname}},', outro_text: null });
  });
});

describe('Listen und Filter', () => {
  it('liefert Dokumente mit Kundennamen und filtert überfällige Rechnungen', async () => {
    const overdue = await createInvoiceDraft();
    // Ausstellen mit Datum weit in der Vergangenheit → due_date überschritten
    await issueDocument(overdue.id, new Date(2026, 0, 5));
    const current = await createInvoiceDraft();

    const all = await getDocuments();
    expect(all).toHaveLength(2);
    expect(all.every((document) => document.client_name === 'Malerbetrieb Weber')).toBe(true);

    const overdueList = await getDocuments({ overdueOnly: true });
    expect(overdueList).toHaveLength(1);
    expect(overdueList[0].id).toBe(overdue.id);
    expect(current.status).toBe('draft');
  });
});
