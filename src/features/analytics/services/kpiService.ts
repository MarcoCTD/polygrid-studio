import { getDatabase } from '@/services/database';
import type { DashboardKPIs } from '../types';

const OPEN_ORDER_STATUSES = ['ordered', 'confirmed', 'in_production', 'ready'] as const;
const OPEN_TASK_STATUSES = ['todo', 'in_progress'] as const;

interface SumRow {
  total: number | string | null;
}

interface CountRow {
  count: number | string;
}

interface DateRow {
  date: string | null;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function monthStart(year: number, monthIndex: number): Date {
  return new Date(Date.UTC(year, monthIndex, 1));
}

function currentMonthRange(now = new Date()): { start: string; end: string } {
  return {
    start: toDateKey(monthStart(now.getFullYear(), now.getMonth())),
    end: toDateKey(monthStart(now.getFullYear(), now.getMonth() + 1)),
  };
}

function previousMonthRange(now = new Date()): { start: string; end: string } {
  return {
    start: toDateKey(monthStart(now.getFullYear(), now.getMonth() - 1)),
    end: toDateKey(monthStart(now.getFullYear(), now.getMonth())),
  };
}

function calculateChangePercent(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

function numberValue(value: number | string | null | undefined): number {
  return Number(value ?? 0) || 0;
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

async function sumInRange(
  table: 'orders' | 'expenses',
  column: string,
  range: { start: string; end: string },
) {
  const db = getDatabase();
  const dateColumn = table === 'orders' ? 'order_date' : 'date';
  const statusClause = table === 'orders' ? "status = 'completed' AND" : '';
  const rows = await db.select<SumRow[]>(
    `SELECT SUM(${column}) AS total
     FROM ${table}
     WHERE ${statusClause} ${dateColumn} >= ? AND ${dateColumn} < ? AND deleted_at IS NULL`,
    [range.start, range.end],
  );
  return numberValue(rows[0]?.total);
}

async function countByStatuses(
  table: 'orders' | 'tasks',
  statuses: readonly string[],
): Promise<number> {
  const db = getDatabase();
  const rows = await db.select<CountRow[]>(
    `SELECT COUNT(*) AS count
     FROM ${table}
     WHERE status IN (${placeholders(statuses.length)}) AND deleted_at IS NULL`,
    [...statuses],
  );
  return numberValue(rows[0]?.count);
}

async function minDateByStatuses(
  table: 'orders' | 'tasks',
  dateColumn: 'order_date' | 'due_date',
  statuses: readonly string[],
  requireDate = false,
): Promise<string | null> {
  const db = getDatabase();
  const rows = await db.select<DateRow[]>(
    `SELECT MIN(${dateColumn}) AS date
     FROM ${table}
     WHERE status IN (${placeholders(statuses.length)})
       ${requireDate ? `AND ${dateColumn} IS NOT NULL` : ''}
       AND deleted_at IS NULL`,
    [...statuses],
  );
  return rows[0]?.date ?? null;
}

export async function getDashboardKPIs(): Promise<DashboardKPIs> {
  try {
    const currentRange = currentMonthRange();
    const previousRange = previousMonthRange();

    const [
      revenueCurrentMonth,
      revenuePreviousMonth,
      expensesCurrentMonth,
      expensesPreviousMonth,
      openOrdersCount,
      oldestOpenOrderDate,
      openTasksCount,
      nextTaskDueDate,
    ] = await Promise.all([
      sumInRange('orders', 'sale_price', currentRange),
      sumInRange('orders', 'sale_price', previousRange),
      sumInRange('expenses', 'amount_gross', currentRange),
      sumInRange('expenses', 'amount_gross', previousRange),
      countByStatuses('orders', OPEN_ORDER_STATUSES),
      minDateByStatuses('orders', 'order_date', OPEN_ORDER_STATUSES),
      countByStatuses('tasks', OPEN_TASK_STATUSES),
      minDateByStatuses('tasks', 'due_date', OPEN_TASK_STATUSES, true),
    ]);

    return {
      revenueCurrentMonth,
      revenuePreviousMonth,
      revenueChangePercent: calculateChangePercent(revenueCurrentMonth, revenuePreviousMonth),
      expensesCurrentMonth,
      expensesPreviousMonth,
      expensesChangePercent: calculateChangePercent(expensesCurrentMonth, expensesPreviousMonth),
      openOrdersCount,
      oldestOpenOrderDate,
      openTasksCount,
      nextTaskDueDate,
    };
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Dashboard-KPIs konnten nicht geladen werden',
    );
  }
}
