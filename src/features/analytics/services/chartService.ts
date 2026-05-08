import { getDatabase } from '@/services/database';
import type {
  AnalyticsKPIs,
  ExpensesByCategoryDatum,
  ListingStatusDatum,
  MarginByProductDatum,
  RevenueByPlatformDatum,
  TopProductByRevenue,
} from '../types';

interface RevenueRow {
  platform: string;
  month: string;
  revenue: number | string | null;
}

interface ExpenseCategoryRow {
  category: string;
  amount: number | string | null;
}

interface MarginRow {
  id: string;
  name: string;
  estimated_margin: number | string | null;
}

interface StatusRow {
  status: string;
  count: number | string;
}

interface AnalyticsKpiRow {
  revenue_total: number | string | null;
  expenses_total: number | string | null;
  average_margin: number | string | null;
}

interface DateRow {
  date: string | null;
}

interface TopProductRow {
  id: string;
  name: string;
  revenue: number | string | null;
}

function numberValue(value: number | string | null | undefined): number {
  return Number(value ?? 0) || 0;
}

export async function getRevenueByPlatform(
  startDate: string,
  endDate: string,
): Promise<RevenueByPlatformDatum[]> {
  try {
    const rows = await getDatabase().select<RevenueRow[]>(
      `SELECT platform, strftime('%Y-%m', order_date) AS month, SUM(sale_price) AS revenue
       FROM orders
       WHERE status = 'completed'
         AND order_date >= ?
         AND order_date <= ?
         AND deleted_at IS NULL
       GROUP BY platform, month
       ORDER BY month ASC, platform ASC`,
      [startDate, endDate],
    );

    return rows.map((row) => ({
      platform: row.platform,
      month: row.month,
      revenue: numberValue(row.revenue),
    }));
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Umsatzdaten konnten nicht laden');
  }
}

export async function getExpensesByCategory(
  startDate: string,
  endDate: string,
): Promise<ExpensesByCategoryDatum[]> {
  try {
    const rows = await getDatabase().select<ExpenseCategoryRow[]>(
      `SELECT category, SUM(amount_gross) AS amount
       FROM expenses
       WHERE date >= ?
         AND date <= ?
         AND deleted_at IS NULL
       GROUP BY category
       ORDER BY amount DESC`,
      [startDate, endDate],
    );
    const items = rows.map((row) => ({
      category: row.category,
      amount: numberValue(row.amount),
    }));
    const topItems = items.slice(0, 5);
    const otherAmount = items.slice(5).reduce((sum, item) => sum + item.amount, 0);

    return otherAmount > 0
      ? [...topItems, { category: 'Sonstiges', amount: otherAmount }]
      : topItems;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Ausgabendaten konnten nicht laden');
  }
}

export async function getMarginByProduct(): Promise<MarginByProductDatum[]> {
  try {
    const rows = await getDatabase().select<MarginRow[]>(
      `SELECT id, name, estimated_margin
       FROM products
       WHERE status = 'online'
         AND estimated_margin IS NOT NULL
         AND deleted_at IS NULL
       ORDER BY estimated_margin ASC
       LIMIT 10`,
    );

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      estimated_margin: numberValue(row.estimated_margin),
    }));
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Margendaten konnten nicht laden');
  }
}

export async function getListingStatusDistribution(): Promise<ListingStatusDatum[]> {
  try {
    const rows = await getDatabase().select<StatusRow[]>(
      `SELECT status, COUNT(*) AS count
       FROM listings
       WHERE deleted_at IS NULL
       GROUP BY status
       ORDER BY status ASC`,
    );

    return rows.map((row) => ({
      status: row.status,
      count: numberValue(row.count),
    }));
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Listing-Status konnten nicht laden');
  }
}

export async function getAnalyticsKPIs(startDate: string, endDate: string): Promise<AnalyticsKPIs> {
  try {
    const rows = await getDatabase().select<AnalyticsKpiRow[]>(
      `SELECT
         (SELECT SUM(sale_price)
          FROM orders
          WHERE status = 'completed'
            AND order_date >= ?
            AND order_date <= ?
            AND deleted_at IS NULL) AS revenue_total,
         (SELECT SUM(amount_gross)
          FROM expenses
          WHERE date >= ?
            AND date <= ?
            AND deleted_at IS NULL) AS expenses_total,
         (SELECT AVG(estimated_margin)
          FROM products
          WHERE status = 'online'
            AND estimated_margin IS NOT NULL
            AND deleted_at IS NULL) AS average_margin`,
      [startDate, endDate, startDate, endDate],
    );
    const row = rows[0];

    return {
      revenueTotal: numberValue(row?.revenue_total),
      expensesTotal: numberValue(row?.expenses_total),
      averageMargin:
        row?.average_margin === null || row?.average_margin === undefined
          ? null
          : numberValue(row.average_margin),
    };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Analyse-KPIs konnten nicht laden');
  }
}

export async function getEarliestAnalyticsDate(): Promise<string | null> {
  try {
    const rows = await getDatabase().select<DateRow[]>(
      `SELECT MIN(date_value) AS date
       FROM (
         SELECT MIN(order_date) AS date_value FROM orders WHERE deleted_at IS NULL
         UNION ALL
         SELECT MIN(date) AS date_value FROM expenses WHERE deleted_at IS NULL
       )
       WHERE date_value IS NOT NULL`,
    );

    return rows[0]?.date ?? null;
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Frühester Analysezeitraum konnte nicht laden',
    );
  }
}

export async function getTopProductsByRevenue(
  startDate: string,
  endDate: string,
): Promise<TopProductByRevenue[]> {
  try {
    const rows = await getDatabase().select<TopProductRow[]>(
      `SELECT
         COALESCE(p.id, o.id) AS id,
         COALESCE(p.name, o.receipt_number) AS name,
         SUM(o.sale_price) AS revenue
       FROM orders o
       LEFT JOIN products p ON p.id = o.product_id
       WHERE o.status = 'completed'
         AND o.order_date >= ?
         AND o.order_date <= ?
         AND o.deleted_at IS NULL
       GROUP BY p.id, name
       ORDER BY revenue DESC
       LIMIT 3`,
      [startDate, endDate],
    );

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      revenue: numberValue(row.revenue),
    }));
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Top-Produkte nach Umsatz konnten nicht laden',
    );
  }
}
