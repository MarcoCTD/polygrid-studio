import { getDatabase, getSetting } from '@/services/database';
import type { OrderPlatform, OrderStatus } from '@/features/orders/types';

export type BankField =
  | 'transaction_date'
  | 'value_date'
  | 'counterparty_name'
  | 'counterparty_iban'
  | 'transaction_type'
  | 'description'
  | 'account_name'
  | 'amount'
  | 'ignore';

export type BankColumnMapping = Record<string, BankField>;
export type MatchConfidence = 'high' | 'medium' | 'low' | 'manual' | 'unmatched';
export type BankTransactionFilter = 'all' | 'income' | 'expense';

export interface ParsedBankCsv {
  headers: string[];
  rows: string[][];
}

export interface BankImportInput {
  fileName: string;
  csv: ParsedBankCsv;
  mapping: BankColumnMapping;
}

export interface BankImportResult {
  batchId: string;
  imported: number;
  skipped: number;
  skippedRows: string[];
  errors: string[];
}

export interface AutoMatchingResult {
  batchId: string;
  matched: number;
  payouts: number;
  unmatched: number;
}

export interface BankTransaction {
  id: string;
  transaction_date: string;
  value_date: string | null;
  amount: number;
  description: string;
  counterparty_name: string | null;
  counterparty_iban: string | null;
  transaction_type: string | null;
  matched_order_id: string | null;
  matched_expense_id: string | null;
  match_confidence: MatchConfidence | null;
  is_payout: boolean;
  import_batch_id: string;
  ignored: boolean;
  notes: string | null;
  created_at: string;
  linked_label: string | null;
}

export interface BankImportBatch {
  id: string;
  source: string;
  imported_at: string;
  filename: string | null;
  transaction_count: number;
  matched_count: number;
  date_range_start: string | null;
  date_range_end: string | null;
}

export interface MatchSuggestion {
  id: string;
  type: 'order' | 'expense' | 'payout';
  label: string;
  subtitle: string;
  amount: number;
  date: string;
  confidence: Exclude<MatchConfidence, 'manual' | 'unmatched'>;
}

export interface PayoutAllocation {
  orderId: string;
  receiptNumber: string;
  productName: string | null;
  orderDate: string;
  allocatedAmount: number;
}

export interface ConfirmMatchResult {
  transactionId: string;
  orderId: string | null;
  expenseId: string | null;
  payoutOrderCount: number;
  suggestPaidStatus: boolean;
  receiptNumber: string | null;
}

interface BankTransactionInput {
  rowNumber: number;
  transaction_date: string;
  value_date: string | null;
  amount: number;
  description: string | null;
  counterparty_name: string | null;
  counterparty_iban: string | null;
  transaction_type: string | null;
}

interface BankTransactionMapResult {
  transaction: BankTransactionInput | null;
  skipReason: string | null;
}

type Row = Record<string, unknown>;

const REQUIRED_FIELDS: readonly BankField[] = ['transaction_date', 'amount', 'description'];
const N26_HEADERS = [
  'Booking Date',
  'Value Date',
  'Partner Name',
  'Partner Iban',
  'Type',
  'Payment Reference',
  'Account Name',
  'Amount (EUR)',
  'Original Amount',
  'Original Currency',
  'Exchange Rate',
] as const;

const FIELD_ALIASES: Record<Exclude<BankField, 'ignore'>, readonly string[]> = {
  transaction_date: ['booking date', 'buchungsdatum', 'datum', 'date', 'transaction date'],
  value_date: ['value date', 'wertstellung', 'valuta'],
  counterparty_name: ['partner name', 'gegenpartei', 'empfaenger', 'empfänger', 'absender'],
  counterparty_iban: ['partner iban', 'iban'],
  transaction_type: ['type', 'typ', 'transaktionstyp'],
  description: ['payment reference', 'verwendungszweck', 'beschreibung', 'description'],
  account_name: ['account name', 'konto'],
  amount: ['amount eur', 'amount (eur)', 'betrag', 'betrag eur', 'amount'],
};

const N26_STANDARD_MAPPING: Record<string, BankField> = {
  'Booking Date': 'transaction_date',
  'Value Date': 'value_date',
  'Partner Name': 'counterparty_name',
  'Partner Iban': 'counterparty_iban',
  Type: 'transaction_type',
  'Payment Reference': 'description',
  'Account Name': 'ignore',
  'Amount (EUR)': 'amount',
  'Original Amount': 'ignore',
  'Original Currency': 'ignore',
  'Exchange Rate': 'ignore',
};

const ORDER_MATCH_STATUSES: OrderStatus[] = ['ordered', 'paid', 'shipped'];

function now(): string {
  return new Date().toISOString();
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

function normalizeText(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function nullableText(value: string | null | undefined): string | null {
  const normalized = normalizeText(value);
  return normalized ? normalized : null;
}

function parseAmount(value: string | null | undefined): number {
  const normalized = (value ?? '').trim().replace(/[^\d,.-]/g, '');
  if (!normalized) return 0;
  const comma = normalized.lastIndexOf(',');
  const dot = normalized.lastIndexOf('.');
  const decimal = comma > dot ? ',' : '.';
  const prepared =
    decimal === ',' ? normalized.replace(/\./g, '').replace(',', '.') : normalized.replace(/,/g, '');
  return Number.parseFloat(prepared);
}

function dbDescription(value: string | null): string {
  // Migration 0008 created bank_transactions.description as NOT NULL.
  // The importer treats empty N26 Payment Reference as nullable and stores
  // an empty DB value until the schema is relaxed in a dedicated migration.
  return value ?? '';
}

function parseDateToISO(value: string): string | null {
  const trimmed = value.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(trimmed);
  if (iso) return normalizeDateParts(iso[1], iso[2], iso[3]);
  const german = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(trimmed);
  if (german) return normalizeDateParts(german[3], german[2], german[1]);
  const slashIso = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(trimmed);
  if (slashIso) return normalizeDateParts(slashIso[1], slashIso[2], slashIso[3]);
  return null;
}

function normalizeDateParts(yearValue: string, monthValue: string, dayValue: string): string | null {
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate.slice(0, 10)}T00:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function createPlaceholders(start: number, count: number): string {
  return Array.from({ length: count }, (_, index) => `$${start + index}`).join(', ');
}

function money(value: number): number {
  return Number(value.toFixed(2));
}

function rowToTransaction(row: Row): BankTransaction {
  const linkedOrder = (row.order_receipt_number as string | null | undefined) ?? null;
  const linkedExpense = (row.expense_vendor as string | null | undefined) ?? null;
  return {
    id: row.id as string,
    transaction_date: row.transaction_date as string,
    value_date: (row.value_date as string | null | undefined) ?? null,
    amount: Number(row.amount),
    description: row.description as string,
    counterparty_name: (row.counterparty_name as string | null | undefined) ?? null,
    counterparty_iban: (row.counterparty_iban as string | null | undefined) ?? null,
    transaction_type: (row.transaction_type as string | null | undefined) ?? null,
    matched_order_id: (row.matched_order_id as string | null | undefined) ?? null,
    matched_expense_id: (row.matched_expense_id as string | null | undefined) ?? null,
    match_confidence: (row.match_confidence as MatchConfidence | null | undefined) ?? null,
    is_payout: Boolean(row.is_payout),
    import_batch_id: row.import_batch_id as string,
    ignored: Boolean(row.ignored),
    notes: (row.notes as string | null | undefined) ?? null,
    created_at: row.created_at as string,
    linked_label: linkedOrder ?? linkedExpense,
  };
}

function rowToBatch(row: Row): BankImportBatch {
  return {
    id: row.id as string,
    source: row.source as string,
    imported_at: row.imported_at as string,
    filename: (row.filename as string | null | undefined) ?? null,
    transaction_count: Number(row.transaction_count),
    matched_count: Number(row.matched_count),
    date_range_start: (row.date_range_start as string | null | undefined) ?? null,
    date_range_end: (row.date_range_end as string | null | undefined) ?? null,
  };
}

export function parseBankCsv(content: string): ParsedBankCsv {
  const normalizedContent = content
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  const delimiter = detectDelimiter(normalizedContent);
  const rows = parseDelimitedRows(normalizedContent, delimiter)
    .map(trimTrailingEmptyCells)
    .filter((row) => row.some((cell) => cell.trim().length > 0));

  if (rows.length === 0) return { headers: [], rows: [] };

  const headers = rows[0].map((header, index) => header.trim() || `Spalte ${index + 1}`);
  return {
    headers,
    rows: rows.slice(1).map((row) => normalizeRowLength(row, headers.length)),
  };
}

export function isN26Csv(headers: string[]): boolean {
  const normalizedHeaders = headers.map(normalizeToken);
  return N26_HEADERS.every((header) => normalizedHeaders.includes(normalizeToken(header)));
}

export function autoMapBankColumns(headers: string[]): BankColumnMapping {
  if (isN26Csv(headers)) {
    return headers.reduce<BankColumnMapping>((mapping, header) => {
      const standardHeader = N26_HEADERS.find(
        (n26Header) => normalizeToken(n26Header) === normalizeToken(header),
      );
      mapping[header] = standardHeader ? N26_STANDARD_MAPPING[standardHeader] : 'ignore';
      return mapping;
    }, {});
  }

  return headers.reduce<BankColumnMapping>((mapping, header) => {
    mapping[header] = detectFieldForHeader(header);
    return mapping;
  }, {});
}

export function hasRequiredBankMapping(mapping: BankColumnMapping): boolean {
  const mapped = new Set(Object.values(mapping));
  return REQUIRED_FIELDS.every((field) => mapped.has(field));
}

export function mapRowToBankTransaction(
  row: string[],
  mapping: BankColumnMapping,
  rowNumber: number,
): BankTransactionMapResult {
  const values: Partial<Record<BankField, string>> = {};
  Object.values(mapping).forEach((field, index) => {
    if (field !== 'ignore' && values[field] === undefined) {
      values[field] = row[index] ?? '';
    }
  });

  const transactionDate = parseDateToISO(values.transaction_date ?? '');
  const valueDate = values.value_date ? parseDateToISO(values.value_date) : null;
  const amount = parseAmount(values.amount);
  const description = normalizeText(values.description);

  if (!transactionDate) {
    console.error('N26 CSV row skipped: missing transaction_date', {
      rowNumber,
      row,
      values,
    });
    return {
      transaction: null,
      skipReason: `Zeile ${rowNumber}: übersprungen (kein Buchungsdatum)`,
    };
  }
  if (Number.isNaN(amount)) {
    console.error('N26 CSV row skipped: invalid amount', {
      rowNumber,
      amountValue: values.amount,
      row,
      values,
    });
    return { transaction: null, skipReason: `Zeile ${rowNumber}: übersprungen (kein Betrag)` };
  }
  if (amount === 0) {
    console.error('N26 CSV row skipped: zero amount', {
      rowNumber,
      amountValue: values.amount,
      row,
      values,
    });
    return { transaction: null, skipReason: `Zeile ${rowNumber}: übersprungen (Betrag 0)` };
  }

  return {
    transaction: {
      rowNumber,
      transaction_date: transactionDate,
      value_date: valueDate,
      amount,
      description: description || null,
      counterparty_name: nullableText(values.counterparty_name),
      counterparty_iban: nullableText(values.counterparty_iban),
      transaction_type: nullableText(values.transaction_type),
    },
    skipReason: null,
  };
}

export async function importBankCsv(input: BankImportInput): Promise<BankImportResult> {
  const db = getDatabase();
  const batchId = crypto.randomUUID();
  const timestamp = now();
  const result: BankImportResult = {
    batchId,
    imported: 0,
    skipped: 0,
    skippedRows: [],
    errors: [],
  };
  const mappedRows: BankTransactionInput[] = [];

  for (const [index, row] of input.csv.rows.entries()) {
    try {
      const mapped = mapRowToBankTransaction(row, input.mapping, index + 2);
      if (mapped.transaction) {
        mappedRows.push(mapped.transaction);
        continue;
      }
      result.skipped++;
      if (mapped.skipReason) {
        result.skippedRows.push(mapped.skipReason);
        result.errors.push(mapped.skipReason);
      }
    } catch (error) {
      const message = `Zeile ${index + 2}: übersprungen (${error instanceof Error ? error.message : String(error)})`;
      console.error('N26 CSV row mapping failed', {
        rowNumber: index + 2,
        row,
        mapping: input.mapping,
        error,
      });
      result.skipped++;
      result.skippedRows.push(message);
      result.errors.push(message);
    }
  }

  const dates = mappedRows.map((row) => row.transaction_date).sort();

  await db.execute(
    `INSERT INTO import_batches (
      id, source, imported_at, filename, transaction_count, matched_count,
      date_range_start, date_range_end
    ) VALUES ($1, 'n26', $2, $3, 0, 0, $4, $5)`,
    [batchId, timestamp, input.fileName, dates[0] ?? null, dates[dates.length - 1] ?? null],
  );

  for (const row of mappedRows) {
    try {
      const duplicateRows = await db.select<{ id: string }[]>(
        `SELECT id
         FROM bank_transactions
         WHERE transaction_date = $1
           AND amount = $2
           AND COALESCE(description, '') = $3
         LIMIT 1`,
        [row.transaction_date, row.amount, dbDescription(row.description)],
      );

      if (duplicateRows.length > 0) {
        result.skipped++;
        result.skippedRows.push(`Zeile ${row.rowNumber}: übersprungen (Duplikat)`);
        continue;
      }

      await db.execute(
        `INSERT INTO bank_transactions (
          id, transaction_date, value_date, amount, description, counterparty_name,
          counterparty_iban, transaction_type, matched_order_id, matched_expense_id,
          match_confidence, is_payout, import_batch_id, ignored, notes, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, NULL, NULL, NULL, 0, $9, 0, NULL, $10
        )`,
        [
          crypto.randomUUID(),
          row.transaction_date,
          row.value_date,
          row.amount,
          dbDescription(row.description),
          row.counterparty_name,
          row.counterparty_iban,
          row.transaction_type,
          batchId,
          timestamp,
        ],
      );
      result.imported++;
    } catch (error) {
      const message = `Zeile ${row.rowNumber}: übersprungen (${error instanceof Error ? error.message : String(error)})`;
      console.error('N26 CSV row insert failed', {
        rowNumber: row.rowNumber,
        transactionDate: row.transaction_date,
        valueDate: row.value_date,
        amount: row.amount,
        description: row.description,
        counterpartyName: row.counterparty_name,
        counterpartyIban: row.counterparty_iban,
        transactionType: row.transaction_type,
        error,
      });
      result.skipped++;
      result.skippedRows.push(message);
      result.errors.push(message);
      continue;
    }
  }

  await db.execute('UPDATE import_batches SET transaction_count = $1 WHERE id = $2', [
    result.imported,
    batchId,
  ]);

  return result;
}

export async function runAutoMatching(batchId: string): Promise<AutoMatchingResult> {
  const db = getDatabase();
  const rows = await db.select<Row[]>('SELECT * FROM bank_transactions WHERE import_batch_id = $1', [
    batchId,
  ]);
  const transactions = rows.map(rowToTransaction);
  const result: AutoMatchingResult = { batchId, matched: 0, payouts: 0, unmatched: 0 };

  for (const transaction of transactions) {
    if (transaction.matched_order_id || transaction.matched_expense_id || transaction.ignored) {
      continue;
    }

    const payoutPlatform = await detectPayoutPlatform(transaction);
    if (transaction.amount > 0 && payoutPlatform) {
      const allocations = await findPayoutAllocations(transaction, payoutPlatform);
      const allocationTotal = money(
        allocations.reduce((sum, allocation) => sum + allocation.allocatedAmount, 0),
      );
      const maxDiff = Math.max(Math.abs(transaction.amount) * 0.01, 0.01);

      if (allocations.length > 0 && Math.abs(allocationTotal - Math.abs(transaction.amount)) <= maxDiff) {
        await savePayoutSuggestion(transaction.id, allocations);
        await db.execute(
          'UPDATE bank_transactions SET is_payout = 1, match_confidence = $1 WHERE id = $2',
          ['high', transaction.id],
        );
        result.matched++;
        result.payouts++;
        continue;
      }

      await db.execute(
        'UPDATE bank_transactions SET is_payout = 1, match_confidence = $1 WHERE id = $2',
        ['low', transaction.id],
      );
      result.unmatched++;
      continue;
    }

    const suggestions =
      transaction.amount >= 0
        ? await getOrderMatchSuggestions(transaction)
        : await getExpenseMatchSuggestions(transaction);
    const best = suggestions[0];

    if (best) {
      await db.execute('UPDATE bank_transactions SET match_confidence = $1 WHERE id = $2', [
        best.confidence,
        transaction.id,
      ]);
      result.matched++;
    } else {
      await db.execute('UPDATE bank_transactions SET match_confidence = $1 WHERE id = $2', [
        'unmatched',
        transaction.id,
      ]);
      result.unmatched++;
    }
  }

  await db.execute('UPDATE import_batches SET matched_count = $1 WHERE id = $2', [
    result.matched,
    batchId,
  ]);

  return result;
}

export async function getBankTransactions(options: {
  filter?: BankTransactionFilter;
  batchId?: string | null;
  matchStatus?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  onlyUnmatched?: boolean;
} = {}): Promise<BankTransaction[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.filter === 'income') conditions.push('bt.amount > 0');
  if (options.filter === 'expense') conditions.push('bt.amount < 0');
  if (options.batchId) {
    params.push(options.batchId);
    conditions.push(`bt.import_batch_id = $${params.length}`);
  }
  if (options.matchStatus) {
    params.push(options.matchStatus);
    conditions.push(`COALESCE(bt.match_confidence, 'unmatched') = $${params.length}`);
  }
  if (options.dateFrom) {
    params.push(options.dateFrom);
    conditions.push(`bt.transaction_date >= $${params.length}`);
  }
  if (options.dateTo) {
    params.push(options.dateTo);
    conditions.push(`bt.transaction_date <= $${params.length}`);
  }
  if (options.onlyUnmatched) {
    conditions.push(`bt.ignored = 0`);
    conditions.push(`bt.matched_order_id IS NULL`);
    conditions.push(`bt.matched_expense_id IS NULL`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await getDatabase().select<Row[]>(
    `SELECT bt.*, o.receipt_number AS order_receipt_number, e.vendor AS expense_vendor
     FROM bank_transactions bt
     LEFT JOIN orders o ON o.id = bt.matched_order_id
     LEFT JOIN expenses e ON e.id = bt.matched_expense_id
     ${where}
     ORDER BY bt.transaction_date DESC, bt.created_at DESC`,
    params,
  );

  return rows.map(rowToTransaction);
}

export async function getImportBatches(): Promise<BankImportBatch[]> {
  const rows = await getDatabase().select<Row[]>(
    'SELECT * FROM import_batches ORDER BY imported_at DESC',
  );
  return rows.map(rowToBatch);
}

export async function getMatchSuggestions(transactionId: string): Promise<MatchSuggestion[]> {
  const transaction = await getTransactionById(transactionId);
  if (!transaction) return [];

  if (transaction.is_payout) {
    const allocations = await getPayoutAllocations(transactionId);
    if (allocations.length > 0) {
      return [
        {
          id: transactionId,
          type: 'payout',
          label: `Sammelauszahlung (${allocations.length} Aufträge)`,
          subtitle: allocations.map((allocation) => allocation.receiptNumber).join(', '),
          amount: money(allocations.reduce((sum, allocation) => sum + allocation.allocatedAmount, 0)),
          date: transaction.transaction_date,
          confidence: transaction.match_confidence === 'high' ? 'high' : 'low',
        },
      ];
    }
  }

  return transaction.amount >= 0
    ? getOrderMatchSuggestions(transaction)
    : getExpenseMatchSuggestions(transaction);
}

export async function getPayoutAllocations(transactionId: string): Promise<PayoutAllocation[]> {
  const rows = await getDatabase().select<Row[]>(
    `SELECT bpo.order_id, bpo.allocated_amount, o.receipt_number, o.order_date, p.name AS product_name
     FROM bank_payout_orders bpo
     JOIN orders o ON o.id = bpo.order_id
     LEFT JOIN products p ON p.id = o.product_id
     WHERE bpo.bank_transaction_id = $1
     ORDER BY o.order_date ASC`,
    [transactionId],
  );
  return rows.map((row) => ({
    orderId: row.order_id as string,
    receiptNumber: row.receipt_number as string,
    productName: (row.product_name as string | null | undefined) ?? null,
    orderDate: row.order_date as string,
    allocatedAmount: Number(row.allocated_amount),
  }));
}

export async function confirmMatch(
  transactionId: string,
  target: { orderId?: string; expenseId?: string },
): Promise<ConfirmMatchResult> {
  const db = getDatabase();
  const transaction = await getTransactionById(transactionId);
  if (!transaction) throw new Error('Banktransaktion nicht gefunden');

  await db.execute('BEGIN IMMEDIATE');
  try {
    if (target.orderId) {
      const orderRows = await db.select<Row[]>(
        'SELECT id, receipt_number, status FROM orders WHERE id = $1 LIMIT 1',
        [target.orderId],
      );
      const order = orderRows[0];
      if (!order) throw new Error('Auftrag nicht gefunden');

      await db.execute(
        `UPDATE bank_transactions
         SET matched_order_id = $1, matched_expense_id = NULL, match_confidence = 'manual'
         WHERE id = $2`,
        [target.orderId, transactionId],
      );
      await db.execute(
        `UPDATE orders
         SET payment_received_date = $1, bank_match_id = $2, payment_status = 'paid', updated_at = $3
         WHERE id = $4`,
        [transaction.transaction_date, transactionId, now(), target.orderId],
      );
      await db.execute('COMMIT');
      return {
        transactionId,
        orderId: target.orderId,
        expenseId: null,
        payoutOrderCount: 0,
        suggestPaidStatus: order.status === 'ordered',
        receiptNumber: order.receipt_number as string,
      };
    }

    if (target.expenseId) {
      await db.execute(
        `UPDATE bank_transactions
         SET matched_order_id = NULL, matched_expense_id = $1, match_confidence = 'manual'
         WHERE id = $2`,
        [target.expenseId, transactionId],
      );
      await db.execute(
        'UPDATE expenses SET bank_match_id = $1, updated_at = $2 WHERE id = $3',
        [transactionId, now(), target.expenseId],
      );
      await db.execute('COMMIT');
      return {
        transactionId,
        orderId: null,
        expenseId: target.expenseId,
        payoutOrderCount: 0,
        suggestPaidStatus: false,
        receiptNumber: null,
      };
    }

    throw new Error('Kein Match-Ziel angegeben');
  } catch (error) {
    await db.execute('ROLLBACK');
    throw error;
  }
}

export async function confirmPayoutMatch(
  transactionId: string,
  allocations: { orderId: string; allocatedAmount: number }[],
): Promise<ConfirmMatchResult> {
  const db = getDatabase();
  const transaction = await getTransactionById(transactionId);
  if (!transaction) throw new Error('Banktransaktion nicht gefunden');

  await db.execute('BEGIN IMMEDIATE');
  try {
    await db.execute('DELETE FROM bank_payout_orders WHERE bank_transaction_id = $1', [
      transactionId,
    ]);

    for (const allocation of allocations) {
      await db.execute(
        `INSERT INTO bank_payout_orders (
          id, bank_transaction_id, order_id, allocated_amount, created_at
        ) VALUES ($1, $2, $3, $4, $5)`,
        [crypto.randomUUID(), transactionId, allocation.orderId, allocation.allocatedAmount, now()],
      );
      await db.execute(
        `UPDATE orders
         SET payment_received_date = $1, bank_match_id = $2, payment_status = 'paid', updated_at = $3
         WHERE id = $4`,
        [transaction.transaction_date, transactionId, now(), allocation.orderId],
      );
    }

    await db.execute(
      `UPDATE bank_transactions
       SET is_payout = 1, match_confidence = 'manual', matched_order_id = NULL, matched_expense_id = NULL
       WHERE id = $1`,
      [transactionId],
    );
    await db.execute('COMMIT');

    return {
      transactionId,
      orderId: null,
      expenseId: null,
      payoutOrderCount: allocations.length,
      suggestPaidStatus: false,
      receiptNumber: null,
    };
  } catch (error) {
    await db.execute('ROLLBACK');
    throw error;
  }
}

export async function rejectMatch(transactionId: string): Promise<void> {
  const db = getDatabase();
  await db.execute('BEGIN IMMEDIATE');
  try {
    await db.execute(
      `UPDATE bank_transactions
       SET match_confidence = 'unmatched', matched_order_id = NULL, matched_expense_id = NULL
       WHERE id = $1`,
      [transactionId],
    );
    await db.execute('DELETE FROM bank_payout_orders WHERE bank_transaction_id = $1', [
      transactionId,
    ]);
    await db.execute('COMMIT');
  } catch (error) {
    await db.execute('ROLLBACK');
    throw error;
  }
}

export async function ignoreTransaction(transactionId: string): Promise<void> {
  await getDatabase().execute(
    `UPDATE bank_transactions
     SET ignored = 1, match_confidence = 'unmatched', matched_order_id = NULL, matched_expense_id = NULL
     WHERE id = $1`,
    [transactionId],
  );
}

export async function searchUnmatchedTransactions(filters: {
  description?: string;
  counterparty?: string;
  amount?: number | null;
}): Promise<BankTransaction[]> {
  const conditions = [
    'bt.ignored = 0',
    'bt.matched_order_id IS NULL',
    'bt.matched_expense_id IS NULL',
  ];
  const params: unknown[] = [];

  if (filters.description?.trim()) {
    params.push(`%${filters.description.trim()}%`);
    conditions.push(`bt.description LIKE $${params.length}`);
  }
  if (filters.counterparty?.trim()) {
    params.push(`%${filters.counterparty.trim()}%`);
    conditions.push(`bt.counterparty_name LIKE $${params.length}`);
  }
  if (filters.amount !== null && filters.amount !== undefined && Number.isFinite(filters.amount)) {
    params.push(filters.amount - 0.02);
    params.push(filters.amount + 0.02);
    conditions.push(`ABS(bt.amount) BETWEEN $${params.length - 1} AND $${params.length}`);
  }

  const rows = await getDatabase().select<Row[]>(
    `SELECT bt.*, NULL AS order_receipt_number, NULL AS expense_vendor
     FROM bank_transactions bt
     WHERE ${conditions.join(' AND ')}
     ORDER BY bt.transaction_date DESC
     LIMIT 100`,
    params,
  );
  return rows.map(rowToTransaction);
}

async function getTransactionById(id: string): Promise<BankTransaction | null> {
  const rows = await getDatabase().select<Row[]>(
    `SELECT bt.*, o.receipt_number AS order_receipt_number, e.vendor AS expense_vendor
     FROM bank_transactions bt
     LEFT JOIN orders o ON o.id = bt.matched_order_id
     LEFT JOIN expenses e ON e.id = bt.matched_expense_id
     WHERE bt.id = $1
     LIMIT 1`,
    [id],
  );
  return rows[0] ? rowToTransaction(rows[0]) : null;
}

async function detectPayoutPlatform(transaction: BankTransaction): Promise<OrderPlatform | null> {
  const haystack = normalizeToken(
    `${transaction.counterparty_name ?? ''} ${transaction.description}`,
  );
  const etsyKeywords = await getSetting<string[]>('payout_keywords_etsy');
  const ebayKeywords = await getSetting<string[]>('payout_keywords_ebay');

  if ((etsyKeywords ?? ['Etsy', 'Etsy Ireland', 'Etsy Inc']).some((keyword) => haystack.includes(normalizeToken(keyword)))) {
    return 'etsy';
  }
  if ((ebayKeywords ?? ['eBay', 'Ebay Marketplaces']).some((keyword) => haystack.includes(normalizeToken(keyword)))) {
    return 'ebay';
  }
  return null;
}

async function getOrderMatchSuggestions(transaction: BankTransaction): Promise<MatchSuggestion[]> {
  const tolerance = (await getSetting<number>('bank_match_amount_tolerance_eur')) ?? 0.02;
  const windowDays = (await getSetting<number>('bank_match_time_window_days_orders')) ?? 14;
  const rows = await getDatabase().select<Row[]>(
    `SELECT o.id, o.receipt_number, o.platform, o.customer_name, o.order_date,
            o.sale_price, o.shipping_revenue, p.name AS product_name
     FROM orders o
     LEFT JOIN products p ON p.id = o.product_id
     WHERE o.deleted_at IS NULL
       AND o.payment_received_date IS NULL
       AND o.status IN (${createPlaceholders(1, ORDER_MATCH_STATUSES.length)})
       AND o.order_date <= $${ORDER_MATCH_STATUSES.length + 1}
       AND date(o.order_date, '+' || $${ORDER_MATCH_STATUSES.length + 2} || ' days') >= $${ORDER_MATCH_STATUSES.length + 1}`,
    [...ORDER_MATCH_STATUSES, transaction.transaction_date, windowDays],
  );
  const description = normalizeToken(
    `${transaction.description} ${transaction.counterparty_name ?? ''}`,
  );

  return rows
    .map((row): MatchSuggestion | null => {
      const expected = money(Number(row.sale_price) + Number(row.shipping_revenue ?? 0));
      const diff = Math.abs(expected - Math.abs(transaction.amount));
      if (diff > tolerance) return null;
      const platform = row.platform as OrderPlatform;
      const exact = diff < 0.005;
      const hasTextMatch =
        description.includes(normalizeToken(platform)) ||
        description.includes(normalizeToken((row.customer_name as string | null) ?? ''));
      const confidence: MatchSuggestion['confidence'] =
        exact && hasTextMatch ? 'high' : exact ? 'medium' : 'low';

      return {
        id: row.id as string,
        type: 'order',
        label: row.receipt_number as string,
        subtitle: (row.product_name as string | null) ?? (row.customer_name as string | null) ?? platform,
        amount: expected,
        date: row.order_date as string,
        confidence,
      };
    })
    .filter((suggestion): suggestion is MatchSuggestion => suggestion !== null)
    .sort(compareSuggestions);
}

async function getExpenseMatchSuggestions(
  transaction: BankTransaction,
): Promise<MatchSuggestion[]> {
  const tolerance = (await getSetting<number>('bank_match_amount_tolerance_eur')) ?? 0.02;
  const windowDays = (await getSetting<number>('bank_match_time_window_days_expenses')) ?? 7;
  const rows = await getDatabase().select<Row[]>(
    `SELECT id, date, amount_gross, vendor, category, purpose
     FROM expenses
     WHERE deleted_at IS NULL
       AND bank_match_id IS NULL
       AND date >= $1
       AND date <= $2`,
    [addDays(transaction.transaction_date, -windowDays), addDays(transaction.transaction_date, windowDays)],
  );
  const description = normalizeToken(
    `${transaction.description} ${transaction.counterparty_name ?? ''}`,
  );

  return rows
    .map((row): MatchSuggestion | null => {
      const expected = money(Number(row.amount_gross));
      const diff = Math.abs(expected - Math.abs(transaction.amount));
      if (diff > tolerance) return null;
      const exact = diff < 0.005;
      const vendor = row.vendor as string;
      const hasVendor = description.includes(normalizeToken(vendor));
      const confidence: MatchSuggestion['confidence'] =
        exact && hasVendor ? 'high' : exact ? 'medium' : 'low';
      return {
        id: row.id as string,
        type: 'expense',
        label: vendor,
        subtitle: (row.purpose as string | null) ?? (row.category as string),
        amount: expected,
        date: row.date as string,
        confidence,
      };
    })
    .filter((suggestion): suggestion is MatchSuggestion => suggestion !== null)
    .sort(compareSuggestions);
}

async function findPayoutAllocations(
  transaction: BankTransaction,
  platform: OrderPlatform,
): Promise<PayoutAllocation[]> {
  const rows = await getDatabase().select<Row[]>(
    `SELECT o.id, o.receipt_number, o.order_date, o.sale_price, o.platform_fee, p.name AS product_name
     FROM orders o
     LEFT JOIN products p ON p.id = o.product_id
     WHERE o.deleted_at IS NULL
       AND o.platform = $1
       AND o.payment_received_date IS NULL
       AND o.status IN ('ordered', 'paid', 'shipped')
       AND o.order_date >= $2
       AND o.order_date <= $3
     ORDER BY o.order_date ASC`,
    [platform, addDays(transaction.transaction_date, -21), transaction.transaction_date],
  );
  return rows.map((row) => ({
    orderId: row.id as string,
    receiptNumber: row.receipt_number as string,
    productName: (row.product_name as string | null | undefined) ?? null,
    orderDate: row.order_date as string,
    allocatedAmount: money(Number(row.sale_price) - Number(row.platform_fee ?? 0)),
  }));
}

async function savePayoutSuggestion(
  transactionId: string,
  allocations: PayoutAllocation[],
): Promise<void> {
  const db = getDatabase();
  await db.execute('DELETE FROM bank_payout_orders WHERE bank_transaction_id = $1', [
    transactionId,
  ]);
  for (const allocation of allocations) {
    await db.execute(
      `INSERT INTO bank_payout_orders (
        id, bank_transaction_id, order_id, allocated_amount, created_at
      ) VALUES ($1, $2, $3, $4, $5)`,
      [crypto.randomUUID(), transactionId, allocation.orderId, allocation.allocatedAmount, now()],
    );
  }
}

function compareSuggestions(left: MatchSuggestion, right: MatchSuggestion): number {
  const score = { high: 0, medium: 1, low: 2 };
  return score[left.confidence] - score[right.confidence] || left.date.localeCompare(right.date);
}

function detectFieldForHeader(header: string): BankField {
  const normalized = normalizeToken(header);
  for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [
    Exclude<BankField, 'ignore'>,
    readonly string[],
  ][]) {
    if (aliases.some((alias) => normalizeToken(alias) === normalized)) return field;
  }
  return 'ignore';
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
  return countDelimiterOutsideQuotes(sampleLine, ';') > countDelimiterOutsideQuotes(sampleLine, ',')
    ? ';'
    : ',';
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
    if (char === '"') inQuotes = !inQuotes;
    if (char === delimiter && !inQuotes) count++;
  }
  return count;
}

function trimTrailingEmptyCells(row: string[]): string[] {
  let lastIndex = row.length - 1;
  while (lastIndex >= 0 && row[lastIndex].trim() === '') lastIndex--;
  return row.slice(0, lastIndex + 1);
}

function normalizeRowLength(row: string[], length: number): string[] {
  return Array.from({ length }, (_, index) => (row[index] ?? '').trim());
}
