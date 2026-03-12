import { getDb, now } from "../db";
import type { Task, CreateTaskInput } from "@/features/tasks/types";

interface TaskRow {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  due_date: string | null;
  product_id: string | null;
  order_id: string | null;
  listing_id: string | null;
  recurring_rule: string | null;
  completed_at: string | null;
}

function rowToTask(row: TaskRow): Task {
  return {
    ...row,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Zod cast at query boundary
    priority: row.priority as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    status: row.status as any,
  };
}

export async function listTasks(): Promise<Task[]> {
  const db = await getDb();
  const rows = await db.select<TaskRow[]>(
    "SELECT * FROM tasks WHERE deleted_at IS NULL ORDER BY CASE status WHEN 'in_progress' THEN 0 WHEN 'todo' THEN 1 WHEN 'done' THEN 2 WHEN 'cancelled' THEN 3 END, CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END, created_at DESC"
  );
  return rows.map(rowToTask);
}

export async function getTask(id: string): Promise<Task | null> {
  const db = await getDb();
  const rows = await db.select<TaskRow[]>(
    "SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL",
    [id]
  );
  return rows.length > 0 ? rowToTask(rows[0]) : null;
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const ts = now();

  await db.execute(
    `INSERT INTO tasks (
      id, created_at, updated_at,
      title, description, priority, status,
      due_date, product_id, order_id, listing_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, ts, ts,
      input.title,
      input.description ?? null,
      input.priority,
      input.status,
      input.due_date ?? null,
      input.product_id ?? null,
      input.order_id ?? null,
      input.listing_id ?? null,
    ]
  );

  const task = await getTask(id);
  if (!task) throw new Error("Task creation failed");
  return task;
}

export async function updateTask(
  id: string,
  patch: Partial<CreateTaskInput> & { completed_at?: string | null }
): Promise<Task> {
  const db = await getDb();
  const ts = now();

  const fields: string[] = [];
  const values: unknown[] = [];

  const add = (col: string, val: unknown) => {
    fields.push(`${col} = ?`);
    values.push(val ?? null);
  };

  if (patch.title !== undefined) add("title", patch.title);
  if (patch.description !== undefined) add("description", patch.description);
  if (patch.priority !== undefined) add("priority", patch.priority);
  if (patch.status !== undefined) {
    add("status", patch.status);
    // Auto-set completed_at when marking as done
    if (patch.status === "done" && patch.completed_at === undefined) {
      add("completed_at", ts);
    }
  }
  if (patch.completed_at !== undefined) add("completed_at", patch.completed_at);
  if (patch.due_date !== undefined) add("due_date", patch.due_date);
  if (patch.product_id !== undefined) add("product_id", patch.product_id);
  if (patch.order_id !== undefined) add("order_id", patch.order_id);
  if (patch.listing_id !== undefined) add("listing_id", patch.listing_id);

  if (fields.length === 0) {
    const t = await getTask(id);
    if (!t) throw new Error("Task not found");
    return t;
  }

  fields.push("updated_at = ?");
  values.push(ts, id);

  await db.execute(
    `UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`,
    values
  );

  const task = await getTask(id);
  if (!task) throw new Error("Task not found after update");
  return task;
}

export async function softDeleteTask(id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ?",
    [now(), now(), id]
  );
}
