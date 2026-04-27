import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_SUBCATEGORIES,
  EXPENSE_SUBCATEGORY_LABELS,
  type ExpenseCategory,
  type ExpenseSubcategory,
} from '../constants';
import type { CreateExpense } from '../schemas';
import { checkDuplicate, createExpense } from '../services';

export type ExpenseField =
  | 'date'
  | 'amount_gross'
  | 'vendor'
  | 'category'
  | 'subcategory'
  | 'purpose'
  | 'notes'
  | 'ignore';

export type ColumnMapping = Record<string, ExpenseField>;

export interface ParsedCSV {
  headers: string[];
  rows: string[][];
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

const REQUIRED_FIELDS: readonly ExpenseField[] = ['date', 'amount_gross', 'vendor'];

const FIELD_ALIASES: Record<Exclude<ExpenseField, 'ignore'>, readonly string[]> = {
  date: ['datum', 'date', 'bestelldatum', 'order time', 'order date', 'purchase date'],
  amount_gross: [
    'betrag',
    'gesamtpreis',
    'summe',
    'total',
    'order total',
    'amount',
    'price',
    'gross amount',
  ],
  vendor: ['haendler', 'händler', 'vendor', 'store', 'store name', 'supplier', 'merchant'],
  category: ['kategorie', 'category'],
  subcategory: ['unterkategorie', 'subcategory', 'sub category'],
  purpose: ['beschreibung', 'verwendungszweck', 'purpose', 'description', 'product name', 'item'],
  notes: ['notizen', 'notes', 'note', 'comment', 'kommentar'],
};

export function parseCSV(content: string): ParsedCSV {
  const normalizedContent = content
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  const delimiter = detectDelimiter(normalizedContent);
  const rows = parseDelimitedRows(normalizedContent, delimiter)
    .map((row) => trimTrailingEmptyCells(row))
    .filter((row) => row.some((cell) => cell.trim().length > 0));

  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = rows[0].map((header, index) => header.trim() || `Spalte ${index + 1}`);
  const bodyRows = rows.slice(1).map((row) => normalizeRowLength(row, headers.length));

  return { headers, rows: bodyRows };
}

export function autoMapColumns(headers: string[]): ColumnMapping {
  return headers.reduce<ColumnMapping>((mapping, header) => {
    mapping[header] = detectFieldForHeader(header);
    return mapping;
  }, {});
}

export function hasRequiredMapping(mapping: ColumnMapping): boolean {
  const mappedFields = new Set(Object.values(mapping));
  return REQUIRED_FIELDS.every((field) => mappedFields.has(field));
}

export function mapRowToExpense(
  row: string[],
  mapping: ColumnMapping,
  rowNumber = 0,
): CreateExpense {
  const values = extractMappedValues(row, mapping);
  const date = parseDateToISO(values.date ?? '');
  const amountGross = parseAmount(values.amount_gross ?? '');
  const vendor = (values.vendor ?? '').trim();

  if (!date) {
    throw new Error(`Zeile ${rowNumber || '?'}: Datum konnte nicht erkannt werden`);
  }

  if (amountGross === null || amountGross <= 0) {
    throw new Error(`Zeile ${rowNumber || '?'}: Betrag Brutto ist ungültig`);
  }

  if (!vendor) {
    throw new Error(`Zeile ${rowNumber || '?'}: Händler fehlt`);
  }

  const category = parseCategory(values.category ?? '') ?? 'sonstiges';
  const subcategory = parseSubcategory(values.subcategory ?? '', category);

  return {
    date,
    amount_gross: amountGross,
    vendor,
    category,
    subcategory,
    purpose: normalizeNullableText(values.purpose),
    notes: normalizeNullableText(values.notes),
    tax_relevant: true,
    recurring: false,
    import_source: 'csv_import',
    import_ref: rowNumber > 0 ? `row_${rowNumber}` : null,
  };
}

export async function importExpenses(
  expenses: CreateExpense[],
  options: { skipDuplicates?: boolean } = {},
): Promise<ImportResult> {
  const skipDuplicates = options.skipDuplicates ?? true;
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

  for (const [index, expense] of expenses.entries()) {
    try {
      if (skipDuplicates) {
        const duplicate = await checkDuplicate(expense.date, expense.amount_gross, expense.vendor);

        if (duplicate) {
          result.skipped++;
          continue;
        }
      }

      await createExpense(expense);
      result.imported++;
    } catch (error) {
      const rowLabel = expense.import_ref?.replace('row_', '') ?? String(index + 2);
      result.errors.push(
        `Zeile ${rowLabel}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return result;
}

export function parseDateToISO(value: string): string | null {
  const trimmed = value.trim();

  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(trimmed);
  if (isoMatch) {
    return normalizeDateParts(isoMatch[1], isoMatch[2], isoMatch[3]);
  }

  const germanMatch = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(trimmed);
  if (germanMatch) {
    return normalizeDateParts(germanMatch[3], germanMatch[2], germanMatch[1]);
  }

  const usMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (usMatch) {
    return normalizeDateParts(usMatch[3], usMatch[1], usMatch[2]);
  }

  const slashIsoMatch = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(trimmed);
  if (slashIsoMatch) {
    return normalizeDateParts(slashIsoMatch[1], slashIsoMatch[2], slashIsoMatch[3]);
  }

  return null;
}

export function parseAmount(value: string): number | null {
  const normalized = value
    .trim()
    .replace(/[^\d,.-]/g, '')
    .replace(/\s/g, '');

  if (!normalized) {
    return null;
  }

  const decimalSeparator = detectDecimalSeparator(normalized);
  const withoutThousands =
    decimalSeparator === ','
      ? normalized.replace(/\./g, '').replace(',', '.')
      : normalized.replace(/,/g, '');
  const parsed = Number(withoutThousands);

  return Number.isFinite(parsed) ? parsed : null;
}

function parseDelimitedRows(content: string, delimiter: ',' | ';'): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < content.length; index++) {
    const char = content[index];
    const nextChar = content[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      cell += '"';
      index++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if (char === '\n' && !inQuotes) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);

  return rows;
}

function detectDelimiter(content: string): ',' | ';' {
  const sampleLine = content.split('\n').find((line) => line.trim().length > 0) ?? '';
  const commaCount = countDelimiterOutsideQuotes(sampleLine, ',');
  const semicolonCount = countDelimiterOutsideQuotes(sampleLine, ';');
  return semicolonCount > commaCount ? ';' : ',';
}

function countDelimiterOutsideQuotes(line: string, delimiter: ',' | ';'): number {
  let count = 0;
  let inQuotes = false;

  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      index++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      count++;
    }
  }

  return count;
}

function normalizeRowLength(row: string[], length: number): string[] {
  if (row.length === length) {
    return row.map((cell) => cell.trim());
  }

  return Array.from({ length }, (_, index) => (row[index] ?? '').trim());
}

function trimTrailingEmptyCells(row: string[]): string[] {
  let lastIndex = row.length - 1;
  while (lastIndex >= 0 && row[lastIndex].trim() === '') {
    lastIndex--;
  }
  return row.slice(0, lastIndex + 1);
}

function detectFieldForHeader(header: string): ExpenseField {
  const normalized = normalizeToken(header);

  for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [
    Exclude<ExpenseField, 'ignore'>,
    readonly string[],
  ][]) {
    if (aliases.some((alias) => normalizeToken(alias) === normalized)) {
      return field;
    }
  }

  return 'ignore';
}

function extractMappedValues(
  row: string[],
  mapping: ColumnMapping,
): Partial<Record<ExpenseField, string>> {
  const values: Partial<Record<ExpenseField, string>> = {};
  Object.values(mapping).forEach((field, index) => {
    if (field !== 'ignore' && values[field] === undefined) {
      values[field] = row[index] ?? '';
    }
  });
  return values;
}

function parseCategory(value: string): ExpenseCategory | null {
  const normalized = normalizeToken(value);
  if (!normalized) {
    return null;
  }

  return (
    EXPENSE_CATEGORIES.find(
      (category) =>
        normalizeToken(category) === normalized ||
        normalizeToken(EXPENSE_CATEGORY_LABELS[category]) === normalized,
    ) ?? null
  );
}

function parseSubcategory(value: string, category: ExpenseCategory): ExpenseSubcategory | null {
  const normalized = normalizeToken(value);
  if (!normalized) {
    return null;
  }

  const allowed = EXPENSE_SUBCATEGORIES[category];
  return (
    allowed.find(
      (subcategory) =>
        normalizeToken(subcategory) === normalized ||
        normalizeToken(EXPENSE_SUBCATEGORY_LABELS[subcategory]) === normalized,
    ) ?? null
  );
}

function normalizeDateParts(
  yearValue: string,
  monthValue: string,
  dayValue: string,
): string | null {
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function detectDecimalSeparator(value: string): '.' | ',' {
  const lastComma = value.lastIndexOf(',');
  const lastDot = value.lastIndexOf('.');

  if (lastComma === -1) {
    return '.';
  }

  if (lastDot === -1) {
    return ',';
  }

  return lastComma > lastDot ? ',' : '.';
}

function normalizeNullableText(value: string | undefined): string | null {
  const normalized = value?.trim() ?? '';
  return normalized ? normalized : null;
}

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
