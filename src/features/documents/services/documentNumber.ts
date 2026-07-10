/**
 * Nummernkreise für Angebote und Rechnungen (Modul 17, Spec Abschnitt 3).
 *
 * Analog zur Belegnummern-Generierung aus Modul 08 (receiptNumber.ts):
 * - pro Typ und Jahr fortlaufend, Vergabe ausschließlich beim Ausstellen
 * - Drafts haben keine Nummer, verworfene Drafts erzeugen daher keine Lücken
 * - vergebene Nummern werden nie wiederverwendet (Storno zählt weiter)
 * - parallele Aufrufe sind über eine Promise-Queue serialisiert, zusätzlich
 *   merkt sich ein Reservierungs-Cache pro DB-Instanz bereits vergebene,
 *   aber noch nicht persistierte Zähler
 *
 * Format ist bewusst NUR über Konstanten konfigurierbar (Spec: Stabilität):
 * Angebote A-JJJJ-NNN, Rechnungen R-JJJJ-NNN.
 */
import type { DocumentType } from '../schemas';

export interface DocumentNumberDatabase {
  select<T>(query: string, bindValues?: unknown[]): Promise<T>;
  execute(query: string, bindValues?: unknown[]): Promise<unknown>;
}

interface MaxDocumentCounterRow {
  max_counter: number | string | null;
}

export const DOCUMENT_NUMBER_PREFIXES: Record<DocumentType, string> = {
  quote: 'A',
  invoice: 'R',
};

const MIN_COUNTER_DIGITS = 3;

/** Position des Zählers in "X-JJJJ-NNN" (1-basiert für SQLite substr). */
const COUNTER_START_INDEX = 8;

let generationQueue: Promise<void> = Promise.resolve();
const reservedCounters = new WeakMap<object, Map<string, number>>();

export async function generateDocumentNumber(
  db: DocumentNumberDatabase,
  type: DocumentType,
  year: number,
): Promise<string> {
  return runExclusive(() => generateWithoutQueue(db, type, year));
}

async function generateWithoutQueue(
  db: DocumentNumberDatabase,
  type: DocumentType,
  year: number,
): Promise<string> {
  validateYear(year);

  const prefix = DOCUMENT_NUMBER_PREFIXES[type];
  const maxCounter = await getMaxCounter(db, prefix, year);
  const reservationKey = `${prefix}-${year}`;
  const reservedCounter = getReservedCounter(db, reservationKey);
  const nextCounter = Math.max(maxCounter, reservedCounter) + 1;
  setReservedCounter(db, reservationKey, nextCounter);
  return formatDocumentNumber(prefix, year, nextCounter);
}

async function getMaxCounter(
  db: DocumentNumberDatabase,
  prefix: string,
  year: number,
): Promise<number> {
  const rows = await db.select<MaxDocumentCounterRow[]>(
    `SELECT MAX(CAST(substr(number, ${COUNTER_START_INDEX}) AS INTEGER)) AS max_counter
     FROM documents
     WHERE number LIKE $1`,
    [`${prefix}-${year}-%`],
  );

  const rawCounter = rows[0]?.max_counter ?? null;
  if (rawCounter === null) return 0;

  const parsed = typeof rawCounter === 'number' ? rawCounter : Number(rawCounter);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatDocumentNumber(prefix: string, year: number, counter: number): string {
  const digits = Math.max(MIN_COUNTER_DIGITS, String(counter).length);
  return `${prefix}-${year}-${String(counter).padStart(digits, '0')}`;
}

function validateYear(year: number): void {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    throw new Error('Jahr für Dokumentnummer muss vierstellig sein.');
  }
}

function getReservedCounter(db: DocumentNumberDatabase, key: string): number {
  return reservedCounters.get(db)?.get(key) ?? 0;
}

function setReservedCounter(db: DocumentNumberDatabase, key: string, counter: number): void {
  const existing = reservedCounters.get(db);
  if (existing) {
    existing.set(key, counter);
    return;
  }

  reservedCounters.set(db, new Map([[key, counter]]));
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

export function resetDocumentNumberGeneratorForTests(): void {
  generationQueue = Promise.resolve();
}
