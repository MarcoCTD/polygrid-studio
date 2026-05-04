import { save } from '@tauri-apps/plugin-dialog';
import { writeFile, writeTextFile } from '@tauri-apps/plugin-fs';
import ExcelJS from 'exceljs';
import { getDatabase } from '@/services/database';
import { EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from '@/features/expenses/constants';
import type { Expense } from '@/features/expenses/schemas';
import type {
  OrderListItem,
  OrderPlatform,
  OrderStatus,
  PaymentStatus,
  ShippingStatus,
} from '@/features/orders/types';

export interface EuerExportOptions {
  dateFrom: string;
  dateTo: string;
  format: 'csv' | 'xlsx' | 'both';
  setTaxLock: boolean;
}

export interface EuerExportPreview {
  incomeCount: number;
  expenseCount: number;
  incomeTotal: number;
  expenseTotal: number;
}

export interface EuerExportResult extends EuerExportPreview {
  exportedFiles: string[];
  lockedOrders: number;
  lockedExpenses: number;
  cancelled: boolean;
}

export type BookingType = 'Einnahme' | 'Ausgabe';

export interface FinanceBooking {
  id: string;
  source: 'order' | 'expense';
  receiptNumber: string;
  date: string;
  type: BookingType;
  bookingText: string;
  category: string;
  amount: number;
  party: string;
  receiptAttached: boolean;
  externalReference: string;
  bankMatchId: string | null;
  bankMatchConfidence: string | null;
}

const CSV_BOM = '\uFEFF';
const CSV_DELIMITER = ';';
const EXPORT_HEADERS = [
  'Beleg-Nr.',
  'Datum',
  'Art',
  'Buchungstext',
  'Kategorie',
  'Betrag',
  'Plattform/Händler',
  'Beleg vorhanden',
  'Externe Referenz',
] as const;

const EARNING_STATUSES: OrderStatus[] = ['paid', 'shipped', 'completed'];

const EUER_CATEGORY_BY_EXPENSE: Record<ExpenseCategory, string> = {
  filament: 'Wareneinkauf',
  verpackung: 'Wareneinkauf',
  werkzeuge: 'Geringwertige Wirtschaftsgüter',
  druckerzubehoer: 'Reparatur und Instandhaltung',
  maschinen_hardware: 'Anschaffung Anlagevermögen (Hinweis: ggf. AfA prüfen)',
  software_saas: 'Sonstige betriebliche Aufwendungen',
  werbung: 'Werbekosten',
  versand: 'Porto / Versandkosten',
  reisekosten: 'Reisekosten',
  buero: 'Bürobedarf',
  sonstiges: 'Sonstige betriebliche Aufwendungen',
};

type Row = Record<string, unknown>;
type ExportOrder = OrderListItem & { bank_match_confidence: string | null };
type ExportExpense = Expense & { bank_match_confidence: string | null };

const EXPENSE_PREVIEW_QUERY = `SELECT COUNT(*) AS count, SUM(amount_gross) AS total
       FROM expenses
       WHERE (deleted_at IS NULL OR deleted_at = '')
         AND tax_relevant IN (1, '1', 'true', 'TRUE')
         AND substr(date, 1, 10) >= $1
         AND substr(date, 1, 10) <= $2`;

function rowToOrder(row: Row): OrderListItem {
  return {
    id: row.id as string,
    receipt_number: row.receipt_number as string,
    external_order_id: (row.external_order_id as string | null) ?? null,
    customer_name: (row.customer_name as string | null) ?? null,
    platform: row.platform as OrderPlatform,
    product_id: (row.product_id as string | null) ?? null,
    variant: (row.variant as string | null) ?? null,
    quantity: Number(row.quantity),
    sale_price: Number(row.sale_price),
    shipping_revenue: row.shipping_revenue === null ? null : Number(row.shipping_revenue),
    shipping_cost: row.shipping_cost === null ? null : Number(row.shipping_cost),
    material_cost: row.material_cost === null ? null : Number(row.material_cost),
    platform_fee: row.platform_fee === null ? null : Number(row.platform_fee),
    payout_amount: row.payout_amount === null ? null : Number(row.payout_amount),
    status: row.status as OrderStatus,
    payment_status: row.payment_status as PaymentStatus,
    payment_received_date: (row.payment_received_date as string | null) ?? null,
    shipping_status: (row.shipping_status as ShippingStatus | null) ?? null,
    tracking_number: (row.tracking_number as string | null) ?? null,
    order_date: row.order_date as string,
    notes: (row.notes as string | null) ?? null,
    tax_locked: Boolean(row.tax_locked),
    bank_match_id: (row.bank_match_id as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    deleted_at: (row.deleted_at as string | null) ?? null,
    product_name: (row.product_name as string | null) ?? null,
  };
}

function rowToExportOrder(row: Row): ExportOrder {
  return {
    ...rowToOrder(row),
    bank_match_confidence: (row.bank_match_confidence as string | null | undefined) ?? null,
  };
}

function rowToExpense(row: Row): Expense {
  return {
    id: row.id as string,
    date: row.date as string,
    amount_gross: Number(row.amount_gross),
    amount_net: row.amount_net === null ? null : Number(row.amount_net),
    tax_amount: row.tax_amount === null ? null : Number(row.tax_amount),
    vendor: row.vendor as string,
    category: row.category as Expense['category'],
    subcategory: (row.subcategory as Expense['subcategory']) ?? null,
    payment_method: (row.payment_method as Expense['payment_method']) ?? null,
    purpose: (row.purpose as string | null) ?? null,
    product_id: (row.product_id as string | null) ?? null,
    order_id: (row.order_id as string | null) ?? null,
    receipt_attached: Boolean(row.receipt_attached),
    receipt_file_path: (row.receipt_file_path as string | null) ?? null,
    tax_relevant: Boolean(row.tax_relevant),
    recurring: Boolean(row.recurring),
    recurring_interval: (row.recurring_interval as Expense['recurring_interval']) ?? null,
    recurring_next_date: (row.recurring_next_date as string | null) ?? null,
    import_source: (row.import_source as Expense['import_source']) ?? 'manual',
    import_ref: (row.import_ref as string | null) ?? null,
    tax_locked: Boolean(row.tax_locked),
    bank_match_id: (row.bank_match_id as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    deleted_at: (row.deleted_at as string | null) ?? null,
  };
}

function rowToExportExpense(row: Row): ExportExpense {
  return {
    ...rowToExpense(row),
    bank_match_confidence: (row.bank_match_confidence as string | null | undefined) ?? null,
  };
}

function isoToDate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00`);
}

function normalizeDateOnly(value: string): string {
  const trimmed = value.trim();
  const directIso = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
  if (directIso) return directIso[1];

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Ungültiges Datum für EÜR-Export: ${value}`);
  }

  return parsed.toISOString().split('T')[0];
}

function normalizeDateRange(dateFrom: string, dateTo: string): { dateFrom: string; dateTo: string } {
  return {
    dateFrom: normalizeDateOnly(dateFrom),
    dateTo: normalizeDateOnly(dateTo),
  };
}

function exportFilename(options: EuerExportOptions, extension: 'csv' | 'xlsx'): string {
  const range = normalizeDateRange(options.dateFrom, options.dateTo);
  const year = range.dateFrom.slice(0, 4);
  const sameMonth =
    range.dateFrom.slice(0, 7) === range.dateTo.slice(0, 7) && range.dateFrom.endsWith('-01');
  return sameMonth ? `euer_${range.dateFrom.slice(0, 7)}.${extension}` : `euer_${year}.${extension}`;
}

function orderBookingText(order: OrderListItem): string {
  const product = order.product_name ?? order.variant ?? 'Auftrag';
  const external = order.external_order_id ? ` (${order.external_order_id})` : '';
  return `Verkauf ${platformLabel(order.platform)}: ${product}${external}`;
}

function platformLabel(platform: OrderPlatform): string {
  if (platform === 'kleinanzeigen') return 'Kleinanzeigen';
  if (platform === 'direkt') return 'Direkt';
  return platform === 'etsy' ? 'Etsy' : 'eBay';
}

function expenseReceiptNumber(expense: Expense): string {
  return `E-${expense.date.slice(0, 4)}-${expense.id.slice(0, 8)}`;
}

function escapeCsv(value: string): string {
  if (!/[;"\r\n]/.test(value)) return value;
  return `"${value.split('"').join('""')}"`;
}

function amountForCsv(value: number): string {
  return value.toFixed(2).replace('.', ',');
}

function formatCsv(bookings: FinanceBooking[]): string {
  return (
    CSV_BOM +
    [
      EXPORT_HEADERS.join(CSV_DELIMITER),
      ...bookings.map((booking) =>
        [
          booking.receiptNumber,
          booking.date,
          booking.type,
          booking.bookingText,
          booking.category,
          amountForCsv(booking.amount),
          booking.party,
          booking.receiptAttached ? 'Ja' : 'Nein',
          booking.externalReference,
        ]
          .map(escapeCsv)
          .join(CSV_DELIMITER),
      ),
    ].join('\r\n')
  );
}

async function loadOrders(dateFrom: string, dateTo: string): Promise<ExportOrder[]> {
  const range = normalizeDateRange(dateFrom, dateTo);
  const statusPlaceholders = EARNING_STATUSES.map((_, index) => `$${index + 3}`).join(', ');
  const rows = await getDatabase().select<Row[]>(
    `SELECT o.*, p.name AS product_name, bt.match_confidence AS bank_match_confidence
     FROM orders o
     LEFT JOIN products p ON p.id = o.product_id
     LEFT JOIN bank_transactions bt ON bt.id = o.bank_match_id
     WHERE o.deleted_at IS NULL
       AND o.payment_received_date IS NOT NULL
       AND o.payment_received_date >= $1
       AND o.payment_received_date <= $2
       AND o.status IN (${statusPlaceholders})
     ORDER BY o.payment_received_date ASC, o.receipt_number ASC`,
    [range.dateFrom, range.dateTo, ...EARNING_STATUSES],
  );
  return rows.map(rowToExportOrder);
}

async function loadExpenses(dateFrom: string, dateTo: string): Promise<ExportExpense[]> {
  const range = normalizeDateRange(dateFrom, dateTo);
  const rows = await getDatabase().select<Row[]>(
    `SELECT e.*, bt.match_confidence AS bank_match_confidence
     FROM expenses e
     LEFT JOIN bank_transactions bt ON bt.id = e.bank_match_id
     WHERE (e.deleted_at IS NULL OR e.deleted_at = '')
       AND e.tax_relevant IN (1, '1', 'true', 'TRUE')
       AND substr(e.date, 1, 10) >= $1
       AND substr(e.date, 1, 10) <= $2
     ORDER BY e.date ASC, e.created_at ASC`,
    [range.dateFrom, range.dateTo],
  );
  return rows.map(rowToExportExpense);
}

export async function loadFinanceBookings(
  dateFrom: string,
  dateTo: string,
): Promise<FinanceBooking[]> {
  const [orders, expenses] = await Promise.all([
    loadOrders(dateFrom, dateTo),
    loadExpenses(dateFrom, dateTo),
  ]);

  return [
    ...orders.map<FinanceBooking>((order) => ({
      id: order.id,
      source: 'order',
      receiptNumber: order.receipt_number,
      date: order.payment_received_date ?? order.order_date,
      type: 'Einnahme',
      bookingText: orderBookingText(order),
      category: 'Betriebseinnahmen aus Lieferungen und Leistungen',
      amount: order.sale_price + (order.shipping_revenue ?? 0),
      party: platformLabel(order.platform),
      receiptAttached: true,
      externalReference: order.external_order_id ?? '',
      bankMatchId: order.bank_match_id,
      bankMatchConfidence: order.bank_match_confidence,
    })),
    ...expenses.map<FinanceBooking>((expense) => ({
      id: expense.id,
      source: 'expense',
      receiptNumber: expenseReceiptNumber(expense),
      date: expense.date,
      type: 'Ausgabe',
      bookingText: `${expense.vendor} - ${EXPENSE_CATEGORY_LABELS[expense.category]}`,
      category: EUER_CATEGORY_BY_EXPENSE[expense.category],
      amount: -expense.amount_gross,
      party: expense.vendor,
      receiptAttached: expense.receipt_attached,
      externalReference: '',
      bankMatchId: expense.bank_match_id,
      bankMatchConfidence: expense.bank_match_confidence,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));
}

export async function getEuerExportPreview(
  dateFrom: string,
  dateTo: string,
): Promise<EuerExportPreview> {
  const range = normalizeDateRange(dateFrom, dateTo);
  const statusPlaceholders = EARNING_STATUSES.map((_, index) => `$${index + 3}`).join(', ');
  const db = getDatabase();
  const incomePromise = db
    .select<{ count: number; total: number | null }[]>(
      `SELECT COUNT(*) AS count, SUM(sale_price + COALESCE(shipping_revenue, 0)) AS total
       FROM orders
       WHERE deleted_at IS NULL
         AND payment_received_date IS NOT NULL
         AND payment_received_date >= $1
         AND payment_received_date <= $2
         AND status IN (${statusPlaceholders})`,
      [range.dateFrom, range.dateTo, ...EARNING_STATUSES],
    )
    .catch((error) => {
      console.error('EÜR preview income query failed', error);
      return [{ count: 0, total: 0 }];
    });
  const expensePromise = db
    .select<{ count: number; total: number | null }[]>(EXPENSE_PREVIEW_QUERY, [
      range.dateFrom,
      range.dateTo,
    ])
    .catch((error) => {
      console.error('EÜR preview expense query failed', {
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
        sql: EXPENSE_PREVIEW_QUERY,
        error,
      });
      return [{ count: 0, total: 0 }];
    });
  const [incomeRows, expenseRows] = await Promise.all([incomePromise, expensePromise]);

  return {
    incomeCount: Number(incomeRows[0]?.count ?? 0),
    expenseCount: Number(expenseRows[0]?.count ?? 0),
    incomeTotal: Number(incomeRows[0]?.total ?? 0),
    expenseTotal: Number(expenseRows[0]?.total ?? 0),
  };
}

function addExportHeader(sheet: ExcelJS.Worksheet): void {
  sheet.addRow(EXPORT_HEADERS);
  sheet.getRow(1).font = { bold: true };
}

function addBookingRows(sheet: ExcelJS.Worksheet, bookings: FinanceBooking[]): void {
  addExportHeader(sheet);
  for (const booking of bookings) {
    const row = sheet.addRow([
      booking.receiptNumber,
      isoToDate(booking.date),
      booking.type,
      booking.bookingText,
      booking.category,
      booking.amount,
      booking.party,
      booking.receiptAttached ? 'Ja' : 'Nein',
      booking.externalReference,
    ]);
    row.getCell(2).numFmt = 'dd.mm.yyyy';
    row.getCell(6).numFmt = '#,##0.00 €';
  }
  sheet.columns.forEach((column) => {
    column.width = Math.max(column.width ?? 12, 16);
  });
}

async function buildWorkbook(
  options: EuerExportOptions,
  bookings: FinanceBooking[],
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PolyGrid Studio';
  workbook.created = new Date();
  const income = bookings.filter((booking) => booking.type === 'Einnahme');
  const expenses = bookings.filter((booking) => booking.type === 'Ausgabe');

  const overview = workbook.addWorksheet('Übersicht');
  overview.addRows([
    ['PolyGrid Studio Business OS - EÜR-Auswertung'],
    [`Zeitraum: ${options.dateFrom} - ${options.dateTo}`],
    [],
    ['Summe Einnahmen', { formula: `SUMME(Einnahmen!F2:F${Math.max(income.length + 1, 2)})` }],
    ['Summe Ausgaben', { formula: `SUMME(Ausgaben!F2:F${Math.max(expenses.length + 1, 2)})` }],
    ['Saldo (Gewinn)', { formula: 'B4+B5' }],
    [],
    ['Anzahl Aufträge', income.length],
    ['Anzahl Ausgaben-Buchungen', expenses.length],
  ]);
  overview.getCell('A1').font = { bold: true, size: 14 };
  overview.getColumn(1).width = 34;
  overview.getColumn(2).width = 18;
  ['B4', 'B5', 'B6'].forEach((cell) => {
    overview.getCell(cell).numFmt = '#,##0.00 €';
  });
  overview.getCell('A15').value =
    'Kleinunternehmer gemäß §19 UStG. Keine Umsatzsteuer ausgewiesen.';
  overview.getCell('A17').value =
    'Dieser Export ersetzt keine steuerliche Buchführung. Bitte alle Daten vor Abgabe prüfen.';

  addBookingRows(workbook.addWorksheet('Einnahmen'), income);
  addBookingRows(workbook.addWorksheet('Ausgaben'), expenses);

  const categories = workbook.addWorksheet('Kategorien');
  categories.addRow(['Kategorie', 'Summe']);
  categories.getRow(1).font = { bold: true };
  const sums = new Map<string, number>();
  for (const booking of bookings) {
    sums.set(booking.category, (sums.get(booking.category) ?? 0) + booking.amount);
  }
  for (const [category, total] of sums.entries()) {
    const row = categories.addRow([category, total]);
    row.getCell(2).numFmt = '#,##0.00 €';
  }
  categories.getColumn(1).width = 48;
  categories.getColumn(2).width = 18;

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
}

async function applyTaxLock(
  bookings: FinanceBooking[],
): Promise<{ orders: number; expenses: number }> {
  const orderIds = bookings
    .filter((booking) => booking.source === 'order')
    .map((booking) => booking.id);
  const expenseIds = bookings
    .filter((booking) => booking.source === 'expense')
    .map((booking) => booking.id);
  if (orderIds.length === 0 && expenseIds.length === 0) return { orders: 0, expenses: 0 };

  const db = getDatabase();
  if (orderIds.length > 0) {
    await db.execute(
      `UPDATE orders SET tax_locked = 1, updated_at = $1 WHERE id IN (${orderIds.map((_, index) => `$${index + 2}`).join(', ')})`,
      [new Date().toISOString(), ...orderIds],
    );
  }
  if (expenseIds.length > 0) {
    await db.execute(
      `UPDATE expenses SET tax_locked = 1, updated_at = $1 WHERE id IN (${expenseIds.map((_, index) => `$${index + 2}`).join(', ')})`,
      [new Date().toISOString(), ...expenseIds],
    );
  }
  return { orders: orderIds.length, expenses: expenseIds.length };
}

export async function generateEuerExport(options: EuerExportOptions): Promise<EuerExportResult> {
  const range = normalizeDateRange(options.dateFrom, options.dateTo);
  const normalizedOptions = { ...options, ...range };
  const bookings = await loadFinanceBookings(range.dateFrom, range.dateTo);
  const preview = await getEuerExportPreview(range.dateFrom, range.dateTo);
  const exportedFiles: string[] = [];

  if (options.format === 'csv' || options.format === 'both') {
    const path = await save({
      defaultPath: exportFilename(normalizedOptions, 'csv'),
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });
    if (!path)
      return { ...preview, exportedFiles, lockedOrders: 0, lockedExpenses: 0, cancelled: true };
    await writeTextFile(path, formatCsv(bookings));
    exportedFiles.push(path);
  }

  if (options.format === 'xlsx' || options.format === 'both') {
    const path = await save({
      defaultPath: exportFilename(normalizedOptions, 'xlsx'),
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    });
    if (!path)
      return { ...preview, exportedFiles, lockedOrders: 0, lockedExpenses: 0, cancelled: true };
    await writeFile(path, await buildWorkbook(normalizedOptions, bookings));
    exportedFiles.push(path);
  }

  const locked = options.setTaxLock ? await applyTaxLock(bookings) : { orders: 0, expenses: 0 };
  return {
    ...preview,
    exportedFiles,
    lockedOrders: locked.orders,
    lockedExpenses: locked.expenses,
    cancelled: false,
  };
}
