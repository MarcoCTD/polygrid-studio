export interface ReceiptNumberDatabase {
  select<T>(query: string, bindValues?: unknown[]): Promise<T>;
  execute(query: string, bindValues?: unknown[]): Promise<unknown>;
}

interface MaxReceiptCounterRow {
  max_counter: number | string | null;
}

const MIN_COUNTER_DIGITS = 4;

let generationQueue: Promise<void> = Promise.resolve();
const reservedCounters = new WeakMap<object, Map<number, number>>();

export async function generateReceiptNumber(
  db: ReceiptNumberDatabase,
  year: number,
  options: { useExistingTransaction?: boolean } = {},
): Promise<string> {
  return runExclusive(() => generateReceiptNumberInTransaction(db, year, options));
}

async function generateReceiptNumberInTransaction(
  db: ReceiptNumberDatabase,
  year: number,
  options: { useExistingTransaction?: boolean },
): Promise<string> {
  validateYear(year);

  if (options.useExistingTransaction) {
    const maxCounter = await getMaxCounter(db, year);
    const reservedCounter = getReservedCounter(db, year);
    const nextCounter = Math.max(maxCounter, reservedCounter) + 1;
    setReservedCounter(db, year, nextCounter);
    return formatReceiptNumber(year, nextCounter);
  }

  await db.execute('BEGIN IMMEDIATE');
  try {
    const maxCounter = await getMaxCounter(db, year);
    const reservedCounter = getReservedCounter(db, year);
    const nextCounter = Math.max(maxCounter, reservedCounter) + 1;
    setReservedCounter(db, year, nextCounter);
    await db.execute('COMMIT');
    return formatReceiptNumber(year, nextCounter);
  } catch (err) {
    await db.execute('ROLLBACK').catch(() => undefined);
    throw err;
  }
}

async function getMaxCounter(db: ReceiptNumberDatabase, year: number): Promise<number> {
  const rows = await db.select<MaxReceiptCounterRow[]>(
    `SELECT MAX(CAST(substr(receipt_number, 6) AS INTEGER)) AS max_counter
     FROM orders
     WHERE receipt_number LIKE $1`,
    [`${year}-%`],
  );

  const rawCounter = rows[0]?.max_counter ?? null;
  if (rawCounter === null) return 0;

  const parsed = typeof rawCounter === 'number' ? rawCounter : Number(rawCounter);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatReceiptNumber(year: number, counter: number): string {
  const digits = Math.max(MIN_COUNTER_DIGITS, String(counter).length);
  return `${year}-${String(counter).padStart(digits, '0')}`;
}

function validateYear(year: number): void {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    throw new Error('Jahr für Belegnummer muss vierstellig sein.');
  }
}

function getReservedCounter(db: ReceiptNumberDatabase, year: number): number {
  return reservedCounters.get(db)?.get(year) ?? 0;
}

function setReservedCounter(db: ReceiptNumberDatabase, year: number, counter: number): void {
  const existing = reservedCounters.get(db);
  if (existing) {
    existing.set(year, counter);
    return;
  }

  reservedCounters.set(db, new Map([[year, counter]]));
}

async function runExclusive<T>(operation: () => Promise<T>): Promise<T> {
  const previous = generationQueue;
  let release: () => void = () => undefined;
  generationQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}

export function resetReceiptNumberGeneratorForTests(): void {
  generationQueue = Promise.resolve();
}
