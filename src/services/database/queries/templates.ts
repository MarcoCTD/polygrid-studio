import { getDb, parseJsonArray, toJsonString, now } from "../db";
import type { Template, CreateTemplateInput } from "@/features/templates/types";

interface TemplateRow {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  name: string;
  category: string;
  content: string;
  platforms: string | null;
  variables: string | null;
  version: number;
  is_legal: number; // SQLite boolean
  notes: string | null;
}

function rowToTemplate(row: TemplateRow): Template {
  return {
    ...row,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Zod cast at query boundary
    category: row.category as any,
    platforms: parseJsonArray<string>(row.platforms),
    variables: parseJsonArray<string>(row.variables),
    is_legal: Boolean(row.is_legal),
  };
}

export async function listTemplates(): Promise<Template[]> {
  const db = await getDb();
  const rows = await db.select<TemplateRow[]>(
    "SELECT * FROM templates WHERE deleted_at IS NULL ORDER BY category, name"
  );
  return rows.map(rowToTemplate);
}

export async function getTemplate(id: string): Promise<Template | null> {
  const db = await getDb();
  const rows = await db.select<TemplateRow[]>(
    "SELECT * FROM templates WHERE id = ? AND deleted_at IS NULL",
    [id]
  );
  return rows.length > 0 ? rowToTemplate(rows[0]) : null;
}

export async function createTemplate(input: CreateTemplateInput): Promise<Template> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const ts = now();

  await db.execute(
    `INSERT INTO templates (
      id, created_at, updated_at,
      name, category, content, is_legal, notes, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      id, ts, ts,
      input.name,
      input.category,
      input.content,
      input.is_legal ? 1 : 0,
      input.notes ?? null,
    ]
  );

  const template = await getTemplate(id);
  if (!template) throw new Error("Template creation failed");
  return template;
}

export async function updateTemplate(
  id: string,
  patch: Partial<CreateTemplateInput> & {
    platforms?: string[];
    variables?: string[];
  }
): Promise<Template> {
  const db = await getDb();
  const ts = now();

  const fields: string[] = [];
  const values: unknown[] = [];

  const add = (col: string, val: unknown) => {
    fields.push(`${col} = ?`);
    values.push(val ?? null);
  };

  if (patch.name !== undefined) add("name", patch.name);
  if (patch.category !== undefined) add("category", patch.category);
  if (patch.content !== undefined) {
    add("content", patch.content);
    // Increment version on content change
    fields.push("version = version + 1");
  }
  if (patch.is_legal !== undefined) add("is_legal", patch.is_legal ? 1 : 0);
  if (patch.notes !== undefined) add("notes", patch.notes);
  if (patch.platforms !== undefined) add("platforms", toJsonString(patch.platforms));
  if (patch.variables !== undefined) add("variables", toJsonString(patch.variables));

  if (fields.length === 0) {
    const t = await getTemplate(id);
    if (!t) throw new Error("Template not found");
    return t;
  }

  fields.push("updated_at = ?");
  values.push(ts, id);

  await db.execute(
    `UPDATE templates SET ${fields.join(", ")} WHERE id = ?`,
    values
  );

  const template = await getTemplate(id);
  if (!template) throw new Error("Template not found after update");
  return template;
}

export async function softDeleteTemplate(id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE templates SET deleted_at = ?, updated_at = ? WHERE id = ?",
    [now(), now(), id]
  );
}
