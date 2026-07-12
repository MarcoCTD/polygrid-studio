import { save } from '@tauri-apps/plugin-dialog';
import { getDatabase } from '@/services/database';
import {
  getOneDriveBasePath,
  writeExportFileToBase,
  writeExportFileToPath,
} from '@/services/filesystem';
import { DEFAULTS, getSettingWithDefault } from '@/services/settings';
import {
  buildEuerYearReport,
  euerExportFilename,
  kleinunternehmerStatus,
  type EuerExpenseInput,
  type EuerOrderInput,
  type EuerYearReport,
  type KleinunternehmerStatus,
} from './euerYear';
import { buildEuerYearWorkbook } from './euerYearWorkbook';

/**
 * DB-Anbindung und Export-Orchestrierung für den EÜR-Jahresexport (Modul 14).
 * Die fachliche Aggregation liegt in euerYear.ts (rein, unit-getestet).
 */

export const EUER_EXPORT_DIRECTORY = '01_Finanzen/Exporte';

export type EuerExportTarget = 'dialog' | 'onedrive';

export interface EuerExportOutcome {
  cancelled: boolean;
  path: string | null;
  filename: string;
}

type Row = Record<string, unknown>;

function dbBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'TRUE';
}

function dbNumber(value: unknown): number {
  return Number(value ?? 0) || 0;
}

function dbText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

function rowToOrderInput(row: Row): EuerOrderInput {
  return {
    id: String(row.id),
    receipt_number: String(row.receipt_number),
    external_order_id: dbText(row.external_order_id),
    platform: String(row.platform),
    product_name: dbText(row.product_name),
    variant: dbText(row.variant),
    quantity: dbNumber(row.quantity) || 1,
    sale_price: dbNumber(row.sale_price),
    shipping_revenue: row.shipping_revenue === null ? null : dbNumber(row.shipping_revenue),
    status: String(row.status),
    payment_status: String(row.payment_status),
    payment_received_date: dbText(row.payment_received_date),
    paid_event_date: dbText(row.paid_event_date),
    order_date: String(row.order_date),
    deleted_at: dbText(row.deleted_at),
  };
}

function rowToExpenseInput(row: Row): EuerExpenseInput {
  return {
    id: String(row.id),
    date: String(row.date),
    amount_gross: dbNumber(row.amount_gross),
    vendor: String(row.vendor),
    category: String(row.category),
    subcategory: dbText(row.subcategory),
    purpose: dbText(row.purpose),
    receipt_attached: dbBoolean(row.receipt_attached),
    tax_relevant: dbBoolean(row.tax_relevant),
    deleted_at: dbText(row.deleted_at),
  };
}

async function loadOrderInputs(): Promise<EuerOrderInput[]> {
  const rows = await getDatabase().select<Row[]>(
    `SELECT o.id, o.receipt_number, o.external_order_id, o.platform, o.variant, o.quantity,
            o.sale_price, o.shipping_revenue, o.status, o.payment_status,
            o.payment_received_date, o.order_date, o.deleted_at,
            p.name AS product_name,
            -- Fallback-Zuflussdatum aus der Timeline. 'paid' ist hier ein
            -- historischer Audit-Wert aus order_events (vor der Status/Payment-
            -- Trennung, Modul 08); neue Aufträge erreichen stattdessen 'completed'.
            -- Beide bleiben als Zahlungs-/Abschluss-Signal gültig.
            (SELECT MIN(ev.created_at)
             FROM order_events ev
             WHERE ev.order_id = o.id
               AND ev.event_type = 'status_change'
               AND ev.to_value IN ('paid', 'completed')) AS paid_event_date
     FROM orders o
     LEFT JOIN products p ON p.id = o.product_id
     WHERE o.deleted_at IS NULL
       AND o.status IN ('completed', 'shipped')`,
  );
  return rows.map(rowToOrderInput);
}

async function loadExpenseInputs(): Promise<EuerExpenseInput[]> {
  const rows = await getDatabase().select<Row[]>(
    `SELECT id, date, amount_gross, vendor, category, subcategory, purpose,
            receipt_attached, tax_relevant, deleted_at
     FROM expenses
     WHERE deleted_at IS NULL OR deleted_at = ''`,
  );
  return rows.map(rowToExpenseInput).map((expense) => ({
    ...expense,
    // sql.js/SQLite liefert '' statt NULL in Altdaten
    deleted_at: expense.deleted_at ? expense.deleted_at : null,
  }));
}

/** Alle Jahre mit Daten (Einnahmen nach Zufluss-Logik, Ausgaben nach Datum), absteigend. */
export async function getEuerYearsWithData(): Promise<number[]> {
  try {
    const [orders, expenses] = await Promise.all([loadOrderInputs(), loadExpenseInputs()]);
    const years = new Set<number>();
    years.add(new Date().getFullYear());

    for (const order of orders) {
      const candidate = order.payment_received_date ?? order.paid_event_date ?? order.order_date;
      const year = Number.parseInt(String(candidate).slice(0, 4), 10);
      if (Number.isFinite(year) && year > 2000) years.add(year);
    }
    for (const expense of expenses) {
      const year = Number.parseInt(expense.date.slice(0, 4), 10);
      if (Number.isFinite(year) && year > 2000) years.add(year);
    }

    return [...years].sort((a, b) => b - a);
  } catch (error) {
    throw new Error(
      `Jahre für den EÜR-Export konnten nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function getEuerYearReport(year: number): Promise<EuerYearReport> {
  try {
    const [orders, expenses] = await Promise.all([loadOrderInputs(), loadExpenseInputs()]);
    return buildEuerYearReport(year, orders, expenses);
  } catch (error) {
    throw new Error(
      `EÜR-Auswertung konnte nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** Laufender Jahresumsatz (Einnahmen-Definition Spec 2.1) für das Grenzen-Widget. */
export async function getKleinunternehmerStatusCurrentYear(): Promise<KleinunternehmerStatus> {
  try {
    const report = await getEuerYearReport(new Date().getFullYear());
    return kleinunternehmerStatus(report.incomeTotal);
  } catch (error) {
    throw new Error(
      `Kleinunternehmergrenze konnte nicht berechnet werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function isOneDriveExportAvailable(): Promise<boolean> {
  try {
    return (await getOneDriveBasePath()) !== null;
  } catch {
    return false;
  }
}

export async function exportEuerYear(
  year: number,
  target: EuerExportTarget,
): Promise<EuerExportOutcome> {
  try {
    const [report, companyName] = await Promise.all([
      getEuerYearReport(year),
      getSettingWithDefault('company_name', DEFAULTS.company_name),
    ]);
    const filename = euerExportFilename(year, String(companyName));
    const buffer = await buildEuerYearWorkbook(report, { companyName: String(companyName) });

    if (target === 'dialog') {
      const chosenPath = await save({
        defaultPath: filename,
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      });
      if (!chosenPath) {
        return { cancelled: true, path: null, filename };
      }
      const path = await writeExportFileToPath(chosenPath, buffer);
      return { cancelled: false, path, filename };
    }

    const path = await writeExportFileToBase(`${EUER_EXPORT_DIRECTORY}/${filename}`, buffer);
    return { cancelled: false, path, filename };
  } catch (error) {
    throw new Error(
      `EÜR-Export fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
