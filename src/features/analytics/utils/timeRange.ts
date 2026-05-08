import type { TimeRange, TimeRangePreset } from '../types';

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function monthStart(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), 1));
}

function addMonths(date: Date, amount: number): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth() + amount, date.getDate()));
}

export function resolveTimeRange(
  preset: TimeRangePreset,
  allTimeStartDate: string | null,
  now = new Date(),
): TimeRange {
  const today = dateKey(now);
  const currentMonthStart = monthStart(now);

  if (preset === 'last_month') {
    const start = addMonths(currentMonthStart, -1);
    const end = new Date(currentMonthStart.getTime() - 86_400_000);
    return { preset, startDate: dateKey(start), endDate: dateKey(end) };
  }

  if (preset === 'last_3_months') {
    return { preset, startDate: dateKey(addMonths(now, -3)), endDate: today };
  }

  if (preset === 'last_6_months') {
    return { preset, startDate: dateKey(addMonths(now, -6)), endDate: today };
  }

  if (preset === 'current_year') {
    return { preset, startDate: `${now.getFullYear()}-01-01`, endDate: today };
  }

  if (preset === 'all_time') {
    return { preset, startDate: allTimeStartDate ?? dateKey(currentMonthStart), endDate: today };
  }

  return { preset, startDate: dateKey(currentMonthStart), endDate: today };
}
