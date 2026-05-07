import { getDatabase } from '@/services/database';
import {
  taskCreateSchema,
  taskFilterSchema,
  taskSchema,
  taskUpdateSchema,
  type RecurringRule,
  type Task,
  type TaskCreate,
  type TaskFilter,
  type TaskUpdate,
} from '../schemas';
import { calculateNextDueDate } from '../utils/recurringHelpers';

const TASK_UPDATE_FIELDS = [
  'title',
  'description',
  'priority',
  'status',
  'due_date',
  'product_id',
  'order_id',
  'listing_id',
  'recurring_rule',
  'parent_task_id',
] as const satisfies readonly (keyof TaskUpdate)[];

type TaskRow = Record<string, unknown>;

function now(): string {
  return new Date().toISOString();
}

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

function createPlaceholders(start: number, count: number): string {
  return Array.from({ length: count }, (_, index) => `$${start + index}`).join(', ');
}

function parseRecurringRule(value: unknown): RecurringRule | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'object') return value as RecurringRule;
  if (typeof value !== 'string') return null;

  try {
    return JSON.parse(value) as RecurringRule;
  } catch {
    return null;
  }
}

function recurringRuleToDbValue(rule: RecurringRule | null | undefined): string | null {
  return rule ? JSON.stringify(rule) : null;
}

async function createRecurringSuccessor(task: Task): Promise<void> {
  if (!task.recurring_rule) return;

  await createTask({
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: 'todo',
    due_date: calculateNextDueDate(task.due_date, task.recurring_rule),
    product_id: task.product_id,
    order_id: task.order_id,
    listing_id: task.listing_id,
    recurring_rule: task.recurring_rule,
    parent_task_id: task.id,
  });
}

function rowToTask(row: TaskRow): Task {
  return taskSchema.parse({
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    priority: row.priority,
    status: row.status,
    due_date: row.due_date ?? null,
    product_id: row.product_id ?? null,
    order_id: row.order_id ?? null,
    listing_id: row.listing_id ?? null,
    recurring_rule: parseRecurringRule(row.recurring_rule),
    parent_task_id: row.parent_task_id ?? null,
    completed_at: row.completed_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at ?? null,
  });
}

function buildTaskWhere(
  filters?: TaskFilter,
  tableAlias = '',
): { where: string; params: unknown[] } {
  const input = filters ? taskFilterSchema.parse(filters) : undefined;
  const clauses: string[] = [];
  const params: unknown[] = [];
  const column = (name: string) => `${tableAlias}${name}`;

  if (!input?.includeDeleted) {
    clauses.push(`${column('deleted_at')} IS NULL`);
  }

  if (input?.status && input.status.length > 0) {
    clauses.push(
      `${column('status')} IN (${createPlaceholders(params.length + 1, input.status.length)})`,
    );
    params.push(...input.status);
  } else if (input?.includeDone === false) {
    clauses.push(`${column('status')} != 'done'`);
  }

  if (input?.priority && input.priority.length > 0) {
    clauses.push(
      `${column('priority')} IN (${createPlaceholders(params.length + 1, input.priority.length)})`,
    );
    params.push(...input.priority);
  }

  if (input?.dueDateFrom) {
    params.push(input.dueDateFrom);
    clauses.push(`${column('due_date')} >= $${params.length}`);
  }

  if (input?.dueDateTo) {
    params.push(input.dueDateTo);
    clauses.push(`${column('due_date')} <= $${params.length}`);
  }

  for (const field of ['product_id', 'order_id', 'listing_id', 'parent_task_id'] as const) {
    if (input?.[field]) {
      params.push(input[field]);
      clauses.push(`${column(field)} = $${params.length}`);
    }
  }

  if (input?.recurringOnly) {
    clauses.push(`${column('recurring_rule')} IS NOT NULL`);
  }

  return {
    where: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

export async function getAllTasks(filters?: TaskFilter): Promise<Task[]> {
  try {
    const { where, params } = buildTaskWhere(filters);
    const rows = await getDatabase().select<TaskRow[]>(
      `SELECT *
       FROM tasks
       ${where}
       ORDER BY
         CASE priority
           WHEN 'urgent' THEN 0
           WHEN 'high' THEN 1
           WHEN 'medium' THEN 2
           ELSE 3
         END,
         due_date IS NULL,
         due_date ASC,
         created_at DESC`,
      params,
    );

    return rows.map(rowToTask);
  } catch (error) {
    throw new Error(
      `Aufgaben konnten nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export interface TaskListItem extends Task {
  product_name: string | null;
  order_receipt_number: string | null;
  listing_title: string | null;
}

function rowToTaskListItem(row: TaskRow): TaskListItem {
  return {
    ...rowToTask(row),
    product_name: (row.product_name as string | null | undefined) ?? null,
    order_receipt_number: (row.order_receipt_number as string | null | undefined) ?? null,
    listing_title: (row.listing_title as string | null | undefined) ?? null,
  };
}

export async function getTaskListItems(filters?: TaskFilter): Promise<TaskListItem[]> {
  try {
    const { where, params } = buildTaskWhere(filters, 't.');
    const rows = await getDatabase().select<TaskRow[]>(
      `SELECT
         t.*,
         p.name AS product_name,
         o.receipt_number AS order_receipt_number,
         l.master_title AS listing_title
       FROM tasks t
       LEFT JOIN products p ON p.id = t.product_id
       LEFT JOIN orders o ON o.id = t.order_id
       LEFT JOIN listings l ON l.id = t.listing_id
       ${where}
       ORDER BY
         CASE t.priority
           WHEN 'urgent' THEN 0
           WHEN 'high' THEN 1
           WHEN 'medium' THEN 2
           ELSE 3
         END,
         t.due_date IS NULL,
         t.due_date ASC,
         t.created_at DESC`,
      params,
    );

    return rows.map(rowToTaskListItem);
  } catch (error) {
    throw new Error(
      `Aufgabenliste konnte nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function getTaskById(id: string): Promise<Task | null> {
  try {
    const rows = await getDatabase().select<TaskRow[]>(
      'SELECT * FROM tasks WHERE id = $1 LIMIT 1',
      [id],
    );
    return rows[0] ? rowToTask(rows[0]) : null;
  } catch (error) {
    throw new Error(
      `Aufgabe konnte nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function getTasksByDateRange(start: string, end: string): Promise<Task[]> {
  try {
    const rows = await getDatabase().select<TaskRow[]>(
      `SELECT *
       FROM tasks
       WHERE deleted_at IS NULL
         AND due_date >= $1
         AND due_date <= $2
       ORDER BY due_date ASC, created_at ASC`,
      [start, end],
    );
    return rows.map(rowToTask);
  } catch (error) {
    throw new Error(
      `Aufgaben im Zeitraum konnten nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function getUnscheduledTasks(includeDone = false): Promise<Task[]> {
  try {
    const rows = await getDatabase().select<TaskRow[]>(
      `SELECT *
       FROM tasks
       WHERE deleted_at IS NULL
         AND due_date IS NULL
         AND status IN (${includeDone ? "'todo', 'in_progress', 'done'" : "'todo', 'in_progress'"})
       ORDER BY created_at DESC`,
    );
    return rows.map(rowToTask);
  } catch (error) {
    throw new Error(
      `Ungeplante Aufgaben konnten nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function getOverdueTasks(): Promise<Task[]> {
  try {
    const rows = await getDatabase().select<TaskRow[]>(
      `SELECT *
       FROM tasks
       WHERE deleted_at IS NULL
         AND due_date < $1
         AND status IN ('todo', 'in_progress')
       ORDER BY due_date ASC, created_at ASC`,
      [todayISODate()],
    );
    return rows.map(rowToTask);
  } catch (error) {
    throw new Error(
      `Überfällige Aufgaben konnten nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function getOverdueCount(): Promise<number> {
  try {
    const rows = await getDatabase().select<{ count: number }[]>(
      `SELECT COUNT(*) AS count
       FROM tasks
       WHERE deleted_at IS NULL
         AND due_date < $1
         AND status IN ('todo', 'in_progress')`,
      [todayISODate()],
    );
    return rows[0]?.count ?? 0;
  } catch (error) {
    throw new Error(
      `Überfällige Aufgaben konnten nicht gezählt werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function createTask(data: TaskCreate): Promise<Task> {
  try {
    const input = taskCreateSchema.parse(data);
    const db = getDatabase();
    const id = crypto.randomUUID();
    const timestamp = now();

    await db.execute(
      `INSERT INTO tasks (
        id, title, description, priority, status, due_date, product_id, order_id,
        listing_id, recurring_rule, parent_task_id, completed_at, created_at,
        updated_at, deleted_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15
      )`,
      [
        id,
        input.title,
        input.description ?? null,
        input.priority,
        input.status,
        input.due_date ?? null,
        input.product_id ?? null,
        input.order_id ?? null,
        input.listing_id ?? null,
        recurringRuleToDbValue(input.recurring_rule),
        input.parent_task_id ?? null,
        null,
        timestamp,
        timestamp,
        null,
      ],
    );

    const task = await getTaskById(id);
    if (!task) throw new Error(`Aufgabe ${id} wurde nach Erstellung nicht gefunden.`);
    return task;
  } catch (error) {
    throw new Error(
      `Aufgabe konnte nicht erstellt werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function updateTask(id: string, data: TaskUpdate): Promise<Task> {
  try {
    const input = taskUpdateSchema.parse(data);
    const existing = await getTaskById(id);
    if (!existing) throw new Error(`Aufgabe ${id} nicht gefunden.`);

    const timestamp = now();
    const setClauses = ['updated_at = $1'];
    const params: unknown[] = [timestamp];
    const completesTask = input.status === 'done' && existing.status !== 'done';

    for (const field of TASK_UPDATE_FIELDS) {
      if (field in input) {
        setClauses.push(`${field} = $${params.length + 1}`);
        params.push(
          field === 'recurring_rule'
            ? recurringRuleToDbValue(input[field])
            : (input[field] ?? null),
        );
      }
    }

    if (completesTask) {
      setClauses.push(`completed_at = $${params.length + 1}`);
      params.push(timestamp);
    }

    if (setClauses.length === 1) return existing;

    params.push(id);
    await getDatabase().execute(
      `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = $${params.length}`,
      params,
    );

    const updated = await getTaskById(id);
    if (!updated) throw new Error(`Aufgabe ${id} wurde nach Update nicht gefunden.`);
    if (completesTask) {
      await createRecurringSuccessor(updated);
    }
    return updated;
  } catch (error) {
    throw new Error(
      `Aufgabe konnte nicht aktualisiert werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function softDeleteTask(id: string): Promise<void> {
  try {
    const timestamp = now();
    await getDatabase().execute('UPDATE tasks SET deleted_at = $1, updated_at = $1 WHERE id = $2', [
      timestamp,
      id,
    ]);
  } catch (error) {
    throw new Error(
      `Aufgabe konnte nicht gelöscht werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function completeTask(id: string): Promise<Task> {
  try {
    const existing = await getTaskById(id);
    if (!existing) throw new Error(`Aufgabe ${id} nicht gefunden.`);
    if (existing.status === 'done') return existing;

    const timestamp = now();
    await getDatabase().execute(
      `UPDATE tasks
       SET status = 'done', completed_at = $1, updated_at = $1
       WHERE id = $2`,
      [timestamp, id],
    );

    const completed = await getTaskById(id);
    if (!completed) throw new Error(`Aufgabe ${id} wurde nach Abschluss nicht gefunden.`);
    await createRecurringSuccessor(completed);
    return completed;
  } catch (error) {
    throw new Error(
      `Aufgabe konnte nicht abgeschlossen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function getRecurringHistory(taskId: string): Promise<Task[]> {
  try {
    const allTasks = await getAllTasks({ includeDeleted: true });
    const byId = new Map(allTasks.map((task) => [task.id, task]));
    const current = byId.get(taskId);
    if (!current) return [];

    const ancestors: Task[] = [];
    const seen = new Set<string>();
    let cursor: Task | undefined = current;

    while (cursor && !seen.has(cursor.id)) {
      seen.add(cursor.id);
      ancestors.unshift(cursor);
      cursor = cursor.parent_task_id ? byId.get(cursor.parent_task_id) : undefined;
    }

    const descendants: Task[] = [];
    cursor = current;
    while (cursor) {
      const next = allTasks.find(
        (task) => task.parent_task_id === cursor?.id && !seen.has(task.id),
      );
      if (!next) break;
      seen.add(next.id);
      descendants.push(next);
      cursor = next;
    }

    return [...ancestors, ...descendants];
  } catch (error) {
    throw new Error(
      `Recurring-Verlauf konnte nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
