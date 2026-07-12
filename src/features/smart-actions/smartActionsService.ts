/**
 * Auswertung der Smart Actions (Modul 15).
 *
 * - Evaluierung beim Dashboard-Mount, danach höchstens alle 5 Minuten (Cache)
 * - Eine fehlerhafte Regel blockiert nie die übrigen Regeln
 * - Maximal 5 Karten, sortiert nach Severity (danger > warning > info),
 *   dann nach Count absteigend
 */
import { WEBSITE_SMART_ACTION_RULES } from '@/features/websites/smartActionRules';
import { DOCUMENT_SMART_ACTION_RULES } from '@/features/documents/smartActionRules';
import { ORDER_SMART_ACTION_RULES } from '@/features/orders/smartActionRules';
import { getRegisteredSmartActionRules, registerSmartActionRules } from './registry';
import { SMART_ACTION_RULES } from './rules';
import { getSnoozes, isSnoozed, snoozeSmartAction } from './snoozeService';
import { CACHE_TTL_MINUTES } from './thresholds';
import { SEVERITY_RANK, type SmartAction } from './types';

// Start-Regeln beim Laden des Moduls registrieren (idempotent)
registerSmartActionRules(SMART_ACTION_RULES);
// Website-Regeln (Modul 16) über denselben Registry-Mechanismus
registerSmartActionRules(WEBSITE_SMART_ACTION_RULES);
// Dokumente-Regel invoice_overdue (Modul 17)
registerSmartActionRules(DOCUMENT_SMART_ACTION_RULES);
// Auftrags-Regel order_invoice_mismatch (Modul 08 Status/Payment-Trennung)
registerSmartActionRules(ORDER_SMART_ACTION_RULES);

export const MAX_SMART_ACTIONS = 5;

interface SmartActionsCache {
  evaluatedAt: number;
  actions: SmartAction[];
}

let cache: SmartActionsCache | null = null;

export function invalidateSmartActionsCache(): void {
  cache = null;
}

function sortActions(actions: SmartAction[]): SmartAction[] {
  return [...actions].sort((a, b) => {
    const severityDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return b.count - a.count;
  });
}

/**
 * Wertet alle registrierten Regeln aus (oder liefert den Cache) und
 * filtert gesnoozte Karten heraus.
 */
export async function getSmartActions(options?: { force?: boolean }): Promise<SmartAction[]> {
  const now = Date.now();
  if (!options?.force && cache && now - cache.evaluatedAt < CACHE_TTL_MINUTES * 60_000) {
    return cache.actions;
  }

  const snoozes = await getSnoozes();
  const actions: SmartAction[] = [];

  for (const rule of getRegisteredSmartActionRules()) {
    try {
      const result = await rule.evaluate();
      if (!result || result.count <= 0) continue;
      if (isSnoozed(snoozes[rule.id], result.count)) continue;
      actions.push({ ...result, ruleId: rule.id, category: rule.category });
    } catch (error) {
      // Einzelne Regel-Fehler nur loggen – die restlichen Karten bleiben nutzbar
      console.error(`Smart-Action-Regel "${rule.id}" konnte nicht ausgewertet werden:`, error);
    }
  }

  const limited = sortActions(actions).slice(0, MAX_SMART_ACTIONS);
  cache = { evaluatedAt: now, actions: limited };
  return limited;
}

/** Verwirft eine Karte (Snooze 7 Tage) und entfernt sie sofort aus dem Cache. */
export async function dismissSmartAction(action: SmartAction): Promise<void> {
  await snoozeSmartAction(action.ruleId, action.count);
  if (cache) {
    cache = {
      ...cache,
      actions: cache.actions.filter((item) => item.ruleId !== action.ruleId),
    };
  }
}
