import type { TaskStatus } from '../schemas';

function atLocalMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseISODate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function getWeekStart(date: Date): Date {
  const normalized = atLocalMidnight(date);
  const day = normalized.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  normalized.setDate(normalized.getDate() + diffToMonday);
  return normalized;
}

export function getWeekNumber(date: Date): number {
  const target = atLocalMidnight(date);
  target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7));
  const diff = target.getTime() - firstThursday.getTime();
  return 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
}

export function addWeeks(date: Date, n: number): Date {
  const next = atLocalMidnight(date);
  next.setDate(next.getDate() + n * 7);
  return next;
}

export function getWeekDates(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = atLocalMidnight(weekStart);
    date.setDate(date.getDate() + index);
    return date;
  });
}

export function isToday(date: Date): boolean {
  return formatISODate(date) === formatISODate(new Date());
}

export function isOverdue(dueDate: string | null, status: TaskStatus): boolean {
  if (!dueDate || (status !== 'todo' && status !== 'in_progress')) return false;
  return dueDate < formatISODate(new Date());
}
