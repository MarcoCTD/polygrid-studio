/**
 * Integrationstests der Status/Payment-Entkopplung (Modul 08) gegen eine echte
 * In-Memory-SQLite (sql.js) mit den echten App-Migrationen – analog zum
 * playbookEngine-Test.
 *
 * Kernaussagen:
 * - createOrder und updateOrder leiten payment_status NICHT mehr aus dem Status
 *   ab und umgekehrt.
 * - payment_received_date folgt ausschließlich dem payment_status='paid'.
 * - Create und Update verhalten sich konsistent.
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
  getSetting: async () => null,
  setSetting: async () => undefined,
}));

const { createOrder, updateOrder, getOrderById } = await import('./ordersService');

let SQL: SqlJsStatic;
let rawDb: SqlJsDatabase;

const TODAY = new Date().toISOString().slice(0, 10);

const BASE = {
  platform: 'direkt' as const,
  sale_price: 20,
  order_date: '2026-07-01',
  material_cost: null,
  platform_fee: null,
};

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

describe('createOrder – keine Kopplung Status ↔ Zahlung', () => {
  it('setzt Defaults status=ordered / payment_status=pending / kein Zahlungsdatum', async () => {
    const order = await createOrder({ ...BASE });
    expect(order.status).toBe('ordered');
    expect(order.payment_status).toBe('pending');
    expect(order.payment_received_date).toBeNull();
  });

  it('leitet payment_status NICHT aus dem Status ab (status=completed bleibt pending)', async () => {
    const order = await createOrder({ ...BASE, status: 'completed' });
    expect(order.status).toBe('completed');
    expect(order.payment_status).toBe('pending');
    expect(order.payment_received_date).toBeNull();
  });

  it('setzt das Zahlungsdatum aus payment_status=paid, ohne den Status zu ändern', async () => {
    const order = await createOrder({ ...BASE, payment_status: 'paid' });
    expect(order.status).toBe('ordered');
    expect(order.payment_status).toBe('paid');
    expect(order.payment_received_date).toBe(TODAY);
  });

  it('übernimmt ein explizit gesetztes Zahlungsdatum', async () => {
    const order = await createOrder({
      ...BASE,
      payment_status: 'paid',
      payment_received_date: '2026-06-15',
    });
    expect(order.payment_received_date).toBe('2026-06-15');
  });
});

describe('updateOrder – keine Kopplung Status ↔ Zahlung', () => {
  it('ändert bei Status-Wechsel weder payment_status noch Zahlungsdatum', async () => {
    const created = await createOrder({ ...BASE });
    const updated = await updateOrder(created.id, { status: 'completed' });
    expect(updated.status).toBe('completed');
    expect(updated.payment_status).toBe('pending');
    expect(updated.payment_received_date).toBeNull();
  });

  it('setzt das Zahlungsdatum beim Wechsel auf payment_status=paid, Status unberührt', async () => {
    const created = await createOrder({ ...BASE, status: 'in_production' });
    const updated = await updateOrder(created.id, { payment_status: 'paid' });
    expect(updated.status).toBe('in_production');
    expect(updated.payment_status).toBe('paid');
    expect(updated.payment_received_date).toBe(TODAY);
  });

  it('leert das Zahlungsdatum beim Wechsel VON paid auf refunded', async () => {
    const created = await createOrder({ ...BASE, payment_status: 'paid' });
    expect(created.payment_received_date).toBe(TODAY);
    const updated = await updateOrder(created.id, { payment_status: 'refunded' });
    expect(updated.payment_status).toBe('refunded');
    expect(updated.payment_received_date).toBeNull();
  });

  it('respektiert ein explizit gesetztes Zahlungsdatum trotz Statuswechsel auf paid', async () => {
    const created = await createOrder({ ...BASE });
    const updated = await updateOrder(created.id, {
      payment_status: 'paid',
      payment_received_date: '2026-05-01',
    });
    expect(updated.payment_received_date).toBe('2026-05-01');
  });
});

describe('Create == Update Konsistenz', () => {
  it('erzeugt denselben Zahlungszustand, egal ob paid bei Create oder per Update gesetzt', async () => {
    const viaCreate = await createOrder({ ...BASE, payment_status: 'paid' });

    const stepwise = await createOrder({ ...BASE });
    const viaUpdate = await updateOrder(stepwise.id, { payment_status: 'paid' });

    expect(viaCreate.payment_status).toBe(viaUpdate.payment_status);
    expect(viaCreate.payment_received_date).toBe(viaUpdate.payment_received_date);
    // Beide lassen den Ablauf-Status unangetastet (kein Sprung auf "confirmed").
    expect(viaCreate.status).toBe('ordered');
    expect(viaUpdate.status).toBe('ordered');
  });
});

it('reintegriert getOrderById nach Update (Sanity)', async () => {
  const created = await createOrder({ ...BASE });
  await updateOrder(created.id, { payment_status: 'paid' });
  const reloaded = await getOrderById(created.id);
  expect(reloaded?.payment_status).toBe('paid');
  expect(reloaded?.payment_received_date).toBe(TODAY);
});
