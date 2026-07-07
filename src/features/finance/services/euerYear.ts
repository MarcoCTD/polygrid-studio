import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_SUBCATEGORY_LABELS,
  type ExpenseCategory,
  type ExpenseSubcategory,
} from '@/features/expenses/constants';

/**
 * Reine Aggregationslogik für den EÜR-Jahresexport (Modul 14).
 * Kein DB-Zugriff, keine Seiteneffekte – vollständig unit-testbar.
 * Fachliche Regeln: docs/specs/MODUL_14_EUER_EXPORT.md Abschnitt 2,
 * Entscheidungen: docs/decisions/ENTSCHEIDUNGEN_MODUL_14.md.
 */

// Kleinunternehmergrenzen §19 UStG, Gesetzesstand 2025er Reform:
// Vorjahresumsatz max. 25.000 EUR, laufendes Jahr max. 100.000 EUR.
// Bewusst NICHT über Settings konfigurierbar (Spec 2.4).
export const KLEINUNTERNEHMER_GRENZE_VORJAHR_EUR = 25_000;
export const KLEINUNTERNEHMER_GRENZE_LAUFEND_EUR = 100_000;

/** Aufträge, die als Einnahme zählen (Spec 2.1): Status + payment_status = paid. */
export const EUER_INCOME_STATUSES = ['completed', 'shipped'] as const;

export type EuerDateSource = 'zahlungsdatum' | 'timeline' | 'bestelldatum';

export const EUER_DATE_SOURCE_LABELS: Record<EuerDateSource, string> = {
  zahlungsdatum: 'Zahlungsdatum',
  timeline: 'Timeline (paid)',
  bestelldatum: 'Bestelldatum (Fallback)',
};

const PLATFORM_LABELS: Record<string, string> = {
  etsy: 'Etsy',
  ebay: 'eBay',
  kleinanzeigen: 'Kleinanzeigen',
  direkt: 'Direkt',
};

export interface EuerOrderInput {
  id: string;
  receipt_number: string;
  external_order_id: string | null;
  platform: string;
  product_name: string | null;
  variant: string | null;
  quantity: number;
  sale_price: number;
  shipping_revenue: number | null;
  status: string;
  payment_status: string;
  payment_received_date: string | null;
  /** Frühester order_events-Eintrag mit status_change auf paid/completed (ISO). */
  paid_event_date: string | null;
  order_date: string;
  deleted_at: string | null;
}

export interface EuerExpenseInput {
  id: string;
  date: string;
  amount_gross: number;
  vendor: string;
  category: string;
  subcategory: string | null;
  purpose: string | null;
  receipt_attached: boolean;
  tax_relevant: boolean;
  deleted_at: string | null;
}

export interface EuerIncomeLine {
  orderId: string;
  date: string;
  dateSource: EuerDateSource;
  platform: string;
  /** external_order_id, Fallback interne Belegnummer (Spec 3). */
  orderNumber: string;
  product: string;
  quantity: number;
  amount: number;
}

export interface EuerExcludedIncomeLine extends EuerIncomeLine {
  paymentStatus: string;
}

export interface EuerExpenseLine {
  expenseId: string;
  date: string;
  vendor: string;
  category: string;
  categoryLabel: string;
  subcategoryLabel: string;
  purpose: string;
  receiptAttached: boolean;
  amount: number;
}

export interface EuerExpenseCategoryGroup {
  category: string;
  categoryLabel: string;
  lines: EuerExpenseLine[];
  subtotal: number;
}

export interface EuerMonthRow {
  /** 1–12 */
  month: number;
  income: number;
  expenses: number;
  balance: number;
}

export interface EuerWarnings {
  /** Steuerrelevante Ausgaben des Jahres ohne Beleg. */
  expensesWithoutReceipt: number;
  /** Einnahmen, deren Datum auf das Bestelldatum zurückfällt. */
  ordersWithFallbackDate: number;
  /** completed-Aufträge des Jahres mit payment_status = pending (Dateninkonsistenz). */
  completedNotPaid: number;
}

export interface EuerYearReport {
  year: number;
  incomeLines: EuerIncomeLine[];
  incomeTotal: number;
  excludedIncome: EuerExcludedIncomeLine[];
  excludedIncomeTotal: number;
  expenseGroups: EuerExpenseCategoryGroup[];
  expenseTotal: number;
  nonTaxRelevantLines: EuerExpenseLine[];
  nonTaxRelevantTotal: number;
  /** Überschuss = Einnahmen − steuerrelevante Ausgaben (Spec 2.3). */
  surplus: number;
  months: EuerMonthRow[];
  warnings: EuerWarnings;
}

export type KleinunternehmerAmpel = 'gruen' | 'gelb' | 'rot';

export interface KleinunternehmerStatus {
  revenue: number;
  limit: number;
  percent: number;
  ampel: KleinunternehmerAmpel;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Normalisiert Datumsangaben auf YYYY-MM-DD. Bestandsdaten enthalten teils
 * DD.MM.YYYY (vgl. ORDER_REVENUE_DATE_EXPR im Modul-08-Export).
 */
export function normalizeDateOnly(value: string): string | null {
  const trimmed = value.trim();
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
  if (iso) return iso[1];
  const german = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(trimmed);
  if (german) return `${german[3]}-${german[2]}-${german[1]}`;
  return null;
}

/**
 * Maßgebliches Einnahmen-Datum (Zuflussprinzip, Entscheidung 2):
 * payment_received_date → Timeline-paid-Event → order_date (Fallback).
 */
export function effectiveIncomeDate(
  order: Pick<EuerOrderInput, 'payment_received_date' | 'paid_event_date' | 'order_date'>,
): { date: string; source: EuerDateSource } {
  if (order.payment_received_date) {
    const normalized = normalizeDateOnly(order.payment_received_date);
    if (normalized) return { date: normalized, source: 'zahlungsdatum' };
  }
  if (order.paid_event_date) {
    const normalized = normalizeDateOnly(order.paid_event_date);
    if (normalized) return { date: normalized, source: 'timeline' };
  }
  return {
    date: normalizeDateOnly(order.order_date) ?? order.order_date.slice(0, 10),
    source: 'bestelldatum',
  };
}

/** Einnahme pro Auftrag (Entscheidung 1): Gesamt-Verkaufspreis + Käufer-Versand. */
export function orderIncomeAmount(
  order: Pick<EuerOrderInput, 'sale_price' | 'shipping_revenue'>,
): number {
  return round2(order.sale_price + (order.shipping_revenue ?? 0));
}

function yearOf(date: string): number {
  return Number.parseInt(date.slice(0, 4), 10);
}

function monthOf(date: string): number {
  return Number.parseInt(date.slice(5, 7), 10);
}

function isIncomeStatus(status: string): boolean {
  return (EUER_INCOME_STATUSES as readonly string[]).includes(status);
}

function categoryLabelFor(category: string): string {
  return EXPENSE_CATEGORY_LABELS[category as ExpenseCategory] ?? category;
}

function subcategoryLabelFor(subcategory: string | null): string {
  if (!subcategory) return '';
  return EXPENSE_SUBCATEGORY_LABELS[subcategory as ExpenseSubcategory] ?? subcategory;
}

function toIncomeLine(order: EuerOrderInput, date: string, source: EuerDateSource): EuerIncomeLine {
  return {
    orderId: order.id,
    date,
    dateSource: source,
    platform: PLATFORM_LABELS[order.platform] ?? order.platform,
    orderNumber: order.external_order_id?.trim() || order.receipt_number,
    product: order.product_name ?? order.variant ?? 'Auftrag',
    quantity: order.quantity,
    amount: orderIncomeAmount(order),
  };
}

function toExpenseLine(expense: EuerExpenseInput): EuerExpenseLine {
  return {
    expenseId: expense.id,
    date: normalizeDateOnly(expense.date) ?? expense.date.slice(0, 10),
    vendor: expense.vendor,
    category: expense.category,
    categoryLabel: categoryLabelFor(expense.category),
    subcategoryLabel: subcategoryLabelFor(expense.subcategory),
    purpose: expense.purpose ?? '',
    receiptAttached: expense.receipt_attached,
    amount: round2(expense.amount_gross),
  };
}

function sumAmounts(lines: readonly { amount: number }[]): number {
  return round2(lines.reduce((sum, line) => sum + line.amount, 0));
}

function byDate<T extends { date: string }>(a: T, b: T): number {
  return a.date.localeCompare(b.date);
}

/**
 * Aggregiert Aufträge und Ausgaben eines Jahres zum EÜR-Report.
 * Soft-gelöschte Datensätze werden ignoriert; die Jahreszuordnung der
 * Einnahmen folgt dem effektiven Zufluss-Datum (nicht dem Bestelldatum).
 */
export function buildEuerYearReport(
  year: number,
  orders: readonly EuerOrderInput[],
  expenses: readonly EuerExpenseInput[],
): EuerYearReport {
  const incomeLines: EuerIncomeLine[] = [];
  const excludedIncome: EuerExcludedIncomeLine[] = [];
  let completedNotPaid = 0;

  for (const order of orders) {
    if (order.deleted_at) continue;
    if (!isIncomeStatus(order.status)) continue;

    const { date, source } = effectiveIncomeDate(order);
    if (yearOf(date) !== year) continue;

    if (order.payment_status === 'paid') {
      incomeLines.push(toIncomeLine(order, date, source));
    } else if (order.payment_status === 'refunded' || order.payment_status === 'disputed') {
      excludedIncome.push({
        ...toIncomeLine(order, date, source),
        paymentStatus: order.payment_status,
      });
    }

    if (order.status === 'completed' && order.payment_status === 'pending') {
      completedNotPaid += 1;
    }
  }

  incomeLines.sort(byDate);
  excludedIncome.sort(byDate);

  const taxRelevantLines: EuerExpenseLine[] = [];
  const nonTaxRelevantLines: EuerExpenseLine[] = [];

  for (const expense of expenses) {
    if (expense.deleted_at) continue;
    const line = toExpenseLine(expense);
    if (yearOf(line.date) !== year) continue;
    if (expense.tax_relevant) {
      taxRelevantLines.push(line);
    } else {
      nonTaxRelevantLines.push(line);
    }
  }

  taxRelevantLines.sort(byDate);
  nonTaxRelevantLines.sort(byDate);

  const groupsByCategory = new Map<string, EuerExpenseCategoryGroup>();
  for (const line of taxRelevantLines) {
    let group = groupsByCategory.get(line.category);
    if (!group) {
      group = {
        category: line.category,
        categoryLabel: line.categoryLabel,
        lines: [],
        subtotal: 0,
      };
      groupsByCategory.set(line.category, group);
    }
    group.lines.push(line);
  }
  const expenseGroups = [...groupsByCategory.values()]
    .map((group) => ({ ...group, subtotal: sumAmounts(group.lines) }))
    // Konsistent zur Ausgaben-Seite (getCategoryBreakdown): größte Kategorie zuerst.
    .sort((a, b) => b.subtotal - a.subtotal);

  const incomeTotal = sumAmounts(incomeLines);
  const expenseTotal = sumAmounts(taxRelevantLines);

  const months: EuerMonthRow[] = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    income: 0,
    expenses: 0,
    balance: 0,
  }));
  for (const line of incomeLines) {
    months[monthOf(line.date) - 1].income += line.amount;
  }
  for (const line of taxRelevantLines) {
    months[monthOf(line.date) - 1].expenses += line.amount;
  }
  for (const row of months) {
    row.income = round2(row.income);
    row.expenses = round2(row.expenses);
    row.balance = round2(row.income - row.expenses);
  }

  return {
    year,
    incomeLines,
    incomeTotal,
    excludedIncome,
    excludedIncomeTotal: sumAmounts(excludedIncome),
    expenseGroups,
    expenseTotal,
    nonTaxRelevantLines,
    nonTaxRelevantTotal: sumAmounts(nonTaxRelevantLines),
    surplus: round2(incomeTotal - expenseTotal),
    months,
    warnings: {
      expensesWithoutReceipt: taxRelevantLines.filter((line) => !line.receiptAttached).length,
      ordersWithFallbackDate: incomeLines.filter((line) => line.dateSource === 'bestelldatum')
        .length,
      completedNotPaid,
    },
  };
}

/**
 * Ampel für die Kleinunternehmergrenze (Spec 2.4), gemessen an der
 * 25.000-EUR-Vorjahresgrenze: grün < 80 %, gelb 80–100 %, rot > 100 %.
 */
export function kleinunternehmerStatus(revenue: number): KleinunternehmerStatus {
  const limit = KLEINUNTERNEHMER_GRENZE_VORJAHR_EUR;
  const percent = round2((revenue / limit) * 100);
  const ampel: KleinunternehmerAmpel =
    revenue > limit ? 'rot' : revenue >= limit * 0.8 ? 'gelb' : 'gruen';
  return { revenue: round2(revenue), limit, percent, ampel };
}

/** Slug-Regel wie Produktordner (Modul 03): Umlaute, Kleinbuchstaben, Bindestriche. */
export function companyNameSlug(companyName: string): string {
  const slug = companyName
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'export';
}

export function euerExportFilename(year: number, companyName: string): string {
  return `euer_${year}_${companyNameSlug(companyName)}.xlsx`;
}
