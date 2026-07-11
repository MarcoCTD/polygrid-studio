/**
 * Zentrale Registry aller Standard-Platzhaltervariablen der Vorlagenbibliothek.
 *
 * Jede Variable hat Label + Beschreibung fuer Editor-Seitenleiste und
 * Kopieren-Dialog. Die optionale Datenquelle steuert, wie der Wert im
 * Kopieren-Dialog befuellt wird:
 * - setting: automatisch aus app_settings vorbefuellt
 * - today:   automatisch mit dem heutigen Datum vorbefuellt
 * - product: ueber eine Produktauswahl (Dropdown mit Suche) befuellbar
 * - order:   ueber eine Auftragsauswahl (Dropdown mit Suche) befuellbar
 * Variablen ohne Datenquelle bleiben Freitext.
 */
import type { SettingKey } from '@/services/settings';

export type OrderVariableField = 'order_number' | 'customer_name' | 'tracking_number' | 'platform';

export type StandardVariableSource =
  | { type: 'setting'; settingKey: SettingKey }
  | { type: 'today' }
  | { type: 'product'; field: 'name' }
  | { type: 'order'; field: OrderVariableField };

export interface StandardVariable {
  name: string;
  label: string;
  description: string;
  source?: StandardVariableSource;
}

export const STANDARD_VARIABLES: StandardVariable[] = [
  {
    name: 'firmenname',
    label: 'Firmenname',
    description: 'Firmen-/Shopname aus den Einstellungen (automatisch vorbefüllt)',
    source: { type: 'setting', settingKey: 'company_name' },
  },
  {
    name: 'datum',
    label: 'Datum',
    description: 'Heutiges Datum (automatisch vorbefüllt)',
    source: { type: 'today' },
  },
  {
    name: 'produktname',
    label: 'Produktname',
    description: 'Name des Produkts – über die Produktauswahl befüllbar',
    source: { type: 'product', field: 'name' },
  },
  {
    name: 'bestellnummer',
    label: 'Bestellnummer',
    description: 'Bestellnummer des Auftrags – über die Auftragsauswahl befüllbar',
    source: { type: 'order', field: 'order_number' },
  },
  {
    name: 'kundenname',
    label: 'Kundenname',
    description: 'Name des Kunden – über die Auftragsauswahl befüllbar',
    source: { type: 'order', field: 'customer_name' },
  },
  {
    name: 'trackingnummer',
    label: 'Trackingnummer',
    description: 'Sendungsverfolgungsnummer – über die Auftragsauswahl befüllbar',
    source: { type: 'order', field: 'tracking_number' },
  },
  {
    name: 'plattform',
    label: 'Plattform',
    description: 'Verkaufsplattform des Auftrags – über die Auftragsauswahl befüllbar',
    source: { type: 'order', field: 'platform' },
  },
  {
    name: 'projektname',
    label: 'Projektname',
    description: 'Name des Website-Projekts (in Dokumenten automatisch befüllt)',
  },
  {
    name: 'zahlungsziel_tage',
    label: 'Zahlungsziel (Tage)',
    description: 'Zahlungsziel in Tagen aus den Rechnungsstellungs-Einstellungen',
    source: { type: 'setting', settingKey: 'invoice_payment_terms_days' },
  },
  {
    name: 'iban',
    label: 'IBAN',
    description: 'IBAN aus den Rechnungsstellungs-Einstellungen',
    source: { type: 'setting', settingKey: 'invoice_iban' },
  },
  {
    name: 'bic',
    label: 'BIC',
    description: 'BIC aus den Rechnungsstellungs-Einstellungen',
    source: { type: 'setting', settingKey: 'invoice_bic' },
  },
  {
    name: 'kontoinhaber',
    label: 'Kontoinhaber',
    description: 'Inhabername aus den Rechnungsstellungs-Einstellungen',
    source: { type: 'setting', settingKey: 'invoice_owner_name' },
  },
  {
    name: 'gueltig_bis',
    label: 'Gültig bis',
    description: 'Gültig-bis-Datum des Angebots (in Dokumenten automatisch befüllt)',
  },
  {
    name: 'lieferzeit',
    label: 'Lieferzeit',
    description: 'Voraussichtliche Lieferzeit, z.B. „3–5 Werktage“',
  },
  {
    name: 'versanddienstleister',
    label: 'Versanddienstleister',
    description: 'z.B. DHL, Hermes, DPD',
  },
];

export function findStandardVariable(name: string): StandardVariable | undefined {
  const normalized = name.trim().toLowerCase();
  return STANDARD_VARIABLES.find((variable) => variable.name === normalized);
}

/** Auftragszeile, wie sie der Kopieren-Dialog aus der DB laedt. */
export interface OrderPickerRow {
  id: string;
  receipt_number: string | null;
  external_order_id: string | null;
  customer_name: string | null;
  tracking_number: string | null;
  platform: string | null;
}

const PLATFORM_LABELS: Record<string, string> = {
  etsy: 'Etsy',
  ebay: 'eBay',
  kleinanzeigen: 'Kleinanzeigen',
  direkt: 'Direktverkauf',
};

export function orderVariableValue(order: OrderPickerRow, field: OrderVariableField): string {
  switch (field) {
    case 'order_number':
      return order.external_order_id?.trim() || order.receipt_number || '';
    case 'customer_name':
      return order.customer_name ?? '';
    case 'tracking_number':
      return order.tracking_number ?? '';
    case 'platform':
      return order.platform ? (PLATFORM_LABELS[order.platform] ?? order.platform) : '';
  }
}
