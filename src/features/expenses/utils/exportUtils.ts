import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_SUBCATEGORY_LABELS,
  type ExpenseSubcategory,
} from '../constants';
import type { Expense } from '../schemas';

const CSV_BOM = '\uFEFF';
const CSV_HEADERS = [
  'Datum',
  'Betrag Brutto',
  'Betrag Netto',
  'Steuer',
  'Händler',
  'Kategorie',
  'Unterkategorie',
  'Verwendungszweck',
  'Steuerrelevant',
  'Beleg',
] as const;

export function buildExpenseCsvFilename(selectedMonth: string): string {
  return `ausgaben_${selectedMonth}.csv`;
}

export async function exportExpensesAsCsv(expenses: Expense[], filename: string): Promise<boolean> {
  try {
    const path = await save({
      defaultPath: filename,
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });

    if (!path) {
      return false;
    }

    const csv = [CSV_HEADERS.join(','), ...expenses.map(formatExpenseRow)].join('\r\n');
    await writeTextFile(path, CSV_BOM + csv);
    return true;
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'CSV-Export konnte nicht geschrieben werden',
    );
  }
}

function formatExpenseRow(expense: Expense): string {
  return [
    formatDateForCsv(expense.date),
    formatNumberForCsv(expense.amount_gross),
    formatNullableNumberForCsv(expense.amount_net),
    formatNullableNumberForCsv(expense.tax_amount),
    expense.vendor,
    EXPENSE_CATEGORY_LABELS[expense.category],
    formatSubcategory(expense.subcategory),
    expense.purpose ?? '',
    expense.tax_relevant ? 'Ja' : 'Nein',
    expense.receipt_attached ? 'Ja' : 'Nein',
  ]
    .map(escapeCsvCell)
    .join(',');
}

function formatDateForCsv(value: string): string {
  return new Date(value).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatNumberForCsv(value: number): string {
  return value.toFixed(2);
}

function formatNullableNumberForCsv(value: number | null): string {
  return value === null ? '' : formatNumberForCsv(value);
}

function formatSubcategory(value: ExpenseSubcategory | null): string {
  return value ? EXPENSE_SUBCATEGORY_LABELS[value] : '';
}

function escapeCsvCell(value: string): string {
  if (!/[",\r\n]/.test(value)) {
    return value;
  }

  return `"${value.split('"').join('""')}"`;
}
