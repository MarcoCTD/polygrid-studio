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
  getDocumentById,
  getDocuments,
  getMissingIssueRequirements,
  issueDocument,
  markInvoicePaid,
  markInvoicePaidWithNewOrder,
  markQuoteRejected,
  softDeleteDocument,
  updateDocument,
} = await import('./documentsService');
const { resetDocumentNumberGeneratorForTests } = await import('./documentNumber');
const { KLEINUNTERNEHMER_SATZ } = await import('../schemas');
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
