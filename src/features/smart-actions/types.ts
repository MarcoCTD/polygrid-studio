/**
 * Smart Actions (Modul 15): regelbasierte, klickbare Hinweis-Karten.
 * Jede Regel erkennt einen Zustand in den Daten und bietet die logische
 * Folgeaktion an (Navigation zur vorgefilterten Zielansicht).
 */

export type SmartActionSeverity = 'info' | 'warning' | 'danger';

export type SmartActionCategory =
  | 'orders'
  | 'products'
  | 'listings'
  | 'expenses'
  | 'tasks'
  | 'websites'
  | 'system';

/** Ergebnis einer Regel-Auswertung. null = nichts zu tun, Karte bleibt still. */
export interface SmartActionResult {
  count: number;
  message: string;
  severity: SmartActionSeverity;
  /** Zielroute, z.B. '/orders' oder '/products/$productId' */
  targetRoute: string;
  /** Vorgesetzte Filter als Search-Params der Zielroute */
  targetSearchParams?: Record<string, string>;
  /** Pfad-Parameter der Zielroute, z.B. { productId: '...' } */
  targetParams?: Record<string, string>;
  /** Reserviert: ID eines Dialogs, der statt einer Navigation geöffnet wird */
  targetDialog?: string;
}

export interface SmartActionRule {
  id: string;
  category: SmartActionCategory;
  evaluate: () => Promise<SmartActionResult | null>;
}

/** Aktive Smart Action (ausgewertete Regel), wie sie das Dashboard anzeigt. */
export interface SmartAction extends SmartActionResult {
  ruleId: string;
  category: SmartActionCategory;
}

export const SEVERITY_RANK: Record<SmartActionSeverity, number> = {
  danger: 0,
  warning: 1,
  info: 2,
};
