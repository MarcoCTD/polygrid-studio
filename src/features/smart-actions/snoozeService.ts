/**
 * Snooze-Mechanik für Smart Actions (Modul 15).
 *
 * Verworfene Karten werden 7 Tage ausgeblendet. Persistiert wird ein
 * JSON-Objekt in app_settings unter dem Key 'smart_action_snoozes':
 *   { "<ruleId>": { "until": "<ISO>", "count": <Zahl beim Verwerfen> } }
 *
 * Eine Karte kehrt zurück, wenn der Snooze abgelaufen ist ODER sich der
 * Zustand verschärft hat (aktueller Count > Count beim Verwerfen).
 */
import { getSettingWithDefault, saveSetting } from '@/services/settings';
import { SNOOZE_DAYS } from './thresholds';

export const SNOOZE_SETTING_KEY = 'smart_action_snoozes';

export interface SnoozeEntry {
  until: string;
  count: number;
}

export type SnoozeMap = Record<string, SnoozeEntry>;

function isValidEntry(value: unknown): value is SnoozeEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as SnoozeEntry).until === 'string' &&
    typeof (value as SnoozeEntry).count === 'number'
  );
}

export async function getSnoozes(): Promise<SnoozeMap> {
  try {
    const raw = await getSettingWithDefault<Record<string, unknown>>(SNOOZE_SETTING_KEY, {});
    const result: SnoozeMap = {};
    for (const [ruleId, entry] of Object.entries(raw ?? {})) {
      if (isValidEntry(entry)) {
        result[ruleId] = entry;
      }
    }
    return result;
  } catch {
    // Defekte oder fehlende Snooze-Daten dürfen die Auswertung nie blockieren
    return {};
  }
}

/** Snoozt eine Regel für SNOOZE_DAYS Tage und merkt sich den aktuellen Count. */
export async function snoozeSmartAction(ruleId: string, count: number, now = new Date()): Promise<void> {
  try {
    const snoozes = await getSnoozes();
    const until = new Date(now);
    until.setDate(until.getDate() + SNOOZE_DAYS);

    const next = pruneExpired({ ...snoozes, [ruleId]: { until: until.toISOString(), count } }, now);
    await saveSetting(SNOOZE_SETTING_KEY, next);
  } catch (error) {
    throw new Error(
      `Smart Action konnte nicht verworfen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** true, wenn die Regel aktuell ausgeblendet werden soll. */
export function isSnoozed(
  entry: SnoozeEntry | undefined,
  currentCount: number,
  now = new Date(),
): boolean {
  if (!entry) return false;
  if (now.toISOString() >= entry.until) return false; // abgelaufen
  if (currentCount > entry.count) return false; // Zustand hat sich verschärft
  return true;
}

/** Entfernt abgelaufene Einträge, damit der Settings-Wert nicht wächst. */
function pruneExpired(snoozes: SnoozeMap, now: Date): SnoozeMap {
  const nowIso = now.toISOString();
  const result: SnoozeMap = {};
  for (const [ruleId, entry] of Object.entries(snoozes)) {
    if (entry.until > nowIso) {
      result[ruleId] = entry;
    }
  }
  return result;
}
