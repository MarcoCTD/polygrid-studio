import { dbExecute, dbSelect, now } from "../db";
import type { Expense, CreateExpenseInput } from "@/features/expenses/types";

interface ExpenseRow {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  date: string;
  amount_gross: number;
  amount_net: number | null;
  tax_amount: number | null;
  vendor: string;
  category: string;
  subcategory: string | null;
  payment_method: string | null;
  purpose: string | null;
  product_id: string | null;
  receipt_attached: number; // SQLite stores booleans as 0/1
  receipt_file_path: string | null;
  tax_relevant: number;
  recurring: number;
  notes: string | null;
}

function rowToExpense(row: ExpenseRow): Expense {
  return {
    ...row,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Zod cast at query boundary
    category: row.category as any,
    receipt_attached: Boolean(row.receipt_attached),
    tax_relevant: Boolean(row.tax_relevant),
    recurring: Boolean(row.recurring),
  };
}

export async function listExpenses(): Promise<Expense[]> {
  const rows = await dbSelect<ExpenseRow[]>(
    "SELECT * FROM expenses WHERE deleted_at IS NULL ORDER BY date DESC, created_at DESC",
    [],
    "expenses.list"
  );
  return rows.map(rowToExpense);
}

export async function getExpense(id: string): Promise<Expense | null> {
  const rows = await dbSelect<ExpenseRow[]>(
    "SELECT * FROM expenses WHERE id = ? AND deleted_at IS NULL",
    [id],
    "expenses.get"
  );
  return rows.length > 0 ? rowToExpense(rows[0]) : null;
}

export async function createExpense(input: CreateExpenseInput): Promise<Expense> {
  const id = crypto.randomUUID();
  const ts = now();

  await dbExecute(
    `INSERT INTO expenses (
      id, created_at, updated_at,
      date, amount_gross, amount_net, tax_amount,
      vendor, category, subcategory, payment_method,
      purpose, product_id, receipt_attached, receipt_file_path,
      tax_relevant, recurring, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, ts, ts,
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
      input.receipt_attached ? 1 : 0,
      input.receipt_file_path ?? null,
      input.tax_relevant ? 1 : 0,
      input.recurring ? 1 : 0,
      input.notes ?? null,
    ],
    "expenses.create"
  );

  const expense = await getExpense(id);
  if (!expense) throw new Error("Expense creation failed");
  return expense;
}

export async function updateExpense(
  id: string,
  patch: Partial<CreateExpenseInput>
): Promise<Expense> {
  const ts = now();

  const fields: string[] = [];
  const values: unknown[] = [];

  const add = (col: string, val: unknown) => {
    fields.push(`${col} = ?`);
    values.push(val ?? null);
  };

  if (patch.date !== undefined) add("date", patch.date);
  if (patch.amount_gross !== undefined) add("amount_gross", patch.amount_gross);
  if (patch.amount_net !== undefined) add("amount_net", patch.amount_net);
  if (patch.tax_amount !== undefined) add("tax_amount", patch.tax_amount);
  if (patch.vendor !== undefined) add("vendor", patch.vendor);
  if (patch.category !== undefined) add("category", patch.category);
  if (patch.subcategory !== undefined) add("subcategory", patch.subcategory);
  if (patch.payment_method !== undefined) add("payment_method", patch.payment_method);
  if (patch.purpose !== undefined) add("purpose", patch.purpose);
  if (patch.product_id !== undefined) add("product_id", patch.product_id);
  if (patch.receipt_attached !== undefined) add("receipt_attached", patch.receipt_attached ? 1 : 0);
  if (patch.receipt_file_path !== undefined) add("receipt_file_path", patch.receipt_file_path);
  if (patch.tax_relevant !== undefined) add("tax_relevant", patch.tax_relevant ? 1 : 0);
  if (patch.recurring !== undefined) add("recurring", patch.recurring ? 1 : 0);
  if (patch.notes !== undefined) add("notes", patch.notes);

  if (fields.length === 0) {
    const e = await getExpense(id);
    if (!e) throw new Error("Expense not found");
    return e;
  }

  fields.push("updated_at = ?");
  values.push(ts, id);

  await dbExecute(
    `UPDATE expenses SET ${fields.join(", ")} WHERE id = ?`,
    values,
    "expenses.update"
  );

  const expense = await getExpense(id);
  if (!expense) throw new Error("Expense not found after update");
  return expense;
}

export async function softDeleteExpense(id: string): Promise<void> {
  await dbExecute(
    "UPDATE expenses SET deleted_at = ?, updated_at = ? WHERE id = ?",
    [now(), now(), id],
    "expenses.delete"
  );
}
