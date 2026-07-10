/**
 * Integrationstests der Website-Recurring-Engine (Modul 16, Etappe B)
 * gegen eine echte In-Memory-SQLite (sql.js) mit den echten Migrationen –
 * gleiches Muster wie playbookEngine.test.ts.
 */
import path from 'node:path';
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
  db: null as unknown as { select: <T>(q: string, v?: unknown[]) => Promise<T> },
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
  setSetting: async () => undefined,
}));

const { runWebsiteRecurringEngine, addWebsiteServiceInterval, MAX_CATCHUP_PERIODS } =
  await import('./recurringEngine');
const { createClient } = await import('./clientsService');
const { createWebsiteService, getWebsiteServiceById } = await import('./websiteServicesService');

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

beforeAll(async () => {
  SQL = await initSqlJs({
    locateFile: (file: string) => path.join(process.cwd(), 'node_modules/sql.js/dist', file),
  });
});

beforeEach(() => {
  rawDb = new SQL.Database();
  holder.db = new TestDatabase(rawDb) as never;
  for (const migration of MIGRATIONS) {
    const statements = migration.sql
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0);
    for (const statement of statements) {
      rawDb.run(statement);
    }
  }
});

/** Fixes "Heute" für deterministische Tests. */
const TODAY = new Date(2026, 6, 9); // 2026-07-09 (lokal)

function isoMonthsAgo(months: number, day = 9): string {
  const date = new Date(2026, 6 - months, day);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function seedClientId(name = 'Malerbetrieb Weber'): Promise<string> {
  const client = await createClient({ name });
  return client.id;
}

describe('runWebsiteRecurringEngine', () => {
  it('erzeugt bei Fälligkeit Ausgabe UND Auftrags-Entwurf mit korrekten Feldern', async () => {
    const clientId = await seedClientId();
    const service = await createWebsiteService({
      client_id: clientId,
      type: 'hosting',
      label: 'Hetzner Webspace',
      cost_out: 5,
      cost_out_vendor: 'Hetzner',
      price_in: 15,
      interval: 'monthly',
      next_due: '2026-07-09',
    });

    const result = await runWebsiteRecurringEngine(TODAY);
    expect(result.errors).toEqual([]);
    expect(result.expensesCreated).toBe(1);
    expect(result.ordersCreated).toBe(1);

    const [expense] = select('SELECT * FROM expenses');
    expect(expense.date).toBe('2026-07-09');
    expect(expense.amount_gross).toBe(5);
    expect(expense.vendor).toBe('Hetzner');
    expect(expense.category).toBe('software_saas');
    expect(expense.subcategory).toBe('hosting');
    expect(expense.purpose).toBe('Hetzner Webspace monatlich');
    expect(expense.recurring).toBe(1);
    expect(expense.import_source).toBe('recurring');
    expect(expense.import_ref).toBe(service.id);

    const [order] = select('SELECT * FROM orders');
    expect(order.platform).toBe('website');
    expect(order.status).toBe('ordered');
    expect(order.payment_status).toBe('pending');
    expect(order.payment_received_date).toBeNull();
    expect(order.sale_price).toBe(15);
    expect(order.customer_name).toBe('Malerbetrieb Weber');
    expect(order.order_date).toBe('2026-07-09');
    expect(order.notes).toBe('Hetzner Webspace, automatisch erzeugt');

    const updated = await getWebsiteServiceById(service.id);
    expect(updated?.next_due).toBe('2026-08-09');
    expect(updated?.last_generated_until).toBe('2026-07-09');
  });

  it('ist idempotent: mehrfacher Lauf am selben Tag erzeugt exakt einmal', async () => {
    const clientId = await seedClientId();
    await createWebsiteService({
      client_id: clientId,
      type: 'hosting',
      label: 'Webspace',
      cost_out: 5,
      price_in: 15,
      interval: 'monthly',
      next_due: '2026-07-09',
    });

    await runWebsiteRecurringEngine(TODAY);
    const second = await runWebsiteRecurringEngine(TODAY);
    const third = await runWebsiteRecurringEngine(TODAY);

    expect(second.expensesCreated + second.ordersCreated).toBe(0);
    expect(third.expensesCreated + third.ordersCreated).toBe(0);
    expect(select('SELECT id FROM expenses')).toHaveLength(1);
    expect(select('SELECT id FROM orders')).toHaveLength(1);
  });

  it('holt verpasste Perioden nach (next_due 3 Monate zurück, monthly: 3 Posten)', async () => {
    const clientId = await seedClientId();
    const service = await createWebsiteService({
      client_id: clientId,
      type: 'wartung',
      label: 'Wartungsvertrag',
      cost_out: 10,
      price_in: 29,
      interval: 'monthly',
      next_due: isoMonthsAgo(3), // 2026-04-09 → fällig: 04-09, 05-09, 06-09, 07-09 = 4 Perioden? Nein: 3 Monate zurück inkl. heute
    });

    const result = await runWebsiteRecurringEngine(TODAY);
    // 2026-04-09, 2026-05-09, 2026-06-09, 2026-07-09 → 4 fällige Perioden
    expect(result.errors).toEqual([]);
    expect(result.expensesCreated).toBe(4);
    expect(result.ordersCreated).toBe(4);

    const expenseDates = select('SELECT date FROM expenses ORDER BY date').map((row) => row.date);
    expect(expenseDates).toEqual(['2026-04-09', '2026-05-09', '2026-06-09', '2026-07-09']);

    const updated = await getWebsiteServiceById(service.id);
    expect(updated?.next_due).toBe('2026-08-09');
    expect(updated?.last_generated_until).toBe('2026-07-09');

    // Spec-Grenzfall: exakt 3 Posten, wenn die heutige Periode noch nicht fällig ist
    execute('DELETE FROM expenses');
    execute('DELETE FROM order_events');
    execute('DELETE FROM orders');
    const service2 = await createWebsiteService({
      client_id: clientId,
      type: 'wartung',
      label: 'Wartung klein',
      cost_out: 7,
      interval: 'monthly',
      next_due: isoMonthsAgo(3, 15), // 2026-04-15: fällig 04-15, 05-15, 06-15 (07-15 liegt in der Zukunft)
    });
    const result2 = await runWebsiteRecurringEngine(TODAY);
    expect(result2.expensesCreated).toBe(3);
    const updated2 = await getWebsiteServiceById(service2.id);
    expect(updated2?.next_due).toBe('2026-07-15');
  });

  it('holt maximal 12 Perioden nach und meldet das Limit', async () => {
    const clientId = await seedClientId();
    await createWebsiteService({
      client_id: clientId,
      type: 'hosting',
      label: 'Uralt-Hosting',
      cost_out: 5,
      interval: 'monthly',
      next_due: '2024-01-09', // weit über 12 Perioden zurück
    });

    const result = await runWebsiteRecurringEngine(TODAY);
    expect(result.expensesCreated).toBe(MAX_CATCHUP_PERIODS);
    expect(result.cappedLabels).toEqual(['Uralt-Hosting']);

    // Es wurden die JÜNGSTEN 12 Perioden erzeugt, die Fälligkeit steht danach in der Zukunft
    const dates = select('SELECT date FROM expenses ORDER BY date').map((row) => String(row.date));
    expect(dates).toHaveLength(12);
    expect(dates[11]).toBe('2026-07-09');
    expect(dates[0]).toBe('2025-08-09');

    const [serviceRow] = select('SELECT next_due FROM website_services');
    expect(serviceRow.next_due).toBe('2026-08-09');

    // Folgelauf: nichts Neues
    const second = await runWebsiteRecurringEngine(TODAY);
    expect(second.expensesCreated).toBe(0);
  });

  it('überspringt inaktive, gelöschte und nicht fällige Posten', async () => {
    const clientId = await seedClientId();
    await createWebsiteService({
      client_id: clientId,
      type: 'hosting',
      label: 'Inaktiv',
      cost_out: 5,
      interval: 'monthly',
      next_due: '2026-07-01',
      active: false,
    });
    const deleted = await createWebsiteService({
      client_id: clientId,
      type: 'hosting',
      label: 'Gelöscht',
      cost_out: 5,
      interval: 'monthly',
      next_due: '2026-07-01',
    });
    execute('UPDATE website_services SET deleted_at = $1 WHERE id = $2', [
      new Date().toISOString(),
      deleted.id,
    ]);
    await createWebsiteService({
      client_id: clientId,
      type: 'hosting',
      label: 'Zukunft',
      cost_out: 5,
      interval: 'monthly',
      next_due: '2026-08-01',
    });

    const result = await runWebsiteRecurringEngine(TODAY);
    expect(result.expensesCreated).toBe(0);
    expect(result.ordersCreated).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it('yearly: schiebt die Fälligkeit um ein Jahr weiter', async () => {
    const clientId = await seedClientId();
    const service = await createWebsiteService({
      client_id: clientId,
      type: 'domain',
      label: 'malerweber.de',
      cost_out: 12,
      price_in: 25,
      interval: 'yearly',
      next_due: '2026-07-01',
      expires_at: '2027-07-01',
    });

    const result = await runWebsiteRecurringEngine(TODAY);
    expect(result.expensesCreated).toBe(1);
    expect(result.ordersCreated).toBe(1);

    const [expense] = select('SELECT subcategory FROM expenses');
    expect(expense.subcategory).toBe('domain');

    const updated = await getWebsiteServiceById(service.id);
    expect(updated?.next_due).toBe('2027-07-01');
  });

  it('nur cost_out erzeugt keine Aufträge, nur price_in keine Ausgaben', async () => {
    const clientId = await seedClientId();
    await createWebsiteService({
      client_id: clientId,
      type: 'hosting',
      label: 'Nur Kosten',
      cost_out: 5,
      interval: 'monthly',
      next_due: '2026-07-09',
    });
    await createWebsiteService({
      client_id: clientId,
      type: 'wartung',
      label: 'Nur Einnahme',
      price_in: 20,
      interval: 'monthly',
      next_due: '2026-07-09',
    });

    const result = await runWebsiteRecurringEngine(TODAY);
    expect(result.expensesCreated).toBe(1);
    expect(result.ordersCreated).toBe(1);
    expect(select(`SELECT id FROM expenses`)).toHaveLength(1);
    expect(select(`SELECT id FROM orders WHERE platform = 'website'`)).toHaveLength(1);
  });

  it('type sonstiges: Ausgabe ohne Unterkategorie, Vendor-Fallback auf Label', async () => {
    const clientId = await seedClientId();
    await createWebsiteService({
      client_id: clientId,
      type: 'sonstiges',
      label: 'SSL-Zertifikat',
      cost_out: 30,
      interval: 'yearly',
      next_due: '2026-07-09',
    });

    await runWebsiteRecurringEngine(TODAY);
    const [expense] = select('SELECT vendor, subcategory, purpose FROM expenses');
    expect(expense.vendor).toBe('SSL-Zertifikat');
    expect(expense.subcategory).toBeNull();
    expect(expense.purpose).toBe('SSL-Zertifikat jährlich');
  });

  it('ein defekter Posten blockiert die übrigen nicht und wirft nie', async () => {
    const clientId = await seedClientId();
    // Defekten Posten direkt seeden (leeres Label schlägt bei der Zod-Prüfung fehl)
    execute(
      `INSERT INTO website_services (
        id, client_id, type, label, cost_out, interval, next_due, active,
        created_at, updated_at
      ) VALUES ($1, $2, 'hosting', '', 5, 'monthly', '2026-07-01', 1, $3, $3)`,
      [crypto.randomUUID(), clientId, '2026-01-01T00:00:00.000Z'],
    );
    await createWebsiteService({
      client_id: clientId,
      type: 'hosting',
      label: 'Gesunder Posten',
      cost_out: 5,
      interval: 'monthly',
      next_due: '2026-07-09',
    });

    const result = await runWebsiteRecurringEngine(TODAY);
    expect(result.expensesCreated).toBe(1);
    expect(result.errors).toHaveLength(1);

    const [expense] = select('SELECT purpose FROM expenses');
    expect(expense.purpose).toBe('Gesunder Posten monatlich');
  });

  it('Teilfehler-Idempotenz: bereits existierende Periodenbelege werden nicht dupliziert', async () => {
    const clientId = await seedClientId();
    const service = await createWebsiteService({
      client_id: clientId,
      type: 'hosting',
      label: 'Webspace',
      cost_out: 5,
      price_in: 15,
      interval: 'monthly',
      next_due: '2026-07-09',
    });

    // Simulierter früherer Teil-Lauf: Ausgabe existiert schon, Auftrag fehlt,
    // last_generated_until wurde noch nicht gesetzt.
    execute(
      `INSERT INTO expenses (
        id, date, amount_gross, vendor, category, receipt_attached, tax_relevant,
        recurring, import_source, import_ref, tax_locked, created_at, updated_at
      ) VALUES ($1, '2026-07-09', 5, 'Webspace', 'software_saas', 0, 1, 1, 'recurring', $2, 0, $3, $3)`,
      [crypto.randomUUID(), service.id, new Date().toISOString()],
    );

    const result = await runWebsiteRecurringEngine(TODAY);
    expect(result.expensesCreated).toBe(0);
    expect(result.ordersCreated).toBe(1);
    expect(select('SELECT id FROM expenses')).toHaveLength(1);
    expect(select('SELECT id FROM orders')).toHaveLength(1);
  });

  it('serialisiert nebenläufige Läufe (StrictMode-Doppel-Start erzeugt keine Duplikate)', async () => {
    const clientId = await seedClientId();
    await createWebsiteService({
      client_id: clientId,
      type: 'hosting',
      label: 'Parallel-Hosting',
      cost_out: 5,
      price_in: 15,
      interval: 'monthly',
      next_due: '2026-07-09',
    });

    // Beide Läufe gleichzeitig starten – wie der doppelte Init-Effekt in Dev
    const [first, second] = await Promise.all([
      runWebsiteRecurringEngine(TODAY),
      runWebsiteRecurringEngine(TODAY),
    ]);

    expect(first.expensesCreated + second.expensesCreated).toBe(1);
    expect(first.ordersCreated + second.ordersCreated).toBe(1);
    expect(select('SELECT id FROM expenses')).toHaveLength(1);
    expect(select('SELECT id FROM orders')).toHaveLength(1);
  });

  it('wirft auch bei kaputter DB nicht (App-Start bleibt frei)', async () => {
    holder.db = {
      select: async () => {
        throw new Error('DB kaputt');
      },
    } as never;

    const result = await runWebsiteRecurringEngine(TODAY);
    expect(result.expensesCreated).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('DB kaputt');
  });
});

describe('addWebsiteServiceInterval', () => {
  it('klemmt Monatsenden korrekt', () => {
    expect(addWebsiteServiceInterval('2026-01-31', 'monthly')).toBe('2026-02-28');
    expect(addWebsiteServiceInterval('2026-12-15', 'monthly')).toBe('2027-01-15');
    expect(addWebsiteServiceInterval('2024-02-29', 'yearly')).toBe('2025-02-28');
  });
});
