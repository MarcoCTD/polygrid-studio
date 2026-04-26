import type { ExpenseFilter } from '../schemas';

export type ExpensePeriod = 'current_month' | 'previous_month' | 'current_year' | 'custom';

export function formatEUR(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '-';
  }

  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

export function formatDateDE(value: string): string {
  return new Date(value).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function monthInputValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function parseMonthValue(value: string): { year: number; month: number } {
  const [year, month] = value.split('-').map(Number);
  return { year, month };
}

export function formatMonthLabel(value: string): string {
  const { year, month } = parseMonthValue(value);
  return new Date(year, month - 1, 1).toLocaleDateString('de-DE', {
    month: 'long',
    year: 'numeric',
  });
}

export function monthOptions(count = 18): { value: string; label: string }[] {
  const start = new Date();

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth() - index, 1);
    const value = monthInputValue(date);
    return {
      value,
      label: formatMonthLabel(value),
    };
  });
}

export function previousMonthValue(value: string): string {
  const { year, month } = parseMonthValue(value);
  const date = new Date(year, month - 2, 1);
  return monthInputValue(date);
}

export function getPeriodDateRange(
  period: ExpensePeriod,
  customFrom: string,
  customTo: string,
): Pick<ExpenseFilter, 'date_from' | 'date_to'> {
  const now = new Date();

  if (period === 'current_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      date_from: monthInputValue(start) + '-01',
      date_to: end.toISOString().slice(0, 10),
    };
  }

  if (period === 'previous_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return {
      date_from: monthInputValue(start) + '-01',
      date_to: end.toISOString().slice(0, 10),
    };
  }

  if (period === 'current_year') {
    return {
      date_from: `${now.getFullYear()}-01-01`,
      date_to: `${now.getFullYear()}-12-31`,
    };
  }

  return {
    date_from: customFrom || undefined,
    date_to: customTo || undefined,
  };
}

export function calculatePercentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }

  return ((current - previous) / previous) * 100;
}

export { buildExpenseCsvFilename, exportExpensesAsCsv } from './exportUtils';
