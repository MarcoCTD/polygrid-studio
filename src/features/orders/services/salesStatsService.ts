/**
 * Verkaufsstatistik pro Produkt (Modul 15).
 *
 * Definition "Verkauf": Auftrag mit payment_status = 'paid', Status nicht
 * 'cancelled', nicht soft-deleted und mit verknüpftem Produkt (product_id).
 * Menge = SUM(quantity), Umsatz = SUM(sale_price * quantity).
 *
 * Alle Funktionen arbeiten mit Aggregat-Queries (kein N+1) und akzeptieren
 * eine injizierbare Datenbank für Unit-Tests.
 */
import { getDatabase } from '@/services/database';

export interface SalesStatsDatabase {
  select<T>(query: string, bindValues?: unknown[]): Promise<T>;
}

export type SalesPeriod = 'all' | 'current_year' | 'last_30_days' | 'last_90_days';

export interface SalesTotals {
  units_sold: number;
  revenue: number;
}

export interface ProductSalesKpis {
  total: SalesTotals;
  last30Days: SalesTotals;
}

export interface MonthlySalesDatum {
  /** Monat im Format YYYY-MM */
  month: string;
  units_sold: number;
  revenue: number;
}

export interface ProductRecentOrder {
  id: string;
  receipt_number: string;
  order_date: string;
  quantity: number;
  sale_price: number;
  status: string;
  payment_status: string;
  platform: string;
  customer_name: string | null;
}

export interface TopSellerEntry {
  product_id: string;
  product_name: string;
  units_sold: number;
  revenue: number;
}

/** WHERE-Fragment für die Verkaufsdefinition (Alias o = orders). */
const SALE_CONDITION = `o.deleted_at IS NULL
  AND o.payment_status = 'paid'
  AND o.status != 'cancelled'
  AND o.product_id IS NOT NULL`;

/** Lokales Datum als YYYY-MM-DD (order_date ist ein lokales ISO-Datum, kein UTC-Timestamp). */
function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Startdatum (inklusive) für einen Zeitraum, null = keine Untergrenze. */
export function periodStartDate(period: SalesPeriod, now = new Date()): string | null {
  switch (period) {
    case 'all':
      return null;
    case 'current_year':
      return `${now.getFullYear()}-01-01`;
    case 'last_30_days': {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      return isoDate(start);
    }
    case 'last_90_days': {
      const start = new Date(now);
      start.setDate(start.getDate() - 90);
      return isoDate(start);
    }
  }
}

interface TotalsRow {
  product_id: string;
  units_sold: number | null;
  revenue: number | null;
}

/**
 * Verkaufsmengen und Umsatz für ALLE Produkte in einer Aggregat-Query.
 * Für die Produktlisten-Spalte "Verkauft" (kein N+1).
 */
export async function getSalesTotalsByProduct(
  period: SalesPeriod = 'all',
  db: SalesStatsDatabase = getDatabase(),
): Promise<Map<string, SalesTotals>> {
  try {
    const start = periodStartDate(period);
    const params: unknown[] = [];
    let dateClause = '';
    if (start !== null) {
      params.push(start);
      dateClause = `AND o.order_date >= $${params.length}`;
    }

    const rows = await db.select<TotalsRow[]>(
      `SELECT
         o.product_id,
         SUM(o.quantity) AS units_sold,
         SUM(o.sale_price * o.quantity) AS revenue
       FROM orders o
       WHERE ${SALE_CONDITION} ${dateClause}
       GROUP BY o.product_id`,
      params,
    );

    const result = new Map<string, SalesTotals>();
    for (const row of rows) {
      result.set(row.product_id, {
        units_sold: Number(row.units_sold ?? 0),
        revenue: Number(row.revenue ?? 0),
      });
    }
    return result;
  } catch (error) {
    throw new Error(
      `Verkaufszahlen konnten nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

interface KpiRow {
  total_units: number | null;
  total_revenue: number | null;
  last30_units: number | null;
  last30_revenue: number | null;
}

/** Kennzahlen für den Verkäufe-Tab eines Produkts (eine Query). */
export async function getProductSalesKpis(
  productId: string,
  db: SalesStatsDatabase = getDatabase(),
): Promise<ProductSalesKpis> {
  try {
    const last30Start = periodStartDate('last_30_days');
    const rows = await db.select<KpiRow[]>(
      `SELECT
         SUM(o.quantity) AS total_units,
         SUM(o.sale_price * o.quantity) AS total_revenue,
         SUM(CASE WHEN o.order_date >= $2 THEN o.quantity ELSE 0 END) AS last30_units,
         SUM(CASE WHEN o.order_date >= $2 THEN o.sale_price * o.quantity ELSE 0 END) AS last30_revenue
       FROM orders o
       WHERE ${SALE_CONDITION} AND o.product_id = $1`,
      [productId, last30Start],
    );

    const row = rows[0];
    return {
      total: {
        units_sold: Number(row?.total_units ?? 0),
        revenue: Number(row?.total_revenue ?? 0),
      },
      last30Days: {
        units_sold: Number(row?.last30_units ?? 0),
        revenue: Number(row?.last30_revenue ?? 0),
      },
    };
  } catch (error) {
    throw new Error(
      `Verkaufskennzahlen konnten nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

interface MonthlyRow {
  month: string;
  units_sold: number | null;
  revenue: number | null;
}

/**
 * Verkäufe pro Monat für die letzten `months` Monate (inkl. aktueller Monat).
 * Fehlende Monate werden mit 0 aufgefüllt, damit das Diagramm lückenlos ist.
 */
export async function getMonthlySalesForProduct(
  productId: string,
  months = 12,
  db: SalesStatsDatabase = getDatabase(),
  now = new Date(),
): Promise<MonthlySalesDatum[]> {
  try {
    const startMonth = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
    const startIso = `${startMonth.getFullYear()}-${String(startMonth.getMonth() + 1).padStart(2, '0')}-01`;

    const rows = await db.select<MonthlyRow[]>(
      `SELECT
         substr(o.order_date, 1, 7) AS month,
         SUM(o.quantity) AS units_sold,
         SUM(o.sale_price * o.quantity) AS revenue
       FROM orders o
       WHERE ${SALE_CONDITION} AND o.product_id = $1 AND o.order_date >= $2
       GROUP BY substr(o.order_date, 1, 7)`,
      [productId, startIso],
    );

    const byMonth = new Map(rows.map((row) => [row.month, row]));
    const result: MonthlySalesDatum[] = [];
    for (let index = 0; index < months; index++) {
      const date = new Date(startMonth.getFullYear(), startMonth.getMonth() + index, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const row = byMonth.get(key);
      result.push({
        month: key,
        units_sold: Number(row?.units_sold ?? 0),
        revenue: Number(row?.revenue ?? 0),
      });
    }
    return result;
  } catch (error) {
    throw new Error(
      `Monatsverkäufe konnten nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Die letzten Aufträge eines Produkts (alle nicht gelöschten Aufträge,
 * unabhängig vom Zahlungsstatus – die Liste zeigt die Auftragshistorie).
 */
export async function getRecentOrdersForProduct(
  productId: string,
  limit = 10,
  db: SalesStatsDatabase = getDatabase(),
): Promise<ProductRecentOrder[]> {
  try {
    const rows = await db.select<ProductRecentOrder[]>(
      `SELECT
         o.id, o.receipt_number, o.order_date, o.quantity, o.sale_price,
         o.status, o.payment_status, o.platform, o.customer_name
       FROM orders o
       WHERE o.deleted_at IS NULL AND o.product_id = $1
       ORDER BY o.order_date DESC, o.receipt_number DESC
       LIMIT $2`,
      [productId, limit],
    );
    return rows;
  } catch (error) {
    throw new Error(
      `Aufträge des Produkts konnten nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

interface TopSellerRow {
  product_id: string;
  product_name: string;
  units_sold: number | null;
  revenue: number | null;
}

/** Top-Seller: Top-Produkte nach verkaufter Menge im Zeitraum. */
export async function getTopSellers(
  period: SalesPeriod = 'last_90_days',
  limit = 5,
  db: SalesStatsDatabase = getDatabase(),
): Promise<TopSellerEntry[]> {
  try {
    const start = periodStartDate(period);
    const params: unknown[] = [];
    let dateClause = '';
    if (start !== null) {
      params.push(start);
      dateClause = `AND o.order_date >= $${params.length}`;
    }
    params.push(limit);

    const rows = await db.select<TopSellerRow[]>(
      `SELECT
         o.product_id,
         p.name AS product_name,
         SUM(o.quantity) AS units_sold,
         SUM(o.sale_price * o.quantity) AS revenue
       FROM orders o
       JOIN products p ON p.id = o.product_id AND p.deleted_at IS NULL
       WHERE ${SALE_CONDITION} ${dateClause}
       GROUP BY o.product_id, p.name
       ORDER BY units_sold DESC, revenue DESC
       LIMIT $${params.length}`,
      params,
    );

    return rows.map((row) => ({
      product_id: row.product_id,
      product_name: row.product_name,
      units_sold: Number(row.units_sold ?? 0),
      revenue: Number(row.revenue ?? 0),
    }));
  } catch (error) {
    throw new Error(
      `Top-Seller konnten nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
