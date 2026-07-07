import { describe, expect, it } from 'vitest';
import { isSnoozed, type SnoozeEntry } from './snoozeService';

const NOW = new Date('2026-07-07T12:00:00.000Z');

function entry(overrides: Partial<SnoozeEntry> = {}): SnoozeEntry {
  return { until: '2026-07-14T12:00:00.000Z', count: 3, ...overrides };
}

describe('isSnoozed', () => {
  it('blendet eine aktive Snooze mit unverändertem Count aus', () => {
    expect(isSnoozed(entry(), 3, NOW)).toBe(true);
  });

  it('blendet auch bei gesunkenem Count aus', () => {
    expect(isSnoozed(entry(), 2, NOW)).toBe(true);
  });

  it('holt die Karte bei gestiegenem Count zurück (Verschärfung)', () => {
    expect(isSnoozed(entry(), 4, NOW)).toBe(false);
  });

  it('holt die Karte nach Ablauf der 7 Tage zurück', () => {
    expect(isSnoozed(entry({ until: '2026-07-07T11:59:59.000Z' }), 3, NOW)).toBe(false);
  });

  it('zeigt Karten ohne Snooze-Eintrag immer an', () => {
    expect(isSnoozed(undefined, 1, NOW)).toBe(false);
  });
});
