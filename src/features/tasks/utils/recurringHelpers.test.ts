import { describe, expect, it, vi } from 'vitest';
import { calculateNextDueDate } from './recurringHelpers';

describe('calculateNextDueDate', () => {
  it('clamps monthly tasks from day 31 to a 30-day month', () => {
    expect(calculateNextDueDate('2026-05-31', { interval: 'monthly' })).toBe('2026-06-30');
  });

  it('clamps monthly tasks from day 31 to February 28 in a non-leap year', () => {
    expect(calculateNextDueDate('2026-01-31', { interval: 'monthly' })).toBe('2026-02-28');
  });

  it('keeps February 29 in a leap year when requested', () => {
    expect(calculateNextDueDate('2028-01-31', { interval: 'monthly', day: 29 })).toBe('2028-02-29');
  });

  it('uses today as base date when a recurring task has no due date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-07T10:00:00.000Z'));

    expect(calculateNextDueDate(null, { interval: 'daily' })).toBe('2026-05-08');

    vi.useRealTimers();
  });

  it('uses the configured weekday for weekly tasks', () => {
    expect(calculateNextDueDate('2026-05-07', { interval: 'weekly', day: 1 })).toBe('2026-05-11');
  });
});
