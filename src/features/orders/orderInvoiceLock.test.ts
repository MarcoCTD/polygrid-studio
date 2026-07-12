/**
 * Integrationstests der Rechnungs-Kopplung (Modul 08) gegen sql.js mit den
 * echten App-Migrationen:
 * - has_paid_invoice-Flag aus getOrderById (steuert die Zahlungs-Sperre),
 * - Smart-Action order_invoice_mismatch (stiller Widerspruch).
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
    if (values.length > 0) this.db.run(query, toBindParams(query, values));
    else this.db.run(query);
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
  getSetting: async () => null,
  setSetting: async () => undefined,
}));

const { getOrderById } = await import('./services/ordersService');
const { ORDER_SMART_ACTION_RULES } = await import('./smartActionRules');

const mismatchRule = ORDER_SMART_ACTION_RULES.find((rule) => rule.id === 'order_invoice_mismatch')!;

let SQL: SqlJsStatic;
let rawDb: SqlJsDatabase;

function execute(query: string, values: unknown[] = []): void {
  rawDb.run(query, toBindParams(query, values));
}

let counter = 0;

function seedOrder(paymentStatus = 'pending'): string {
  const id = crypto.randomUUID();
  counter += 1;
  const ts = new Date().toISOString();
  execute(
    `INSERT INTO orders (id, receipt_number, platform, quantity, sale_price, status, payment_status, order_date, tax_locked, created_at, updated_at)
     VALUES ($1, $2, 'direkt', 1, 30, 'confirmed', $3, '2026-07-01', 0, $4, $4)`,
    [id, `2026-${String(counter).padStart(4, '0')}`, paymentStatus, ts],
  );
  return id;
}

function seedClient(): string {
  const id = crypto.randomUUID();
  const ts = new Date().toISOString();
  execute(`INSERT INTO clients (id, name, created_at, updated_at) VALUES ($1, 'Kunde', $2, $2)`, [
    id,
    ts,
  ]);
  return id;
}

function seedInvoice(orderId: string | null, status: string, deleted = false): string {
  const id = crypto.randomUUID();
  const ts = new Date().toISOString();
  execute(
    `INSERT INTO documents (id, type, status, client_id, order_id, line_items, total, layout, created_at, updated_at, deleted_at)
     VALUES ($1, 'invoice', $2, $3, $4, '[]', 30, 'polygrid', $5, $5, $6)`,
    [id, status, seedClient(), orderId, ts, deleted ? ts : null],
  );
  return id;
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
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const statement of statements) rawDb.run(statement);
  }
});

describe('has_paid_invoice (Zahlungs-Sperre)', () => {
  it('ist true bei verknüpfter bezahlter Rechnung', async () => {
    const orderId = seedOrder('pending');
    seedInvoice(orderId, 'paid');
    const order = await getOrderById(orderId);
    expect(order?.has_paid_invoice).toBe(true);
  });

  it('ist false ohne Rechnung', async () => {
    const orderId = seedOrder('pending');
    const order = await getOrderById(orderId);
    expect(order?.has_paid_invoice).toBe(false);
  });

  it('ist false bei ausgestellter (noch nicht bezahlter) Rechnung', async () => {
    const orderId = seedOrder('pending');
    seedInvoice(orderId, 'issued');
    const order = await getOrderById(orderId);
    expect(order?.has_paid_invoice).toBe(false);
  });

  it('ist false nach Storno (Rechnung cancelled) – Entsperrung', async () => {
    const orderId = seedOrder('paid');
    seedInvoice(orderId, 'cancelled');
    const order = await getOrderById(orderId);
    expect(order?.has_paid_invoice).toBe(false);
  });

  it('ist false bei soft-gelöschter bezahlter Rechnung', async () => {
    const orderId = seedOrder('pending');
    seedInvoice(orderId, 'paid', true);
    const order = await getOrderById(orderId);
    expect(order?.has_paid_invoice).toBe(false);
  });
});

describe('Smart-Action order_invoice_mismatch', () => {
  it('meldet den Widerspruch (bezahlte Rechnung, Auftrag nicht bezahlt)', async () => {
    const orderId = seedOrder('pending');
    seedInvoice(orderId, 'paid');
    const result = await mismatchRule.evaluate();
    expect(result).not.toBeNull();
    expect(result?.count).toBe(1);
    expect(result?.severity).toBe('danger');
  });

  it('meldet nichts, wenn der Auftrag ebenfalls bezahlt ist', async () => {
    const orderId = seedOrder('paid');
    seedInvoice(orderId, 'paid');
    expect(await mismatchRule.evaluate()).toBeNull();
  });

  it('meldet nichts bei nur ausgestellter Rechnung', async () => {
    const orderId = seedOrder('pending');
    seedInvoice(orderId, 'issued');
    expect(await mismatchRule.evaluate()).toBeNull();
  });

  it('meldet nichts nach Storno der Rechnung', async () => {
    const orderId = seedOrder('pending');
    seedInvoice(orderId, 'cancelled');
    expect(await mismatchRule.evaluate()).toBeNull();
  });
});
