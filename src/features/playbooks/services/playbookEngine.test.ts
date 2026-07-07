/**
 * Integrationstests der Playbook-Engine gegen eine echte In-Memory-SQLite
 * (sql.js) mit den echten Drizzle-Migrationen der App – analog zum
 * E2E-Tauri-Mock, aber im Node-Prozess für vitest.
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

const holder = vi.hoisted(() => ({ db: null as unknown as { select: <T>(q: string, v?: unknown[]) => Promise<T> } }));

vi.mock('@/services/database', () => ({
  getDatabase: () => holder.db,
  initDatabase: async () => undefined,
  getSetting: async <T,>(key: string): Promise<T | null> => {
    const rows = await holder.db.select<{ value: string }[]>(
      'SELECT value FROM app_settings WHERE key = $1',
      [key],
    );
    if (rows.length === 0) return null;
    return JSON.parse(rows[0].value) as T;
  },
  setSetting: async () => undefined,
}));

// Nach dem Mock importieren, damit alle Services die Test-DB nutzen.
const { runPlaybooksForStatusChange, runPlaybookDryRun, renderPlaybookTemplate } = await import(
  './playbookEngine'
);
const { createPlaybook, getRecentRuns } = await import('./playbookService');
const { updateOrder } = await import('@/features/orders/services/ordersService');

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

let receiptCounter = 0;

function seedOrder(overrides: Partial<Record<string, unknown>> = {}): string {
  const id = crypto.randomUUID();
  receiptCounter += 1;
  const timestamp = new Date().toISOString();
  const row: Record<string, unknown> = {
    id,
    receipt_number: `2026-${String(receiptCounter).padStart(4, '0')}`,
    external_order_id: null,
    customer_name: 'Max Muster',
    platform: 'etsy',
    product_id: null,
    variant: null,
    quantity: 1,
    sale_price: 19.99,
    shipping_revenue: null,
    shipping_cost: null,
    material_cost: null,
    platform_fee: null,
    payout_amount: null,
    status: 'ordered',
    payment_status: 'pending',
    payment_received_date: null,
    shipping_status: 'not_shipped',
    tracking_number: null,
    order_date: '2026-07-01',
    notes: null,
    tax_locked: 0,
    bank_match_id: null,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
    ...overrides,
  };
  const columns = Object.keys(row);
  execute(
    `INSERT INTO orders (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})`,
    columns.map((column) => row[column]),
  );
  return id;
}

function seedProduct(name: string): string {
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  execute(
    `INSERT INTO products (id, name, category, status, material_type, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, name, 'deko', 'aktiv', 'PLA', timestamp, timestamp],
  );
  return id;
}

function seedTemplate(name: string): string {
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  execute(
    `INSERT INTO templates (id, name, category, content, version, is_legal, created_at, updated_at)
     VALUES ($1, $2, 'versand', 'Hallo {{kundenname}}', 1, 0, $3, $4)`,
    [id, name, timestamp, timestamp],
  );
  return id;
}

/** Seedet ein Playbook direkt in die DB (mit steuerbarem created_at für Reihenfolge-Tests). */
function seedPlaybookRow(options: {
  name: string;
  trigger_status: string;
  actions: Record<string, unknown>[];
  created_at: string;
  enabled?: boolean;
}): string {
  const id = crypto.randomUUID();
  execute(
    `INSERT INTO playbooks (id, name, enabled, trigger_status, platform_filter, actions, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NULL, $5, $6, $6)`,
    [
      id,
      options.name,
      options.enabled === false ? 0 : 1,
      options.trigger_status,
      JSON.stringify(options.actions),
      options.created_at,
    ],
  );
  return id;
}

const SIMPLE_TASK_ACTION = {
  type: 'create_task',
  title_template: 'Aufgabe',
  priority: 'medium',
  due_offset_days: null,
  link_order: true,
};

function localISODate(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

beforeAll(async () => {
  SQL = await initSqlJs({
    locateFile: (file: string) => path.join(process.cwd(), 'node_modules/sql.js/dist', file),
  });
});

beforeEach(() => {
  rawDb = new SQL.Database();
  holder.db = new TestDatabase(rawDb) as never;
  receiptCounter = 0;
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

describe('Migration & Seed', () => {
  it('legt die zwei Beispiel-Playbooks deaktiviert an', () => {
    const rows = select('SELECT name, enabled, trigger_status FROM playbooks ORDER BY name');
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.enabled === 0)).toBe(true);
    expect(rows.map((row) => row.trigger_status).sort()).toEqual(['paid', 'shipped']);
  });

  it('erzwingt Idempotenz über den partiellen Unique-Index', () => {
    const orderId = seedOrder();
    const playbookRow = select('SELECT id FROM playbooks LIMIT 1');
    const playbookId = String(playbookRow[0].id);
    const insert = (status: string) =>
      execute(
        `INSERT INTO playbook_runs (id, playbook_id, order_id, trigger_status, status, results, executed_at)
         VALUES ($1, $2, $3, 'paid', $4, '[]', $5)`,
        [crypto.randomUUID(), playbookId, orderId, status, new Date().toISOString()],
      );

    insert('success');
    expect(() => insert('partial')).toThrow(/unique/i);
    // Dry-Runs sind vom Index ausgenommen und dürfen mehrfach existieren
    insert('dry_run');
    insert('dry_run');
  });
});

describe('renderPlaybookTemplate', () => {
  it('ersetzt Variablen und meldet nicht auflösbare als Rohtext', () => {
    const { text, unresolved } = renderPlaybookTemplate('{{a}} und {{b}} und {{a}}', { a: 'X' });
    expect(text).toBe('X und {{b}} und X');
    expect(unresolved).toEqual(['b']);
  });
});

describe('runPlaybooksForStatusChange', () => {
  it('create_task erzeugt verknüpfte Aufgabe mit ersetzten Variablen und Fälligkeit', async () => {
    const productId = seedProduct('Drachenfigur');
    const orderId = seedOrder({ product_id: productId, external_order_id: 'ETSY-4711' });
    await createPlaybook({
      name: 'Test Aufgabe',
      trigger_status: 'paid',
      platform_filter: null,
      actions: [
        {
          type: 'create_task',
          title_template: '{{produktname}} für {{kundenname}} drucken ({{bestellnummer}})',
          priority: 'high',
          due_offset_days: 2,
          link_order: true,
        },
      ],
    });

    const summaries = await runPlaybooksForStatusChange(orderId, 'paid');
    expect(summaries).toHaveLength(1);
    expect(summaries[0].status).toBe('success');
    expect(summaries[0].created_count).toBe(1);

    const tasks = select('SELECT * FROM tasks');
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Drachenfigur für Max Muster drucken (ETSY-4711)');
    expect(tasks[0].priority).toBe('high');
    expect(tasks[0].order_id).toBe(orderId);
    expect(tasks[0].due_date).toBe(localISODate(2));
  });

  it('ist idempotent: gleicher Auftrag + Status feuert keinen zweiten Run', async () => {
    const orderId = seedOrder();
    await createPlaybook({
      name: 'Einmalig',
      trigger_status: 'paid',
      platform_filter: null,
      actions: [
        {
          type: 'create_task',
          title_template: 'Aufgabe',
          priority: 'medium',
          due_offset_days: null,
          link_order: true,
        },
      ],
    });

    const first = await runPlaybooksForStatusChange(orderId, 'paid');
    expect(first).toHaveLength(1);

    // Zurück- und wieder Vorschieben: Engine erneut mit demselben Status
    const second = await runPlaybooksForStatusChange(orderId, 'paid');
    expect(second).toHaveLength(0);

    expect(select('SELECT id FROM tasks')).toHaveLength(1);
    expect(select("SELECT id FROM playbook_runs WHERE status != 'dry_run'")).toHaveLength(1);
  });

  it('create_expense mit amount_source liest den Wert aus dem Auftrag', async () => {
    const productId = seedProduct('Vase');
    const orderId = seedOrder({
      product_id: productId,
      shipping_cost: 4.5,
      external_order_id: 'EBAY-99',
      platform: 'ebay',
    });
    await createPlaybook({
      name: 'Versandkosten',
      trigger_status: 'shipped',
      platform_filter: null,
      actions: [
        {
          type: 'create_expense',
          amount_gross: null,
          amount_source: 'shipping_cost',
          category: 'versand',
          subcategory: null,
          vendor: 'Versanddienstleister',
          purpose_template: 'Versand Bestellung {{bestellnummer}}',
        },
      ],
    });

    const summaries = await runPlaybooksForStatusChange(orderId, 'shipped');
    expect(summaries).toHaveLength(1);
    expect(summaries[0].status).toBe('success');

    const expenses = select('SELECT * FROM expenses');
    expect(expenses).toHaveLength(1);
    expect(expenses[0].amount_gross).toBe(4.5);
    expect(expenses[0].vendor).toBe('Versanddienstleister');
    expect(expenses[0].purpose).toBe('Versand Bestellung EBAY-99');
    expect(expenses[0].order_id).toBe(orderId);
    expect(expenses[0].product_id).toBe(productId);
  });

  it('create_expense mit leerem amount_source überspringt mit Hinweis (partial), Rest läuft weiter', async () => {
    const orderId = seedOrder({ shipping_cost: null });
    await createPlaybook({
      name: 'Gemischt',
      trigger_status: 'shipped',
      platform_filter: null,
      actions: [
        {
          type: 'create_expense',
          amount_gross: null,
          amount_source: 'shipping_cost',
          category: 'versand',
          subcategory: null,
          vendor: 'DHL',
          purpose_template: '',
        },
        {
          type: 'create_task',
          title_template: 'Nachfassen',
          priority: 'medium',
          due_offset_days: null,
          link_order: true,
        },
      ],
    });

    const summaries = await runPlaybooksForStatusChange(orderId, 'shipped');
    expect(summaries).toHaveLength(1);
    expect(summaries[0].status).toBe('partial');
    expect(summaries[0].results[0].status).toBe('skipped');
    expect(summaries[0].results[0].message).toContain('Versandkosten');
    expect(summaries[0].results[1].status).toBe('success');

    expect(select('SELECT id FROM expenses')).toHaveLength(0);
    expect(select('SELECT id FROM tasks')).toHaveLength(1);
  });

  it('lässt nicht auflösbare Variablen als Rohtext stehen und vermerkt sie im Result', async () => {
    const orderId = seedOrder({ customer_name: null });
    await createPlaybook({
      name: 'Variablen',
      trigger_status: 'paid',
      platform_filter: null,
      actions: [
        {
          type: 'create_task',
          title_template: 'Für {{kundenname}}: {{unbekannt}}',
          priority: 'low',
          due_offset_days: null,
          link_order: false,
        },
      ],
    });

    const summaries = await runPlaybooksForStatusChange(orderId, 'paid');
    expect(summaries[0].results[0].message).toContain('{{kundenname}}');
    expect(summaries[0].results[0].message).toContain('{{unbekannt}}');

    const tasks = select('SELECT title, order_id FROM tasks');
    expect(tasks[0].title).toBe('Für {{kundenname}}: {{unbekannt}}');
    expect(tasks[0].order_id).toBeNull();
  });

  it('eine fehlgeschlagene Aktion bricht die restlichen nicht ab; alle fehlgeschlagen ergibt error', async () => {
    const orderId = seedOrder();
    await createPlaybook({
      name: 'Mit Fehler',
      trigger_status: 'paid',
      platform_filter: null,
      actions: [
        { type: 'suggest_template', template_id: crypto.randomUUID() },
        {
          type: 'create_task',
          title_template: 'Läuft trotzdem',
          priority: 'medium',
          due_offset_days: null,
          link_order: true,
        },
      ],
    });
    await createPlaybook({
      name: 'Nur Fehler',
      trigger_status: 'paid',
      platform_filter: null,
      actions: [{ type: 'suggest_template', template_id: crypto.randomUUID() }],
    });

    const summaries = await runPlaybooksForStatusChange(orderId, 'paid');
    expect(summaries).toHaveLength(2);

    const mixed = summaries.find((summary) => summary.playbook_name === 'Mit Fehler');
    const broken = summaries.find((summary) => summary.playbook_name === 'Nur Fehler');
    expect(mixed?.status).toBe('partial');
    expect(mixed?.results[0].status).toBe('error');
    expect(mixed?.results[1].status).toBe('success');
    expect(broken?.status).toBe('error');
    expect(select('SELECT id FROM tasks')).toHaveLength(1);
  });

  it('respektiert den Plattform-Filter', async () => {
    const orderId = seedOrder({ platform: 'ebay' });
    await createPlaybook({
      name: 'Nur Etsy',
      trigger_status: 'paid',
      platform_filter: ['etsy'],
      actions: [
        {
          type: 'create_task',
          title_template: 'Etsy-Aufgabe',
          priority: 'medium',
          due_offset_days: null,
          link_order: true,
        },
      ],
    });

    const summaries = await runPlaybooksForStatusChange(orderId, 'paid');
    expect(summaries).toHaveLength(0);
    expect(select('SELECT id FROM playbook_runs')).toHaveLength(0);
  });

  it('suggest_template legt offenen Vorschlag im Run-Result ab', async () => {
    const templateId = seedTemplate('Versandbestätigung');
    const orderId = seedOrder();
    await createPlaybook({
      name: 'Vorschlag',
      trigger_status: 'shipped',
      platform_filter: null,
      actions: [{ type: 'suggest_template', template_id: templateId }],
    });

    const summaries = await runPlaybooksForStatusChange(orderId, 'shipped');
    expect(summaries[0].status).toBe('success');
    expect(summaries[0].results[0].template_id).toBe(templateId);
    expect(summaries[0].results[0].template_name).toBe('Versandbestätigung');
    expect(summaries[0].results[0].dismissed).toBe(false);
    // Es wird keine Entität erstellt
    expect(summaries[0].created_count).toBe(0);
  });
});

describe('Statusänderung wird niemals blockiert', () => {
  it('updateOrder gelingt auch, wenn die Engine intern crasht (Tabelle fehlt)', async () => {
    const orderId = seedOrder();
    execute('DROP TABLE playbook_runs');

    const updated = await updateOrder(orderId, { status: 'paid' });
    expect(updated.status).toBe('paid');

    const rows = select('SELECT status FROM orders WHERE id = $1', [orderId]);
    expect(rows[0].status).toBe('paid');
  });

  it('updateOrder gelingt auch, wenn alle Playbook-Aktionen fehlschlagen', async () => {
    const orderId = seedOrder();
    await createPlaybook({
      name: 'Kaputt',
      trigger_status: 'paid',
      platform_filter: null,
      actions: [{ type: 'suggest_template', template_id: crypto.randomUUID() }],
    });

    const updated = await updateOrder(orderId, { status: 'paid' });
    expect(updated.status).toBe('paid');

    const runs = select('SELECT status FROM playbook_runs');
    expect(runs).toHaveLength(1);
    expect(runs[0].status).toBe('error');
  });
});

describe('Dry-Run', () => {
  it('schreibt keine Entitäten, loggt aber mit status=dry_run und Vorschau', async () => {
    const orderId = seedOrder({ shipping_cost: 3.2 });
    const playbook = await createPlaybook({
      name: 'Trockenlauf',
      trigger_status: 'shipped',
      platform_filter: null,
      actions: [
        {
          type: 'create_task',
          title_template: 'Paket für {{kundenname}}',
          priority: 'urgent',
          due_offset_days: 0,
          link_order: true,
        },
        {
          type: 'create_expense',
          amount_gross: null,
          amount_source: 'shipping_cost',
          category: 'versand',
          subcategory: null,
          vendor: 'DHL',
          purpose_template: 'Versand {{bestellnummer}}',
        },
      ],
    });

    const summary = await runPlaybookDryRun(playbook, orderId);
    expect(summary.status).toBe('dry_run');
    expect(summary.results[0].preview).toContain('Paket für Max Muster');
    expect(summary.results[1].preview).toContain('3,20');

    expect(select('SELECT id FROM tasks')).toHaveLength(0);
    expect(select('SELECT id FROM expenses')).toHaveLength(0);
    const runs = await getRecentRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0].status).toBe('dry_run');
    expect(runs[0].playbook_name).toBe('Trockenlauf');

    // Dry-Run verbraucht die Idempotenz nicht: der echte Lauf feuert danach noch
    const real = await runPlaybooksForStatusChange(orderId, 'shipped');
    expect(real).toHaveLength(1);
    expect(select('SELECT id FROM tasks')).toHaveLength(1);
    expect(select('SELECT id FROM expenses')).toHaveLength(1);
  });
});

// ============================================================
// Adversariale Edge-Cases (Verifikations-Session Juli 2026)
// ============================================================

describe('Edge-Cases: Auftragsdaten', () => {
  it('soft-gelöschter Auftrag: Engine feuert nicht', async () => {
    const orderId = seedOrder({ deleted_at: new Date().toISOString() });
    await createPlaybook({
      name: 'Gelöschter Auftrag',
      trigger_status: 'paid',
      platform_filter: null,
      actions: [SIMPLE_TASK_ACTION as never],
    });

    const summaries = await runPlaybooksForStatusChange(orderId, 'paid');
    expect(summaries).toHaveLength(0);
    expect(select('SELECT id FROM tasks')).toHaveLength(0);
    expect(select('SELECT id FROM playbook_runs')).toHaveLength(0);
  });

  it('überlanger Titel nach Variablenersetzung wird auf 200 Zeichen gekürzt statt zu scheitern', async () => {
    const longName = 'K'.repeat(120);
    const orderId = seedOrder({ customer_name: longName });
    await createPlaybook({
      name: 'Langer Titel',
      trigger_status: 'paid',
      platform_filter: null,
      actions: [
        {
          type: 'create_task',
          title_template: `${'T'.repeat(150)} {{kundenname}}`,
          priority: 'medium',
          due_offset_days: null,
          link_order: true,
        },
      ],
    });

    const summaries = await runPlaybooksForStatusChange(orderId, 'paid');
    expect(summaries[0].status).toBe('success');
    const title = String(select('SELECT title FROM tasks')[0].title);
    expect(title.length).toBe(200);
    expect(title.endsWith('…')).toBe(true);
  });
});

describe('Edge-Cases: Trigger, Reihenfolge & Idempotenz', () => {
  it('zwei Playbooks auf demselben Trigger feuern beide, deterministisch in Anlage-Reihenfolge', async () => {
    const orderId = seedOrder();
    // Bewusst in umgekehrter Reihenfolge einfügen: created_at entscheidet, nicht die Insert-Reihenfolge
    seedPlaybookRow({
      name: 'Zweites (jünger)',
      trigger_status: 'paid',
      actions: [{ ...SIMPLE_TASK_ACTION, title_template: 'B' }],
      created_at: '2026-07-02T10:00:00.000Z',
    });
    seedPlaybookRow({
      name: 'Erstes (älter)',
      trigger_status: 'paid',
      actions: [{ ...SIMPLE_TASK_ACTION, title_template: 'A' }],
      created_at: '2026-07-01T10:00:00.000Z',
    });

    const summaries = await runPlaybooksForStatusChange(orderId, 'paid');
    expect(summaries.map((summary) => summary.playbook_name)).toEqual([
      'Erstes (älter)',
      'Zweites (jünger)',
    ]);
    expect(select('SELECT id FROM tasks')).toHaveLength(2);
  });

  it('ein Fehler im ersten Playbook blockiert das zweite nicht', async () => {
    const orderId = seedOrder();
    seedPlaybookRow({
      name: 'Kaputt zuerst',
      trigger_status: 'paid',
      actions: [{ type: 'suggest_template', template_id: crypto.randomUUID() }],
      created_at: '2026-07-01T10:00:00.000Z',
    });
    seedPlaybookRow({
      name: 'Läuft danach',
      trigger_status: 'paid',
      actions: [SIMPLE_TASK_ACTION],
      created_at: '2026-07-02T10:00:00.000Z',
    });

    const summaries = await runPlaybooksForStatusChange(orderId, 'paid');
    expect(summaries.map((summary) => [summary.playbook_name, summary.status])).toEqual([
      ['Kaputt zuerst', 'error'],
      ['Läuft danach', 'success'],
    ]);
    expect(select('SELECT id FROM tasks')).toHaveLength(1);
  });

  it('shipping_cost 0 (nicht null) wird ohne 0-EUR-Ausgabe übersprungen', async () => {
    const orderId = seedOrder({ shipping_cost: 0 });
    await createPlaybook({
      name: 'Null Euro',
      trigger_status: 'shipped',
      platform_filter: null,
      actions: [
        {
          type: 'create_expense',
          amount_gross: null,
          amount_source: 'shipping_cost',
          category: 'versand',
          subcategory: null,
          vendor: 'DHL',
          purpose_template: '',
        },
      ],
    });

    const summaries = await runPlaybooksForStatusChange(orderId, 'shipped');
    expect(summaries[0].status).toBe('partial');
    expect(summaries[0].results[0].status).toBe('skipped');
    expect(summaries[0].results[0].message).toContain('0 €');
    expect(select('SELECT id FROM expenses')).toHaveLength(0);
  });
});
