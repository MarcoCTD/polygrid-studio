import { getDatabase } from '@/services/database';
import type { KpiSnapshot } from '../types';

type PeriodType = 'week' | 'month';

interface SumRow {
  total: number | string | null;
}

interface CountRow {
  count: number | string;
}

interface AvgRow {
  avg: number | string | null;
}

interface GroupSumRow {
  key: string;
  total: number | string | null;
}

interface SnapshotRow extends Omit<KpiSnapshot, 'revenue_by_platform' | 'expenses_by_category'> {
  revenue_by_platform: unknown;
  expenses_by_category: unknown;
}

function numberValue(value: number | string | null | undefined): number {
  return Number(value ?? 0) || 0;
}

function parseJsonRecord(value: unknown): Record<string, number> | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, number>;
  }
  if (typeof value !== 'string') return null;

  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, number>)
      : null;
  } catch {
    return null;
  }
}

function toJsonRecord(rows: GroupSumRow[]): Record<string, number> {
  return Object.fromEntries(rows.map((row) => [row.key, numberValue(row.total)]));
}

async function sum(query: string, params: unknown[]): Promise<number> {
  const rows = await getDatabase().select<SumRow[]>(query, params);
  return numberValue(rows[0]?.total);
}

async function count(query: string, params: unknown[]): Promise<number> {
  const rows = await getDatabase().select<CountRow[]>(query, params);
  return numberValue(rows[0]?.count);
}

async function average(query: string, params: unknown[]): Promise<number | null> {
  const rows = await getDatabase().select<AvgRow[]>(query, params);
  return rows[0]?.avg === null || rows[0]?.avg === undefined ? null : numberValue(rows[0].avg);
}

export async function createOrUpdateSnapshot(
  periodType: PeriodType,
  periodStart: string,
  periodEnd: string,
): Promise<KpiSnapshot> {
  try {
    const [
      revenue,
      expensesTotal,
      ordersCount,
      openOrders,
      openTasks,
      completedOrders,
      activeProducts,
      activeListings,
      avgMargin,
      revenueRows,
      expenseRows,
    ] = await Promise.all([
      sum(
        `SELECT SUM(sale_price) AS total
         FROM orders
         WHERE status = 'completed'
           AND order_date >= ?
           AND order_date <= ?
           AND deleted_at IS NULL`,
        [periodStart, periodEnd],
      ),
      sum(
        `SELECT SUM(amount_gross) AS total
         FROM expenses
         WHERE date >= ?
           AND date <= ?
           AND deleted_at IS NULL`,
        [periodStart, periodEnd],
      ),
      count(
        `SELECT COUNT(*) AS count
         FROM orders
         WHERE status = 'completed'
           AND order_date >= ?
           AND order_date <= ?
           AND deleted_at IS NULL`,
        [periodStart, periodEnd],
      ),
      count(
        `SELECT COUNT(*) AS count
         FROM orders
         WHERE status IN ('ordered', 'paid', 'in_production', 'ready')
           AND deleted_at IS NULL`,
        [],
      ),
      count(
        `SELECT COUNT(*) AS count
         FROM tasks
         WHERE status IN ('todo', 'in_progress')
           AND deleted_at IS NULL`,
        [],
      ),
      count(
        `SELECT COUNT(*) AS count
         FROM orders
         WHERE status = 'completed'
           AND order_date >= ?
           AND order_date <= ?
           AND deleted_at IS NULL`,
        [periodStart, periodEnd],
      ),
      count(
        `SELECT COUNT(*) AS count
         FROM products
         WHERE status = 'online'
           AND deleted_at IS NULL`,
        [],
      ),
      count(
        `SELECT COUNT(*) AS count
         FROM listings
         WHERE status = 'online'
           AND deleted_at IS NULL`,
        [],
      ),
      average(
        `SELECT AVG(estimated_margin) AS avg
         FROM products
         WHERE status = 'online'
           AND estimated_margin IS NOT NULL
           AND deleted_at IS NULL`,
        [],
      ),
      getDatabase().select<GroupSumRow[]>(
        `SELECT platform AS key, SUM(sale_price) AS total
         FROM orders
         WHERE status = 'completed'
           AND order_date >= ?
           AND order_date <= ?
           AND deleted_at IS NULL
         GROUP BY platform`,
        [periodStart, periodEnd],
      ),
      getDatabase().select<GroupSumRow[]>(
        `SELECT category AS key, SUM(amount_gross) AS total
         FROM expenses
         WHERE date >= ?
           AND date <= ?
           AND deleted_at IS NULL
         GROUP BY category`,
        [periodStart, periodEnd],
      ),
    ]);
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const revenueByPlatform = toJsonRecord(revenueRows);
    const expensesByCategory = toJsonRecord(expenseRows);

    await getDatabase().execute(
      `INSERT INTO kpi_records (
         id, period_type, period_start, period_end, revenue, expenses_total,
         orders_count, open_orders, open_tasks, completed_orders, active_products,
         active_listings, avg_margin, revenue_by_platform, expenses_by_category, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(period_type, period_start) DO UPDATE SET
         period_end = excluded.period_end,
         revenue = excluded.revenue,
         expenses_total = excluded.expenses_total,
         orders_count = excluded.orders_count,
         open_orders = excluded.open_orders,
         open_tasks = excluded.open_tasks,
         completed_orders = excluded.completed_orders,
         active_products = excluded.active_products,
         active_listings = excluded.active_listings,
         avg_margin = excluded.avg_margin,
         revenue_by_platform = excluded.revenue_by_platform,
         expenses_by_category = excluded.expenses_by_category,
         created_at = excluded.created_at`,
      [
        id,
        periodType,
        periodStart,
        periodEnd,
        revenue,
        expensesTotal,
        ordersCount,
        openOrders,
        openTasks,
        completedOrders,
        activeProducts,
        activeListings,
        avgMargin,
        JSON.stringify(revenueByPlatform),
        JSON.stringify(expensesByCategory),
        createdAt,
      ],
    );

    return {
      id,
      period_type: periodType,
      period_start: periodStart,
      period_end: periodEnd,
      revenue,
      expenses_total: expensesTotal,
      orders_count: ordersCount,
      open_orders: openOrders,
      open_tasks: openTasks,
      completed_orders: completedOrders,
      active_products: activeProducts,
      active_listings: activeListings,
      avg_margin: avgMargin,
      revenue_by_platform: revenueByPlatform,
      expenses_by_category: expensesByCategory,
      created_at: createdAt,
    };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'KPI-Snapshot konnte nicht speichern');
  }
}

export async function getSnapshots(periodType: PeriodType, limit = 12): Promise<KpiSnapshot[]> {
  try {
    const rows = await getDatabase().select<SnapshotRow[]>(
      `SELECT *
       FROM kpi_records
       WHERE period_type = ?
       ORDER BY period_start DESC
       LIMIT ?`,
      [periodType, limit],
    );

    return rows.map((row) => ({
      ...row,
      revenue_by_platform: parseJsonRecord(row.revenue_by_platform),
      expenses_by_category: parseJsonRecord(row.expenses_by_category),
    }));
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'KPI-Snapshots konnten nicht laden');
  }
}
