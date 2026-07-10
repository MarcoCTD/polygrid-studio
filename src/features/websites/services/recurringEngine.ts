/**
 * Recurring-Engine für laufende Website-Posten (Modul 16).
 *
 * Läuft beim App-Start (nach DB-Init) und über den "Jetzt prüfen"-Button.
 * Für jeden aktiven Posten mit next_due <= heute wird pro fälliger Periode:
 * - bei cost_out eine Ausgabe über den bestehenden Expense-Service erzeugt
 * - bei price_in ein Auftrags-Entwurf über den bestehenden Order-Service
 *   (Plattform website, Status ordered, payment_status pending – NIE paid,
 *   der Nutzer bestätigt Zahlungseingang manuell)
 *
 * Idempotenz (dreifach abgesichert, analog Playbook-Engine light):
 * 1. last_generated_until am Posten – Perioden <= diesem Datum sind erledigt
 * 2. Ausgaben tragen import_ref = Posten-ID und das Fälligkeitsdatum
 * 3. Aufträge tragen external_order_id = "website:{postenId}:{datum}"
 * Damit erzeugt auch ein mehrfacher App-Start am selben Tag oder ein
 * Teilfehler (Ausgabe ok, Auftrag fehlgeschlagen) nie Duplikate.
 *
 * Harte Garantie: Diese Engine wirft niemals nach außen und blockiert
 * weder andere Posten noch den App-Start. Fehler landen im Ergebnis
 * (für Toasts) und im Log (console.error) – niemals Secrets im Log.
 */
import { createExpense } from '@/features/expenses/services';
import { createOrder } from '@/features/orders/services';
import { getDatabase } from '@/services/database';
import type { ExpenseSubcategory } from '@/features/expenses/constants';
import type { WebsiteService, WebsiteServiceInterval, WebsiteServiceType } from '../schemas';
import { rowToWebsiteService, updateWebsiteService } from './websiteServicesService';

type Row = Record<string, unknown>;

/** Maximal nachgeholte Perioden pro Posten und Lauf (Spec Abschnitt 3). */
export const MAX_CATCHUP_PERIODS = 12;

export interface WebsiteRecurringRunResult {
  expensesCreated: number;
  ordersCreated: number;
  /** Posten-Labels, bei denen ältere Perioden über das Limit hinaus verfallen sind. */
  cappedLabels: string[];
  /** Fehlermeldungen übersprungener Posten ("{label}: {Grund}"). */
  errors: string[];
}

const SERVICE_TYPE_TO_EXPENSE_SUBCATEGORY: Record<WebsiteServiceType, ExpenseSubcategory | null> = {
  hosting: 'hosting',
  domain: 'domain',
  wartung: 'wartung',
  sonstiges: null,
};

const PURPOSE_INTERVAL_LABELS: Record<WebsiteServiceInterval, string> = {
  monthly: 'monatlich',
  yearly: 'jährlich',
};

function toISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Monatsarithmetik mit Klemmung ans Monatsende (analog Expense-Service). */
function addMonthsClamped(dateValue: string, months: number): string {
  const [yearValue, monthValue, dayValue] = dateValue.split('-').map(Number);
  const targetMonthIndex = monthValue - 1 + months;
  const targetYear = yearValue + Math.floor(targetMonthIndex / 12);
  const normalizedMonthIndex = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(targetYear, normalizedMonthIndex + 1, 0).getDate();
  const targetDay = Math.min(dayValue, lastDay);

  return `${String(targetYear).padStart(4, '0')}-${String(normalizedMonthIndex + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
}

export function addWebsiteServiceInterval(
  dateValue: string,
  interval: WebsiteServiceInterval,
): string {
  return addMonthsClamped(dateValue, interval === 'yearly' ? 12 : 1);
}

function orderIdempotencyKey(serviceId: string, dueDate: string): string {
  return `website:${serviceId}:${dueDate}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Erzeugt die Ausgabe einer Periode, falls sie nicht bereits existiert. */
async function createExpenseForPeriod(service: WebsiteService, dueDate: string): Promise<boolean> {
  if (service.cost_out === null) return false;

  const existing = await getDatabase().select<{ id: string }[]>(
    `SELECT id FROM expenses
     WHERE import_ref = $1 AND date = $2 AND deleted_at IS NULL
     LIMIT 1`,
    [service.id, dueDate],
  );
  if (existing.length > 0) return false;

  await createExpense({
    date: dueDate,
    amount_gross: service.cost_out,
    vendor: service.cost_out_vendor ?? service.label,
    category: 'software_saas',
    subcategory: SERVICE_TYPE_TO_EXPENSE_SUBCATEGORY[service.type],
    purpose: `${service.label} ${PURPOSE_INTERVAL_LABELS[service.interval]}`,
    recurring: true,
    // recurring_interval/next_date bleiben bewusst leer: sonst würde die
    // Ausgaben-Recurring-Engine (Modul 04) den Posten zusätzlich fortschreiben.
    recurring_interval: null,
    recurring_next_date: null,
    import_source: 'recurring',
    import_ref: service.id,
  });
  return true;
}

/** Erzeugt den Auftrags-Entwurf einer Periode, falls er nicht bereits existiert. */
async function createOrderForPeriod(
  service: WebsiteService,
  clientName: string | null,
  dueDate: string,
): Promise<boolean> {
  if (service.price_in === null) return false;

  const key = orderIdempotencyKey(service.id, dueDate);
  const existing = await getDatabase().select<{ id: string }[]>(
    `SELECT id FROM orders WHERE external_order_id = $1 AND deleted_at IS NULL LIMIT 1`,
    [key],
  );
  if (existing.length > 0) return false;

  await createOrder({
    platform: 'website',
    external_order_id: key,
    customer_name: clientName,
    sale_price: service.price_in,
    status: 'ordered',
    payment_status: 'pending',
    order_date: dueDate,
    notes: `${service.label}, automatisch erzeugt`,
  });
  return true;
}

async function processService(
  service: WebsiteService,
  clientName: string | null,
  today: string,
  result: WebsiteRecurringRunResult,
): Promise<void> {
  // Alle fälligen Perioden ab next_due einsammeln
  const dueDates: string[] = [];
  let cursor = service.next_due;
  while (cursor <= today) {
    dueDates.push(cursor);
    cursor = addWebsiteServiceInterval(cursor, service.interval);
  }
  const nextDueAfterAll = cursor;

  // Bereits erzeugte Perioden überspringen (Idempotenz-Feld)
  let pending = service.last_generated_until
    ? dueDates.filter((date) => date > (service.last_generated_until as string))
    : dueDates;

  // Nachhol-Limit: nur die jüngsten Perioden erzeugen, ältere verfallen
  if (pending.length > MAX_CATCHUP_PERIODS) {
    pending = pending.slice(-MAX_CATCHUP_PERIODS);
    result.cappedLabels.push(service.label);
  }

  if (pending.length === 0) {
    // Nichts zu erzeugen (z.B. manuell zurückgesetztes next_due):
    // nur die Fälligkeit nach vorn schieben.
    await updateWebsiteService(service.id, { next_due: nextDueAfterAll });
    return;
  }

  for (const dueDate of pending) {
    const expenseCreated = await createExpenseForPeriod(service, dueDate);
    const orderCreated = await createOrderForPeriod(service, clientName, dueDate);
    if (expenseCreated) result.expensesCreated += 1;
    if (orderCreated) result.ordersCreated += 1;

    // Fortschritt pro Periode persistieren: bei einem Fehler in einer
    // späteren Periode bleiben erledigte Perioden erledigt.
    await updateWebsiteService(service.id, {
      last_generated_until: dueDate,
      next_due: addWebsiteServiceInterval(dueDate, service.interval),
    });
  }
}

/**
 * Zentraler Einstiegspunkt. Wirft niemals – das Ergebnis trägt Zähler,
 * Limit-Warnungen und Fehlermeldungen für die Toast-Ausgabe.
 *
 * Läufe sind serialisiert (Queue analog receiptNumber.runExclusive):
 * gleichzeitige Aufrufe – z.B. doppelter Init-Effekt im React-StrictMode
 * oder "Jetzt prüfen" während des App-Starts – warten aufeinander, der
 * spätere Lauf findet dank Idempotenz nichts mehr zu erzeugen.
 */
let engineQueue: Promise<unknown> = Promise.resolve();

export function runWebsiteRecurringEngine(now = new Date()): Promise<WebsiteRecurringRunResult> {
  const run = engineQueue.then(() => executeEngineRun(now));
  // Fehler des Vorgängers dürfen die Queue nicht vergiften (Engine wirft ohnehin nie).
  engineQueue = run.catch(() => undefined);
  return run;
}

async function executeEngineRun(now: Date): Promise<WebsiteRecurringRunResult> {
  const result: WebsiteRecurringRunResult = {
    expensesCreated: 0,
    ordersCreated: 0,
    cappedLabels: [],
    errors: [],
  };

  try {
    const today = toISODate(now);
    const rows = await getDatabase().select<Row[]>(
      `SELECT s.*, c.name AS client_name
       FROM website_services s
       JOIN clients c ON c.id = s.client_id
       WHERE s.deleted_at IS NULL
         AND s.active = 1
         AND s.next_due <= $1
       ORDER BY s.next_due ASC, s.created_at ASC`,
      [today],
    );

    for (const row of rows) {
      const label = String(row.label ?? 'Unbenannter Posten');
      try {
        const service = rowToWebsiteService(row);
        const clientName = (row.client_name as string | null | undefined) ?? null;
        await processService(service, clientName, today, result);
      } catch (error) {
        // Ein defekter Posten stoppt die übrigen nicht.
        const message = errorMessage(error);
        console.error('[WebsiteRecurring] Posten übersprungen', { label, message });
        result.errors.push(`${label}: ${message}`);
      }
    }

    if (
      result.expensesCreated > 0 ||
      result.ordersCreated > 0 ||
      result.cappedLabels.length > 0 ||
      result.errors.length > 0
    ) {
      console.info('[WebsiteRecurring] Lauf abgeschlossen', {
        expensesCreated: result.expensesCreated,
        ordersCreated: result.ordersCreated,
        capped: result.cappedLabels.length,
        errors: result.errors.length,
      });
    }
  } catch (error) {
    // Engine-Fehler (z.B. DB nicht erreichbar) blockieren niemals den App-Start.
    const message = errorMessage(error);
    console.error('[WebsiteRecurring] Engine-Fehler', { message });
    result.errors.push(`Website-Posten konnten nicht geprüft werden: ${message}`);
  }

  return result;
}
