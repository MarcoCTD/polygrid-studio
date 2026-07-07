/**
 * Unit-Tests für salesStatsService gegen echtes SQLite (sql.js In-Memory)
 * mit den echten Drizzle-Migrationen der App.
 */
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import { MIGRATIONS } from '@/services/database/migrations';
import {
  getMonthlySalesForProduct,
  getProductSalesKpis,
  getRecentOrdersForProduct,
  getSalesTotalsByProduct,
  getTopSellers,
  periodStartDate,
  type SalesStatsDatabase,
} from './salesStatsService';

const STATEMENT_BREAKPOINT = '--> statement-breakpoint';

let sqlJs: SqlJsStatic | null = null;

async function loadSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJs) {
    sqlJs = await initSqlJs({
      locateFile: (file: string) => path.join(process.cwd(), 'node_modules/sql.js/dist', file),
    });
  }
  return sqlJs;
}

type SqlValue = string | number | null;

function toSqlValue(value: unknown): SqlValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number' || typeof value === 'string') return value;
  return JSON.stringify(value);
}

class SqlJsTestDatabase implements SalesStatsDatabase {
  constructor(private readonly db: Database) {}

  async select<T>(query: string, bindValues: unknown[] = []): Promise<T> {
    const stmt = this.db.prepare(query);
    try {
      if (bindValues.length > 0) {
        const params: Record<string, SqlValue> = {};
        bindValues.forEach((value, index) => {
          params[`$${index + 1}`] = toSqlValue(value);
        });
        stmt.bind(params);
      }
      const rows: Record<string, unknown>[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      return rows as T;
    } finally {
      stmt.free();
    }
  }

  execute(query: string, bindValues: unknown[] = []): void {
    if (bindValues.length > 0) {
      const params: Record<string, SqlValue> = {};
      bindValues.forEach((value, index) => {
        params[`$${index + 1}`] = toSqlValue(value);
      });
      this.db.run(query, params);
    } else {
      this.db.run(query);
    }
  }
}

async function createMigratedDatabase(): Promise<SqlJsTestDatabase> {
  const SQL = await loadSqlJs();
  const db = new SQL.Database();
  for (const migration of MIGRATIONS) {
    const statements = migration.sql
      .split(STATEMENT_BREAKPOINT)
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0);
    for (const statement of statements) {
      db.run(statement);
    }
  }
  return new SqlJsTestDatabase(db);
}

const PRODUCT_A = '11111111-1111-4111-8111-111111111111';
const PRODUCT_B = '22222222-2222-4222-8222-222222222222';

function seedProduct(db: SqlJsTestDatabase, id: string, name: string, deletedAt?: string): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO products (id, name, category, status, material_type, created_at, updated_at, deleted_at)
     VALUES ($1, $2, 'Deko', 'online', 'PLA', $3, $4, $5)`,
    [id, name, now, now, deletedAt ?? null],
  );
}

interface SeedOrderOptions {
  productId?: string | null;
  quantity?: number;
  salePrice?: number;
  status?: string;
  paymentStatus?: string;
  orderDate?: string;
  deletedAt?: string | null;
}

let receiptCounter = 0;

function seedOrder(db: SqlJsTestDatabase, options: SeedOrderOptions = {}): string {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  receiptCounter += 1;
  db.execute(
    `INSERT INTO orders (
       id, receipt_number, platform, product_id, quantity, sale_price,
       status, payment_status, order_date, tax_locked, created_at, updated_at, deleted_at
     ) VALUES ($1, $2, 'etsy', $3, $4, $5, $6, $7, $8, 0, $9, $10, $11)`,
    [
      id,
      `2026-${String(receiptCounter).padStart(4, '0')}`,
      options.productId === undefined ? PRODUCT_A : options.productId,
      options.quantity ?? 1,
      options.salePrice ?? 20,
      options.status ?? 'completed',
      options.paymentStatus ?? 'paid',
      options.orderDate ?? isoDaysAgo(5),
      now,
      now,
      options.deletedAt ?? null,
    ],
  );
  return id;
}

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

describe('salesStatsService', () => {
  let db: SqlJsTestDatabase;

  beforeEach(async () => {
    db = await createMigratedDatabase();
    receiptCounter = 0;
    seedProduct(db, PRODUCT_A, 'Spiral-Vase');
    seedProduct(db, PRODUCT_B, 'Kabelhalter');
  });

  describe('getSalesTotalsByProduct', () => {
    it('summiert Menge und Umsatz (sale_price * quantity) pro Produkt', async () => {
      seedOrder(db, { quantity: 2, salePrice: 10 });
      seedOrder(db, { quantity: 1, salePrice: 25.5 });
      seedOrder(db, { productId: PRODUCT_B, quantity: 3, salePrice: 5 });

      const totals = await getSalesTotalsByProduct('all', db);

      expect(totals.get(PRODUCT_A)).toEqual({ units_sold: 3, revenue: 45.5 });
      expect(totals.get(PRODUCT_B)).toEqual({ units_sold: 3, revenue: 15 });
    });

    it('schließt refundierte Aufträge aus (payment_status = refunded)', async () => {
      seedOrder(db, { paymentStatus: 'refunded' });
      seedOrder(db, { paymentStatus: 'pending' });
      seedOrder(db, { paymentStatus: 'disputed' });

      const totals = await getSalesTotalsByProduct('all', db);

      expect(totals.size).toBe(0);
    });

    it('schließt stornierte Aufträge aus (status = cancelled)', async () => {
      seedOrder(db, { status: 'cancelled' });

      const totals = await getSalesTotalsByProduct('all', db);

      expect(totals.size).toBe(0);
    });

    it('schließt soft-deleted Aufträge aus', async () => {
      seedOrder(db, { deletedAt: new Date().toISOString() });

      const totals = await getSalesTotalsByProduct('all', db);

      expect(totals.size).toBe(0);
    });

    it('ignoriert Aufträge ohne product_id', async () => {
      seedOrder(db, { productId: null });

      const totals = await getSalesTotalsByProduct('all', db);

      expect(totals.size).toBe(0);
    });

    it('zählt bezahlte Aufträge unabhängig vom Auftragsstatus (außer cancelled)', async () => {
      seedOrder(db, { status: 'paid' });
      seedOrder(db, { status: 'in_production' });
      seedOrder(db, { status: 'shipped' });
      seedOrder(db, { status: 'issue' });

      const totals = await getSalesTotalsByProduct('all', db);

      expect(totals.get(PRODUCT_A)?.units_sold).toBe(4);
    });

    it('filtert nach Zeitraum (letzte 30 Tage)', async () => {
      seedOrder(db, { orderDate: isoDaysAgo(5) });
      seedOrder(db, { orderDate: isoDaysAgo(45) });

      const last30 = await getSalesTotalsByProduct('last_30_days', db);
      const all = await getSalesTotalsByProduct('all', db);

      expect(last30.get(PRODUCT_A)?.units_sold).toBe(1);
      expect(all.get(PRODUCT_A)?.units_sold).toBe(2);
    });

    it('filtert nach laufendem Jahr', async () => {
      const year = new Date().getFullYear();
      seedOrder(db, { orderDate: `${year}-01-15` });
      seedOrder(db, { orderDate: `${year - 1}-12-20` });

      const currentYear = await getSalesTotalsByProduct('current_year', db);

      expect(currentYear.get(PRODUCT_A)?.units_sold).toBe(1);
    });
  });

  describe('getProductSalesKpis', () => {
    it('liefert Gesamt- und 30-Tage-Kennzahlen in einer Query', async () => {
      seedOrder(db, { quantity: 2, salePrice: 10, orderDate: isoDaysAgo(3) });
      seedOrder(db, { quantity: 1, salePrice: 30, orderDate: isoDaysAgo(60) });
      seedOrder(db, { productId: PRODUCT_B, quantity: 5, salePrice: 5 });

      const kpis = await getProductSalesKpis(PRODUCT_A, db);

      expect(kpis.total).toEqual({ units_sold: 3, revenue: 50 });
      expect(kpis.last30Days).toEqual({ units_sold: 2, revenue: 20 });
    });

    it('liefert Nullwerte für Produkte ohne Verkäufe', async () => {
      const kpis = await getProductSalesKpis(PRODUCT_A, db);

      expect(kpis.total).toEqual({ units_sold: 0, revenue: 0 });
      expect(kpis.last30Days).toEqual({ units_sold: 0, revenue: 0 });
    });
  });

  describe('getMonthlySalesForProduct', () => {
    it('füllt fehlende Monate mit 0 auf und gruppiert korrekt', async () => {
      const now = new Date(2026, 6, 15); // 15.07.2026
      seedOrder(db, { quantity: 2, salePrice: 10, orderDate: '2026-07-01' });
      seedOrder(db, { quantity: 1, salePrice: 10, orderDate: '2026-05-20' });
      // Außerhalb des 12-Monats-Fensters:
      seedOrder(db, { quantity: 9, salePrice: 10, orderDate: '2025-06-30' });

      const monthly = await getMonthlySalesForProduct(PRODUCT_A, 12, db, now);

      expect(monthly).toHaveLength(12);
      expect(monthly[0].month).toBe('2025-08');
      expect(monthly[11]).toEqual({ month: '2026-07', units_sold: 2, revenue: 20 });
      expect(monthly.find((m) => m.month === '2026-05')).toEqual({
        month: '2026-05',
        units_sold: 1,
        revenue: 10,
      });
      expect(monthly.filter((m) => m.units_sold > 0)).toHaveLength(2);
    });
  });

  describe('getRecentOrdersForProduct', () => {
    it('liefert maximal die letzten 10 Aufträge des Produkts, neueste zuerst', async () => {
      for (let index = 0; index < 12; index++) {
        seedOrder(db, { orderDate: isoDaysAgo(index) });
      }
      seedOrder(db, { productId: PRODUCT_B, orderDate: isoDaysAgo(0) });
      seedOrder(db, { deletedAt: new Date().toISOString(), orderDate: isoDaysAgo(0) });

      const recent = await getRecentOrdersForProduct(PRODUCT_A, 10, db);

      expect(recent).toHaveLength(10);
      expect(recent[0].order_date >= recent[9].order_date).toBe(true);
    });
  });

  describe('getTopSellers', () => {
    it('sortiert nach Menge der letzten 90 Tage und begrenzt auf das Limit', async () => {
      seedOrder(db, { productId: PRODUCT_A, quantity: 2, orderDate: isoDaysAgo(10) });
      seedOrder(db, { productId: PRODUCT_B, quantity: 5, orderDate: isoDaysAgo(10) });
      // außerhalb der 90 Tage:
      seedOrder(db, { productId: PRODUCT_A, quantity: 50, orderDate: isoDaysAgo(120) });

      const top = await getTopSellers('last_90_days', 5, db);

      expect(top).toHaveLength(2);
      expect(top[0].product_id).toBe(PRODUCT_B);
      expect(top[0].units_sold).toBe(5);
      expect(top[1].product_id).toBe(PRODUCT_A);
      expect(top[1].units_sold).toBe(2);
    });

    it('schließt soft-deleted Produkte aus', async () => {
      const deletedProduct = '33333333-3333-4333-8333-333333333333';
      seedProduct(db, deletedProduct, 'Gelöscht', new Date().toISOString());
      seedOrder(db, { productId: deletedProduct, quantity: 9 });

      const top = await getTopSellers('last_90_days', 5, db);

      expect(top.find((entry) => entry.product_id === deletedProduct)).toBeUndefined();
    });
  });

  describe('periodStartDate', () => {
    it('liefert null für gesamt und korrekte Grenzen für die Zeiträume', () => {
      const now = new Date(2026, 6, 15);
      expect(periodStartDate('all', now)).toBeNull();
      expect(periodStartDate('current_year', now)).toBe('2026-01-01');
      expect(periodStartDate('last_30_days', now)).toBe('2026-06-15');
      expect(periodStartDate('last_90_days', now)).toBe('2026-04-16');
    });
  });
});
