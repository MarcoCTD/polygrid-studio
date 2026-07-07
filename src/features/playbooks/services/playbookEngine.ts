/**
 * Playbook-Engine (Modul 13).
 *
 * Einziger Einstiegspunkt für echte Ausführungen ist
 * runPlaybooksForStatusChange(orderId, newStatus) – aufgerufen zentral im
 * Order-Service, wo der Auftragsstatus persistiert wird. Kanban, Detail-Panel
 * und jede künftige Quelle laufen damit über denselben Pfad.
 *
 * Harte Garantie: Diese Engine wirft niemals nach außen. Ein Playbook-Fehler
 * darf die Statusänderung des Auftrags weder blockieren noch zurückrollen.
 */
import { createExpense } from '@/features/expenses/services';
import { EXPENSE_CATEGORY_LABELS } from '@/features/expenses/constants';
import { createTask } from '@/features/tasks/services';
import { orderVariableValue, type OrderPickerRow } from '@/features/templates/variableRegistry';
import { getDatabase } from '@/services/database';
import { getSettingWithDefault } from '@/services/settings';
import {
  actionResultSchema,
  type ActionResult,
  type CreateExpenseAction,
  type CreateTaskAction,
  type Playbook,
  type PlaybookAction,
  type PlaybookRunStatus,
  type SuggestTemplateAction,
} from '../schemas';
import { rowToPlaybook } from './playbookService';

type Row = Record<string, unknown>;

/** Auftrags-Kontext, den die Engine für Variablen und Beträge braucht. */
interface OrderContext {
  id: string;
  platform: string;
  product_id: string | null;
  shipping_cost: number | null;
  platform_fee: number | null;
  /** Aufgelöste {{variablen}}-Werte für Templates. */
  variables: Record<string, string>;
}

export interface PlaybookRunSummary {
  run_id: string;
  playbook_id: string;
  playbook_name: string;
  status: PlaybookRunStatus;
  results: ActionResult[];
  /** Anzahl tatsächlich erstellter Entitäten (Aufgaben + Ausgaben). */
  created_count: number;
}

const TEMPLATE_VARIABLE_REGEX = /\{\{([^}]+)\}\}/g;

function now(): string {
  return new Date().toISOString();
}

function todayISODate(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(year, month - 1, day + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatEuro(amount: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}

function isUniqueConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /unique|constraint/i.test(message);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Ersetzt {{variablen}} über die zentrale Registry-Wertemenge.
 * Nicht auflösbare Variablen bleiben als Rohtext stehen und werden gemeldet.
 */
export function renderPlaybookTemplate(
  template: string,
  values: Record<string, string>,
): { text: string; unresolved: string[] } {
  const unresolved = new Set<string>();
  const text = template.replace(TEMPLATE_VARIABLE_REGEX, (match, rawName: string) => {
    const name = rawName.trim();
    const value = values[name]?.trim();
    if (value) return value;
    unresolved.add(name);
    return match;
  });
  return { text, unresolved: Array.from(unresolved) };
}

/**
 * Lädt den Auftrag und baut die Variablen-Werte gemäß Registry auf.
 * Soft-gelöschte Aufträge liefern null (kein Playbook-Lauf); der Produkt-Join
 * bleibt bewusst ohne deleted_at-Filter, damit {{produktname}} auch bei
 * inzwischen gelöschtem Produkt weiter auflösbar ist (wie getOrderById).
 */
async function loadOrderContext(orderId: string): Promise<OrderContext | null> {
  const rows = await getDatabase().select<Row[]>(
    `SELECT o.id, o.receipt_number, o.external_order_id, o.customer_name,
            o.tracking_number, o.platform, o.product_id, o.shipping_cost,
            o.platform_fee, p.name AS product_name
     FROM orders o
     LEFT JOIN products p ON p.id = o.product_id
     WHERE o.id = $1 AND o.deleted_at IS NULL
     LIMIT 1`,
    [orderId],
  );
  const row = rows[0];
  if (!row) return null;

  const pickerRow: OrderPickerRow = {
    id: row.id as string,
    receipt_number: (row.receipt_number as string | null) ?? null,
    external_order_id: (row.external_order_id as string | null) ?? null,
    customer_name: (row.customer_name as string | null) ?? null,
    tracking_number: (row.tracking_number as string | null) ?? null,
    platform: (row.platform as string | null) ?? null,
  };

  let companyName = '';
  try {
    companyName = String(await getSettingWithDefault('company_name'));
  } catch {
    // Firmenname ist optional – ohne Setting bleibt die Variable unaufgelöst.
  }

  const variables: Record<string, string> = {
    produktname: (row.product_name as string | null) ?? '',
    bestellnummer: orderVariableValue(pickerRow, 'order_number'),
    kundenname: orderVariableValue(pickerRow, 'customer_name'),
    trackingnummer: orderVariableValue(pickerRow, 'tracking_number'),
    plattform: orderVariableValue(pickerRow, 'platform'),
    datum: new Intl.DateTimeFormat('de-DE').format(new Date()),
    firmenname: companyName,
  };

  return {
    id: row.id as string,
    platform: (row.platform as string) ?? '',
    product_id: (row.product_id as string | null) ?? null,
    shipping_cost:
      row.shipping_cost === null || row.shipping_cost === undefined
        ? null
        : Number(row.shipping_cost),
    platform_fee:
      row.platform_fee === null || row.platform_fee === undefined ? null : Number(row.platform_fee),
    variables,
  };
}

function unresolvedNote(unresolved: string[]): string | null {
  return unresolved.length > 0
    ? `Nicht auflösbare Variablen: ${unresolved.map((name) => `{{${name}}}`).join(', ')}`
    : null;
}

/** Das Task-Schema erlaubt max. 200 Zeichen – nach Variablenersetzung kürzen statt fehlschlagen. */
const MAX_TASK_TITLE_LENGTH = 200;

async function executeCreateTask(
  action: CreateTaskAction,
  order: OrderContext,
  dryRun: boolean,
): Promise<ActionResult> {
  const { text: rendered, unresolved } = renderPlaybookTemplate(
    action.title_template,
    order.variables,
  );
  const title =
    rendered.length > MAX_TASK_TITLE_LENGTH
      ? `${rendered.slice(0, MAX_TASK_TITLE_LENGTH - 1)}…`
      : rendered;
  const dueDate =
    action.due_offset_days === null ? null : addDays(todayISODate(), action.due_offset_days);
  const note = unresolvedNote(unresolved);
  const preview = `Aufgabe „${title}“ (Priorität ${action.priority}, ${
    dueDate ? `fällig ${dueDate}` : 'ohne Fälligkeit'
  }${action.link_order ? ', mit Auftrag verknüpft' : ''})`;

  if (dryRun) {
    return actionResultSchema.parse({
      action_type: 'create_task',
      status: 'success',
      preview,
      message: note,
    });
  }

  const task = await createTask({
    title,
    priority: action.priority,
    status: 'todo',
    due_date: dueDate,
    order_id: action.link_order ? order.id : null,
  });

  return actionResultSchema.parse({
    action_type: 'create_task',
    status: 'success',
    entity_id: task.id,
    preview,
    message: note,
  });
}

const AMOUNT_SOURCE_LABELS: Record<'shipping_cost' | 'platform_fee', string> = {
  shipping_cost: 'Versandkosten',
  platform_fee: 'Plattformgebühr',
};

async function executeCreateExpense(
  action: CreateExpenseAction,
  order: OrderContext,
  playbookName: string,
  dryRun: boolean,
): Promise<ActionResult> {
  let amount: number | null = action.amount_gross;
  if (action.amount_source !== null) {
    amount = order[action.amount_source];
    if (amount === null || amount <= 0) {
      // Leerer Quellwert ist laut Spec kein Fehler: Aktion wird übersprungen.
      // 0 € zählt als leer (E13-06) – eine Null-Ausgabe wäre fachlich sinnlos.
      const label = AMOUNT_SOURCE_LABELS[action.amount_source];
      return actionResultSchema.parse({
        action_type: 'create_expense',
        status: 'skipped',
        message:
          amount === null
            ? `Übersprungen: ${label} sind am Auftrag nicht erfasst.`
            : `Übersprungen: ${label} betragen 0 € – es wird keine Ausgabe erstellt.`,
      });
    }
  }
  if (amount === null || amount <= 0) {
    return actionResultSchema.parse({
      action_type: 'create_expense',
      status: 'error',
      message: 'Kein gültiger Betrag konfiguriert.',
    });
  }

  const { text: purpose, unresolved } = renderPlaybookTemplate(
    action.purpose_template,
    order.variables,
  );
  const note = unresolvedNote(unresolved);
  const categoryLabel = EXPENSE_CATEGORY_LABELS[action.category] ?? action.category;
  const preview = `Ausgabe ${formatEuro(amount)} an „${action.vendor}“ (${categoryLabel}${
    purpose ? `, Zweck: ${purpose}` : ''
  })`;

  if (dryRun) {
    return actionResultSchema.parse({
      action_type: 'create_expense',
      status: 'success',
      preview,
      message: note,
    });
  }

  const expense = await createExpense({
    date: todayISODate(),
    amount_gross: amount,
    vendor: action.vendor,
    category: action.category,
    subcategory: action.subcategory,
    purpose: purpose || null,
    product_id: order.product_id,
    order_id: order.id,
    notes: `Automatisch erstellt durch Playbook „${playbookName}“`,
  });

  return actionResultSchema.parse({
    action_type: 'create_expense',
    status: 'success',
    entity_id: expense.id,
    preview,
    message: note,
  });
}

async function executeSuggestTemplate(
  action: SuggestTemplateAction,
  dryRun: boolean,
): Promise<ActionResult> {
  const rows = await getDatabase().select<Row[]>(
    'SELECT id, name FROM templates WHERE id = $1 AND deleted_at IS NULL LIMIT 1',
    [action.template_id],
  );
  const template = rows[0];
  if (!template) {
    return actionResultSchema.parse({
      action_type: 'suggest_template',
      status: 'error',
      message: 'Vorlage nicht gefunden oder gelöscht.',
    });
  }

  const templateName = template.name as string;
  return actionResultSchema.parse({
    action_type: 'suggest_template',
    status: 'success',
    template_id: template.id as string,
    template_name: templateName,
    preview: dryRun
      ? `Vorlage „${templateName}“ würde im Auftrags-Detail vorgeschlagen`
      : `Vorlage „${templateName}“ im Auftrags-Detail vorgeschlagen`,
  });
}

async function executeAction(
  action: PlaybookAction,
  order: OrderContext,
  playbookName: string,
  dryRun: boolean,
): Promise<ActionResult> {
  try {
    switch (action.type) {
      case 'create_task':
        return await executeCreateTask(action, order, dryRun);
      case 'create_expense':
        return await executeCreateExpense(action, order, playbookName, dryRun);
      case 'suggest_template':
        return await executeSuggestTemplate(action, dryRun);
    }
  } catch (error) {
    // Eine fehlgeschlagene Aktion bricht die restlichen Aktionen nicht ab.
    return actionResultSchema.parse({
      action_type: action.type,
      status: 'error',
      message: errorMessage(error),
    });
  }
}

/** success: alle ok · partial: mind. eine übersprungen/fehlgeschlagen · error: alle fehlgeschlagen */
function aggregateRunStatus(results: ActionResult[]): Exclude<PlaybookRunStatus, 'dry_run'> {
  if (results.length > 0 && results.every((result) => result.status === 'error')) return 'error';
  if (results.some((result) => result.status !== 'success')) return 'partial';
  return 'success';
}

async function insertRun(
  playbookId: string,
  orderId: string,
  triggerStatus: string,
  status: PlaybookRunStatus,
  results: ActionResult[],
): Promise<string> {
  const id = crypto.randomUUID();
  await getDatabase().execute(
    `INSERT INTO playbook_runs (id, playbook_id, order_id, trigger_status, status, results, executed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, playbookId, orderId, triggerStatus, status, JSON.stringify(results), now()],
  );
  return id;
}

async function hasExistingRun(
  playbookId: string,
  orderId: string,
  triggerStatus: string,
): Promise<boolean> {
  const rows = await getDatabase().select<{ id: string }[]>(
    `SELECT id FROM playbook_runs
     WHERE playbook_id = $1 AND order_id = $2 AND trigger_status = $3 AND status != 'dry_run'
     LIMIT 1`,
    [playbookId, orderId, triggerStatus],
  );
  return rows.length > 0;
}

function matchesPlatformFilter(playbook: Playbook, platform: string): boolean {
  return (
    playbook.platform_filter === null ||
    playbook.platform_filter.length === 0 ||
    (playbook.platform_filter as string[]).includes(platform)
  );
}

async function executePlaybookRun(
  playbook: Playbook,
  order: OrderContext,
  triggerStatus: string,
): Promise<PlaybookRunSummary | null> {
  // Idempotenz-Vorprüfung; der Unique-Index sichert Race-Fälle zusätzlich ab.
  if (await hasExistingRun(playbook.id, order.id, triggerStatus)) return null;

  const results: ActionResult[] = [];
  for (const action of playbook.actions) {
    results.push(await executeAction(action, order, playbook.name, false));
  }

  const status = aggregateRunStatus(results);
  let runId: string;
  try {
    runId = await insertRun(playbook.id, order.id, triggerStatus, status, results);
  } catch (error) {
    if (isUniqueConstraintError(error)) return null;
    throw error;
  }

  return {
    run_id: runId,
    playbook_id: playbook.id,
    playbook_name: playbook.name,
    status,
    results,
    created_count: results.filter((result) => result.entity_id !== null).length,
  };
}

/**
 * Zentraler Einstiegspunkt: Führt alle passenden Playbooks für eine
 * Auftrags-Statusänderung aus. Wirft niemals – Fehler landen im Log
 * (console.error) und ggf. als error-Run, die Statusänderung bleibt unberührt.
 */
export async function runPlaybooksForStatusChange(
  orderId: string,
  newStatus: string,
): Promise<PlaybookRunSummary[]> {
  try {
    const rows = await getDatabase().select<Row[]>(
      `SELECT * FROM playbooks
       WHERE deleted_at IS NULL AND enabled = 1 AND trigger_status = $1
       ORDER BY created_at ASC, id ASC`,
      [newStatus],
    );
    if (rows.length === 0) return [];

    const order = await loadOrderContext(orderId);
    if (!order) return [];

    const summaries: PlaybookRunSummary[] = [];
    for (const row of rows) {
      try {
        const playbook = rowToPlaybook(row);
        if (!matchesPlatformFilter(playbook, order.platform)) continue;

        const summary = await executePlaybookRun(playbook, order, newStatus);
        if (summary) summaries.push(summary);
      } catch (error) {
        // Ein defektes Playbook stoppt die übrigen nicht.
        console.error('[Playbooks] Playbook-Ausführung fehlgeschlagen', {
          playbookId: row.id,
          orderId,
          error,
        });
      }
    }
    return summaries;
  } catch (error) {
    console.error('[Playbooks] Engine-Fehler bei Statusänderung', { orderId, newStatus, error });
    return [];
  }
}

/**
 * Dry-Run gegen einen wählbaren Auftrag: nichts wird geschrieben, der Run
 * wird mit status=dry_run geloggt (vom Idempotenz-Index ausgenommen).
 * Läuft unabhängig von enabled/Plattform-Filter, meldet aber, wenn der
 * Filter den Auftrag im Echtbetrieb ausschließen würde.
 */
export async function runPlaybookDryRun(
  playbook: Playbook,
  orderId: string,
): Promise<PlaybookRunSummary> {
  try {
    const order = await loadOrderContext(orderId);
    if (!order) throw new Error('Auftrag nicht gefunden.');

    const results: ActionResult[] = [];
    for (const action of playbook.actions) {
      results.push(await executeAction(action, order, playbook.name, true));
    }

    if (!matchesPlatformFilter(playbook, order.platform)) {
      results.push(
        actionResultSchema.parse({
          action_type: playbook.actions[0]?.type ?? 'create_task',
          status: 'skipped',
          message:
            'Hinweis: Der Plattform-Filter dieses Playbooks würde diesen Auftrag im Echtbetrieb ausschließen.',
        }),
      );
    }

    const runId = await insertRun(
      playbook.id,
      order.id,
      playbook.trigger_status,
      'dry_run',
      results,
    );

    return {
      run_id: runId,
      playbook_id: playbook.id,
      playbook_name: playbook.name,
      status: 'dry_run',
      results,
      created_count: 0,
    };
  } catch (error) {
    throw new Error(`Dry-Run konnte nicht ausgeführt werden: ${errorMessage(error)}`);
  }
}
