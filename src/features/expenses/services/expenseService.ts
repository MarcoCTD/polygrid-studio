import { getDatabase } from '@/services/database';
import {
  createExpenseSchema,
  expenseFilterSchema,
  updateExpenseSchema,
  type CreateExpense,
  type Expense,
  type ExpenseFilter,
  type RecurringInterval,
  type UpdateExpense,
} from '../schemas';

const EXPENSE_UPDATE_FIELDS = [
  'date',
  'amount_gross',
  'amount_net',
  'tax_amount',
  'vendor',
  'category',
  'subcategory',
  'payment_method',
  'purpose',
  'product_id',
  'order_id',
  'receipt_attached',
  'receipt_file_path',
  'tax_relevant',
  'recurring',
  'recurring_interval',
  'recurring_next_date',
  'import_source',
  'import_ref',
  'notes',
] as const satisfies readonly (keyof UpdateExpense)[];

const SORT_COLUMNS = {
  date: 'date',
  amount_gross: 'amount_gross',
  vendor: 'vendor',
  category: 'category',
  created_at: 'created_at',
  updated_at: 'updated_at',
} as const;

function now(): string {
  return new Date().toISOString();
}

function monthRange(year: number, month: number): { start: string; end: string } {
  const normalizedMonth = Math.min(Math.max(month, 1), 12);
  const start = `${year}-${String(normalizedMonth).padStart(2, '0')}-01`;
  const nextYear = normalizedMonth === 12 ? year + 1 : year;
  const nextMonth = normalizedMonth === 12 ? 1 : normalizedMonth + 1;
  const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

  return { start, end };
}

function previousMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) {
    return { year: year - 1, month: 12 };
  }

  return { year, month: month - 1 };
}

export function calculateNextRecurringDate(
  startDate: string,
  interval: RecurringInterval,
  referenceDate = new Date(),
): string {
  let nextDate = addInterval(startDate, interval);
  const today = toISODate(referenceDate);

  while (nextDate <= today) {
    nextDate = addInterval(nextDate, interval);
  }

  return nextDate;
}

function rowToExpense(row: Record<string, unknown>): Expense {
  return {
    id: row.id as string,
    date: row.date as string,
    amount_gross: Number(row.amount_gross),
    amount_net:
      row.amount_net === null || row.amount_net === undefined ? null : Number(row.amount_net),
    tax_amount:
      row.tax_amount === null || row.tax_amount === undefined ? null : Number(row.tax_amount),
    vendor: row.vendor as string,
    category: row.category as Expense['category'],
    subcategory: (row.subcategory as Expense['subcategory']) ?? null,
    payment_method: (row.payment_method as Expense['payment_method']) ?? null,
    purpose: (row.purpose as string) ?? null,
    product_id: (row.product_id as string) ?? null,
    order_id: (row.order_id as string) ?? null,
    receipt_attached: Boolean(row.receipt_attached),
    receipt_file_path: (row.receipt_file_path as string) ?? null,
    tax_relevant: Boolean(row.tax_relevant),
    recurring: Boolean(row.recurring),
    recurring_interval: (row.recurring_interval as Expense['recurring_interval']) ?? null,
    recurring_next_date: (row.recurring_next_date as string) ?? null,
    import_source: (row.import_source as Expense['import_source']) ?? 'manual',
    import_ref: (row.import_ref as string) ?? null,
    tax_locked: Boolean(row.tax_locked),
    bank_match_id: (row.bank_match_id as string) ?? null,
    notes: (row.notes as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    deleted_at: (row.deleted_at as string) ?? null,
  };
}

export async function createExpense(data: CreateExpense): Promise<Expense> {
  const input = createExpenseSchema.parse(data);
  const db = getDatabase();
  const id = crypto.randomUUID();
  const timestamp = now();

  try {
    await checkDuplicate(input.date, input.amount_gross, input.vendor);

    await db.execute(
      `INSERT INTO expenses (
        id, date, amount_gross, amount_net, tax_amount, vendor, category, subcategory,
        payment_method, purpose, product_id, order_id, receipt_attached, receipt_file_path,
        tax_relevant, recurring, recurring_interval, recurring_next_date, import_source,
        import_ref, notes, created_at, updated_at, deleted_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21,
        $22, $23, $24
      )`,
      [
        id,
        input.date,
        input.amount_gross,
        input.amount_net ?? null,
        input.tax_amount ?? null,
        input.vendor,
        input.category,
        input.subcategory ?? null,
        input.payment_method ?? null,
        input.purpose ?? null,
        input.product_id ?? null,
        input.order_id ?? null,
        input.receipt_attached ?? false,
        input.receipt_file_path ?? null,
        input.tax_relevant ?? true,
        input.recurring ?? false,
        input.recurring_interval ?? null,
        input.recurring_next_date ?? null,
        input.import_source ?? 'manual',
        input.import_ref ?? null,
        input.notes ?? null,
        timestamp,
        timestamp,
        null,
      ],
    );

    const expense = await getExpenseById(id);
    if (!expense) {
      throw new Error(`Ausgabe mit ID ${id} nicht gefunden nach Erstellung`);
    }

    return expense;
  } catch (err) {
    throw new Error(
      `Ausgabe konnte nicht erstellt werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function updateExpense(id: string, data: UpdateExpense): Promise<Expense> {
  updateExpenseSchema.parse({ ...data, id });
  const db = getDatabase();
  const timestamp = now();
  const setClauses = ['updated_at = $1'];
  const params: unknown[] = [timestamp];
  let paramIndex = 2;

  for (const field of EXPENSE_UPDATE_FIELDS) {
    if (field in data) {
      setClauses.push(`${field} = $${paramIndex}`);
      params.push(data[field] ?? null);
      paramIndex++;
    }
  }

  if (setClauses.length === 1) {
    const existing = await getExpenseById(id);
    if (!existing) {
      throw new Error(`Ausgabe mit ID ${id} nicht gefunden`);
    }
    return existing;
  }

  params.push(id);

  try {
    await db.execute(
      `UPDATE expenses SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
      params,
    );

    const expense = await getExpenseById(id);
    if (!expense) {
      throw new Error(`Ausgabe mit ID ${id} nicht gefunden nach Update`);
    }

    return expense;
  } catch (err) {
    throw new Error(
      `Ausgabe konnte nicht aktualisiert werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function softDeleteExpense(id: string): Promise<void> {
  const db = getDatabase();
  const timestamp = now();

  try {
    await db.execute('UPDATE expenses SET deleted_at = $1, updated_at = $1 WHERE id = $2', [
      timestamp,
      id,
    ]);
  } catch (err) {
    throw new Error(
      `Ausgabe konnte nicht gelöscht werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function restoreExpense(id: string): Promise<void> {
  const db = getDatabase();
  const timestamp = now();

  try {
    await db.execute('UPDATE expenses SET deleted_at = NULL, updated_at = $1 WHERE id = $2', [
      timestamp,
      id,
    ]);
  } catch (err) {
    throw new Error(
      `Ausgabe konnte nicht wiederhergestellt werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function getExpenseById(id: string): Promise<Expense | null> {
  const db = getDatabase();

  try {
    const rows = await db.select<Record<string, unknown>[]>(
      'SELECT * FROM expenses WHERE id = $1',
      [id],
    );

    if (rows.length === 0) {
      return null;
    }

    return rowToExpense(rows[0]);
  } catch (err) {
    throw new Error(
      `Ausgabe konnte nicht geladen werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function getExpenses(filters: ExpenseFilter = {}): Promise<Expense[]> {
  const parsedFilters = expenseFilterSchema.parse(filters);
  const db = getDatabase();
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (!parsedFilters.include_deleted) {
    conditions.push('deleted_at IS NULL');
  }

  if (parsedFilters.date_from) {
    conditions.push(`date >= $${paramIndex}`);
    params.push(parsedFilters.date_from);
    paramIndex++;
  }

  if (parsedFilters.date_to) {
    conditions.push(`date <= $${paramIndex}`);
    params.push(parsedFilters.date_to);
    paramIndex++;
  }

  if (parsedFilters.category && parsedFilters.category.length > 0) {
    const placeholders = parsedFilters.category.map(() => `$${paramIndex++}`).join(', ');
    conditions.push(`category IN (${placeholders})`);
    params.push(...parsedFilters.category);
  }

  if (parsedFilters.tax_relevant !== undefined) {
    conditions.push(`tax_relevant = $${paramIndex}`);
    params.push(parsedFilters.tax_relevant ? 1 : 0);
    paramIndex++;
  }

  if (parsedFilters.receipt_attached !== undefined) {
    conditions.push(`receipt_attached = $${paramIndex}`);
    params.push(parsedFilters.receipt_attached ? 1 : 0);
    paramIndex++;
  }

  if (parsedFilters.product_id !== undefined) {
    if (parsedFilters.product_id === null) {
      conditions.push('product_id IS NULL');
    } else {
      conditions.push(`product_id = $${paramIndex}`);
      params.push(parsedFilters.product_id);
      paramIndex++;
    }
  }

  if (parsedFilters.has_product !== undefined) {
    conditions.push(parsedFilters.has_product ? 'product_id IS NOT NULL' : 'product_id IS NULL');
  }

  if (parsedFilters.search && parsedFilters.search.trim()) {
    const term = `%${parsedFilters.search.trim()}%`;
    conditions.push(
      `(vendor LIKE $${paramIndex} OR purpose LIKE $${paramIndex} OR notes LIKE $${paramIndex} OR category LIKE $${paramIndex} OR subcategory LIKE $${paramIndex})`,
    );
    params.push(term);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortBy = parsedFilters.sort_by ?? 'date';
  const sortDirection = parsedFilters.sort_direction === 'asc' ? 'ASC' : 'DESC';
  const limitClause =
    parsedFilters.limit !== undefined
      ? ` LIMIT ${parsedFilters.limit}`
      : parsedFilters.offset !== undefined
        ? ' LIMIT -1'
        : '';
  const offsetClause = parsedFilters.offset !== undefined ? ` OFFSET ${parsedFilters.offset}` : '';

  try {
    const rows = await db.select<Record<string, unknown>[]>(
      `SELECT * FROM expenses ${whereClause} ORDER BY ${SORT_COLUMNS[sortBy]} ${sortDirection}, created_at DESC${limitClause}${offsetClause}`,
      params,
    );

    return rows.map(rowToExpense);
  } catch (err) {
    throw new Error(
      `Ausgabenliste konnte nicht geladen werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function getMonthlySum(year: number, month: number): Promise<number> {
  const db = getDatabase();
  const { start, end } = monthRange(year, month);

  try {
    const rows = await db.select<{ total: number | null }[]>(
      `SELECT SUM(amount_gross) AS total
       FROM expenses
       WHERE deleted_at IS NULL AND date >= $1 AND date < $2`,
      [start, end],
    );

    return Number(rows[0]?.total ?? 0);
  } catch (err) {
    throw new Error(
      `Monatssumme konnte nicht berechnet werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function getCategoryBreakdown(
  year: number,
  month: number,
): Promise<{ category: string; total: number }[]> {
  const db = getDatabase();
  const { start, end } = monthRange(year, month);

  try {
    const rows = await db.select<{ category: string; total: number | null }[]>(
      `SELECT category, SUM(amount_gross) AS total
       FROM expenses
       WHERE deleted_at IS NULL AND date >= $1 AND date < $2
       GROUP BY category
       ORDER BY total DESC`,
      [start, end],
    );

    return rows.map((row) => ({
      category: row.category,
      total: Number(row.total ?? 0),
    }));
  } catch (err) {
    throw new Error(
      `Kategorieauswertung konnte nicht berechnet werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function getPreviousMonthSum(year: number, month: number): Promise<number> {
  const previous = previousMonth(year, month);
  return getMonthlySum(previous.year, previous.month);
}

export async function checkDuplicate(
  date: string,
  amount_gross: number,
  vendor: string,
): Promise<Expense | null> {
  const db = getDatabase();

  try {
    const rows = await db.select<Record<string, unknown>[]>(
      `SELECT * FROM expenses
       WHERE deleted_at IS NULL
         AND date = $1
         AND amount_gross = $2
         AND lower(vendor) = lower($3)
       LIMIT 1`,
      [date, amount_gross, vendor.trim()],
    );

    if (rows.length === 0) {
      return null;
    }

    return rowToExpense(rows[0]);
  } catch (err) {
    throw new Error(
      `Duplikatprüfung konnte nicht ausgeführt werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function processDueRecurringExpenses(): Promise<number> {
  const db = getDatabase();
  const today = toISODate(new Date());
  let createdCount = 0;

  try {
    const rows = await db.select<Record<string, unknown>[]>(
      `SELECT * FROM expenses
       WHERE deleted_at IS NULL
         AND recurring = 1
         AND recurring_interval IS NOT NULL
         AND recurring_next_date IS NOT NULL
         AND recurring_next_date <= $1
       ORDER BY recurring_next_date ASC, created_at ASC`,
      [today],
    );

    for (const row of rows) {
      const source = rowToExpense(row);
      if (!source.recurring_interval || !source.recurring_next_date) {
        continue;
      }

      const nextDate = calculateNextRecurringDate(
        source.recurring_next_date,
        source.recurring_interval,
      );
      const duplicate = await checkDuplicate(
        source.recurring_next_date,
        source.amount_gross,
        source.vendor,
      );

      if (!duplicate) {
        await createExpense({
          date: source.recurring_next_date,
          amount_gross: source.amount_gross,
          amount_net: source.amount_net,
          tax_amount: source.tax_amount,
          vendor: source.vendor,
          category: source.category,
          subcategory: source.subcategory,
          payment_method: source.payment_method,
          purpose: source.purpose,
          product_id: source.product_id,
          order_id: source.order_id,
          receipt_attached: false,
          receipt_file_path: null,
          tax_relevant: source.tax_relevant,
          recurring: true,
          recurring_interval: source.recurring_interval,
          recurring_next_date: nextDate,
          import_source: 'recurring',
          import_ref: source.id,
          notes: source.notes,
        });
        createdCount++;
      }

      await updateExpense(source.id, {
        recurring_next_date: nextDate,
      });
    }

    return createdCount;
  } catch (err) {
    throw new Error(
      `Wiederkehrende Ausgaben konnten nicht verarbeitet werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

function addInterval(dateValue: string, interval: RecurringInterval): string {
  if (interval === 'monthly') {
    return addMonths(dateValue, 1);
  }
  if (interval === 'quarterly') {
    return addMonths(dateValue, 3);
  }
  return addMonths(dateValue, 12);
}

function addMonths(dateValue: string, months: number): string {
  const [yearValue, monthValue, dayValue] = dateValue.split('-').map(Number);
  const targetMonthIndex = monthValue - 1 + months;
  const targetYear = yearValue + Math.floor(targetMonthIndex / 12);
  const normalizedMonthIndex = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(targetYear, normalizedMonthIndex + 1, 0).getDate();
  const targetDay = Math.min(dayValue, lastDay);

  return `${String(targetYear).padStart(4, '0')}-${String(normalizedMonthIndex + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
}

function toISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
