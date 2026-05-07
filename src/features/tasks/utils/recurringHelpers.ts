import type { RecurringRule } from '../schemas';

function parseISODate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function addMonthsClamped(date: Date, months: number, preferredDay?: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const requestedDay = preferredDay ?? date.getUTCDate();
  const targetDay = Math.min(requestedDay, daysInMonth(targetYear, targetMonth));

  return new Date(Date.UTC(targetYear, targetMonth, targetDay));
}

function nextWeeklyDate(date: Date, weekday?: number): Date {
  if (weekday === undefined) {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + 7);
    return next;
  }

  const currentWeekday = date.getUTCDay();
  const normalizedWeekday = Math.min(Math.max(weekday, 0), 6);
  const diff = (normalizedWeekday - currentWeekday + 7) % 7 || 7;
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + diff);
  return next;
}

export function calculateNextDueDate(currentDueDate: string | null, rule: RecurringRule): string {
  const base = currentDueDate
    ? parseISODate(currentDueDate)
    : parseISODate(formatISODate(new Date()));

  if (rule.interval === 'daily') {
    const next = new Date(base);
    next.setUTCDate(next.getUTCDate() + 1);
    return formatISODate(next);
  }

  if (rule.interval === 'weekly') {
    return formatISODate(nextWeeklyDate(base, rule.day));
  }

  const preferredDay = rule.day === undefined ? undefined : Math.min(Math.max(rule.day, 1), 31);
  return formatISODate(addMonthsClamped(base, 1, preferredDay));
}
