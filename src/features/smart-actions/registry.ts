/**
 * Smart-Action-Registry (Modul 15).
 *
 * Gleiches Muster wie die Command Registry aus Foundation: Regeln werden
 * zentral registriert, andere Module können später eigene Regeln über
 * registerSmartActionRules() ergänzen, ohne diese Datei zu ändern.
 */
import type { SmartActionRule } from './types';

const rules = new Map<string, SmartActionRule>();

/** Registriert Regeln; bereits registrierte IDs werden nicht überschrieben. */
export function registerSmartActionRules(newRules: SmartActionRule[]): void {
  for (const rule of newRules) {
    if (!rules.has(rule.id)) {
      rules.set(rule.id, rule);
    }
  }
}

export function unregisterSmartActionRules(ids: string[]): void {
  for (const id of ids) {
    rules.delete(id);
  }
}

export function getRegisteredSmartActionRules(): SmartActionRule[] {
  return Array.from(rules.values());
}
