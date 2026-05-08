import { getDatabase } from '@/services/database';
import {
  templateCreateSchema,
  templateFilterSchema,
  templateSchema,
  templateUpdateSchema,
  type Template,
  type TemplateCreate,
  type TemplateFilter,
  type TemplatePlatform,
  type TemplateUpdate,
  type TemplateVariable,
} from '../schemas';

const TEMPLATE_UPDATE_FIELDS = [
  'name',
  'category',
  'content',
  'platforms',
  'variables',
  'is_legal',
  'notes',
] as const satisfies readonly (keyof TemplateUpdate)[];

type TemplateRow = Record<string, unknown>;

function now(): string {
  return new Date().toISOString();
}

function parseStringArray(value: unknown): TemplatePlatform[] | null {
  if (Array.isArray(value)) {
    return value.filter((item): item is TemplatePlatform =>
      ['etsy', 'ebay', 'kleinanzeigen'].includes(String(item)),
    );
  }
  if (typeof value !== 'string' || value.trim() === '') return null;

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is TemplatePlatform =>
          ['etsy', 'ebay', 'kleinanzeigen'].includes(String(item)),
        )
      : null;
  } catch {
    return null;
  }
}

function parseVariables(value: unknown): TemplateVariable[] | null {
  if (Array.isArray(value)) {
    return value.filter(isTemplateVariable);
  }
  if (typeof value !== 'string' || value.trim() === '') return null;

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(isTemplateVariable) : null;
  } catch {
    return null;
  }
}

function isTemplateVariable(value: unknown): value is TemplateVariable {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'description' in value &&
    typeof value.name === 'string' &&
    typeof value.description === 'string'
  );
}

function toBoolean(value: unknown): boolean {
  return value === true || value === 1;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function toJsonValue(
  value: TemplatePlatform[] | TemplateVariable[] | null | undefined,
): string | null {
  return value && value.length > 0 ? JSON.stringify(value) : null;
}

function rowToTemplate(row: TemplateRow): Template {
  return templateSchema.parse({
    id: row.id,
    name: row.name,
    category: row.category,
    content: row.content,
    platforms: parseStringArray(row.platforms),
    variables: parseVariables(row.variables),
    version: row.version,
    is_legal: toBoolean(row.is_legal),
    notes: nullableString(row.notes),
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: nullableString(row.deleted_at),
  });
}

function buildTemplateWhere(filters?: TemplateFilter): { where: string; params: unknown[] } {
  const input = filters ? templateFilterSchema.parse(filters) : undefined;
  const clauses = ['deleted_at IS NULL'];
  const params: unknown[] = [];

  if (input?.category) {
    params.push(input.category);
    clauses.push(`category = $${params.length}`);
  }

  if (input?.search) {
    const query = `%${input.search.toLowerCase()}%`;
    params.push(query, query);
    clauses.push(
      `(LOWER(name) LIKE $${params.length - 1} OR LOWER(content) LIKE $${params.length})`,
    );
  }

  return {
    where: `WHERE ${clauses.join(' AND ')}`,
    params,
  };
}

export async function getAllTemplates(filters?: TemplateFilter): Promise<Template[]> {
  try {
    const { where, params } = buildTemplateWhere(filters);
    const rows = await getDatabase().select<TemplateRow[]>(
      `SELECT *
       FROM templates
       ${where}
       ORDER BY
         CASE category
           WHEN 'impressum' THEN 0
           WHEN 'widerruf' THEN 1
           WHEN 'versand' THEN 2
           WHEN 'faq' THEN 3
           WHEN 'kundenservice' THEN 4
           WHEN 'antwort' THEN 5
           WHEN 'beilage' THEN 6
           WHEN 'reklamation' THEN 7
           ELSE 8
         END,
         updated_at DESC`,
      params,
    );

    return rows.map(rowToTemplate);
  } catch (error) {
    throw new Error(
      `Vorlagen konnten nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function getTemplateById(id: string): Promise<Template | null> {
  try {
    const rows = await getDatabase().select<TemplateRow[]>(
      'SELECT * FROM templates WHERE id = $1 AND deleted_at IS NULL LIMIT 1',
      [id],
    );

    return rows[0] ? rowToTemplate(rows[0]) : null;
  } catch (error) {
    throw new Error(
      `Vorlage konnte nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function createTemplate(data: TemplateCreate): Promise<Template> {
  try {
    const input = templateCreateSchema.parse(data);
    const id = crypto.randomUUID();
    const timestamp = now();

    await getDatabase().execute(
      `INSERT INTO templates (
        id, name, category, content, platforms, variables, version,
        is_legal, notes, created_at, updated_at, deleted_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12
      )`,
      [
        id,
        input.name,
        input.category,
        input.content,
        toJsonValue(input.platforms),
        toJsonValue(input.variables),
        1,
        input.is_legal ?? false,
        input.notes ?? null,
        timestamp,
        timestamp,
        null,
      ],
    );

    const template = await getTemplateById(id);
    if (!template) throw new Error(`Vorlage ${id} wurde nach Erstellung nicht gefunden.`);
    return template;
  } catch (error) {
    throw new Error(
      `Vorlage konnte nicht erstellt werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function updateTemplate(id: string, data: TemplateUpdate): Promise<Template> {
  try {
    const input = templateUpdateSchema.parse(data);
    const existing = await getTemplateById(id);
    if (!existing) throw new Error(`Vorlage ${id} nicht gefunden.`);

    const timestamp = now();
    const setClauses = ['updated_at = $1', 'version = version + 1'];
    const params: unknown[] = [timestamp];

    for (const field of TEMPLATE_UPDATE_FIELDS) {
      if (field in input) {
        setClauses.push(`${field} = $${params.length + 1}`);
        if (field === 'platforms') {
          params.push(toJsonValue(input.platforms));
        } else if (field === 'variables') {
          params.push(toJsonValue(input.variables));
        } else {
          params.push(input[field] ?? null);
        }
      }
    }

    if (setClauses.length === 2) return existing;

    params.push(id);
    await getDatabase().execute(
      `UPDATE templates SET ${setClauses.join(', ')} WHERE id = $${params.length}`,
      params,
    );

    const template = await getTemplateById(id);
    if (!template) throw new Error(`Vorlage ${id} wurde nach Update nicht gefunden.`);
    return template;
  } catch (error) {
    throw new Error(
      `Vorlage konnte nicht aktualisiert werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function softDeleteTemplate(id: string): Promise<void> {
  try {
    const timestamp = now();
    await getDatabase().execute(
      'UPDATE templates SET deleted_at = $1, updated_at = $1 WHERE id = $2',
      [timestamp, id],
    );
  } catch (error) {
    throw new Error(
      `Vorlage konnte nicht gelöscht werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
