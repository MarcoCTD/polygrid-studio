/**
 * Service für laufende Posten (Modul 16): Hosting, Domains, Wartung.
 * CRUD mit Soft-Delete plus Kennzahlen-Helfer (Monatsnormalisierung).
 */
import { getDatabase } from '@/services/database';
import {
  NewWebsiteServiceSchema,
  UpdateWebsiteServiceSchema,
  WebsiteServiceSchema,
  type NewWebsiteServiceInput,
  type UpdateWebsiteServiceInput,
  type WebsiteService,
  type WebsiteServiceListItem,
} from '../schemas';

type Row = Record<string, unknown>;

function now(): string {
  return new Date().toISOString();
}

function toNullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

export function rowToWebsiteService(row: Row): WebsiteService {
  return WebsiteServiceSchema.parse({
    id: row.id,
    client_id: row.client_id,
    project_id: row.project_id ?? null,
    type: row.type,
    label: row.label,
    cost_out: toNullableNumber(row.cost_out),
    cost_out_vendor: row.cost_out_vendor ?? null,
    price_in: toNullableNumber(row.price_in),
    interval: row.interval,
    next_due: row.next_due,
    expires_at: row.expires_at ?? null,
    active: Boolean(row.active),
    last_generated_until: row.last_generated_until ?? null,
    notes: row.notes ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at ?? null,
  });
}

export async function createWebsiteService(data: NewWebsiteServiceInput): Promise<WebsiteService> {
  try {
    const input = NewWebsiteServiceSchema.parse(data);
    const db = getDatabase();
    const id = crypto.randomUUID();
    const timestamp = now();

    await db.execute(
      `INSERT INTO website_services (
        id, client_id, project_id, type, label, cost_out, cost_out_vendor,
        price_in, interval, next_due, expires_at, active, last_generated_until,
        notes, created_at, updated_at, deleted_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        id,
        input.client_id,
        input.project_id ?? null,
        input.type,
        input.label,
        input.cost_out ?? null,
        input.cost_out_vendor ?? null,
        input.price_in ?? null,
        input.interval,
        input.next_due,
        input.expires_at ?? null,
        (input.active ?? true) ? 1 : 0,
        null,
        input.notes ?? null,
        timestamp,
        timestamp,
        null,
      ],
    );

    const service = await getWebsiteServiceById(id);
    if (!service) throw new Error('Posten wurde nach dem Erstellen nicht gefunden.');
    return service;
  } catch (error) {
    throw new Error(
      `Laufender Posten konnte nicht erstellt werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

const SERVICE_UPDATE_FIELDS = [
  'client_id',
  'project_id',
  'type',
  'label',
  'cost_out',
  'cost_out_vendor',
  'price_in',
  'interval',
  'next_due',
  'expires_at',
  'active',
  'last_generated_until',
  'notes',
] as const;

export async function updateWebsiteService(
  id: string,
  data: UpdateWebsiteServiceInput,
): Promise<WebsiteService> {
  try {
    const input = UpdateWebsiteServiceSchema.parse(data);
    const existing = await getWebsiteServiceById(id);
    if (!existing) throw new Error(`Posten ${id} nicht gefunden.`);

    // Refinement gegen den gemergten Zustand: nach dem Update muss
    // weiterhin mindestens Kosten ODER Einnahme gesetzt sein.
    const mergedCostOut = input.cost_out === undefined ? existing.cost_out : input.cost_out;
    const mergedPriceIn = input.price_in === undefined ? existing.price_in : input.price_in;
    if (mergedCostOut === null && mergedPriceIn === null) {
      throw new Error('Mindestens Kosten oder Einnahme muss gesetzt sein.');
    }

    const setClauses = ['updated_at = $1'];
    const params: unknown[] = [now()];

    for (const field of SERVICE_UPDATE_FIELDS) {
      if (!(field in input) || input[field] === undefined) continue;
      const value = input[field];
      params.push(field === 'active' ? (value ? 1 : 0) : (value ?? null));
      setClauses.push(`${field} = $${params.length}`);
    }

    if (setClauses.length > 1) {
      params.push(id);
      await getDatabase().execute(
        `UPDATE website_services SET ${setClauses.join(', ')} WHERE id = $${params.length}`,
        params,
      );
    }

    const updated = await getWebsiteServiceById(id);
    if (!updated) throw new Error(`Posten ${id} nicht gefunden nach Update.`);
    return updated;
  } catch (error) {
    throw new Error(
      `Laufender Posten konnte nicht aktualisiert werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function softDeleteWebsiteService(id: string): Promise<void> {
  try {
    const timestamp = now();
    await getDatabase().execute(
      'UPDATE website_services SET deleted_at = $1, updated_at = $2 WHERE id = $3',
      [timestamp, timestamp, id],
    );
  } catch (error) {
    throw new Error(
      `Laufender Posten konnte nicht gelöscht werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function getWebsiteServices(options?: {
  showDeleted?: boolean;
}): Promise<WebsiteServiceListItem[]> {
  try {
    const where = options?.showDeleted ? '' : 'WHERE s.deleted_at IS NULL';
    const rows = await getDatabase().select<Row[]>(
      `SELECT s.*, c.name AS client_name, p.name AS project_name
       FROM website_services s
       JOIN clients c ON c.id = s.client_id
       LEFT JOIN website_projects p ON p.id = s.project_id AND p.deleted_at IS NULL
       ${where}
       ORDER BY s.next_due ASC, s.label COLLATE NOCASE ASC`,
    );

    return rows.map((row) => ({
      ...rowToWebsiteService(row),
      client_name: String(row.client_name ?? ''),
      project_name: (row.project_name as string | null | undefined) ?? null,
    }));
  } catch (error) {
    throw new Error(
      `Laufende Posten konnten nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function getWebsiteServiceById(id: string): Promise<WebsiteService | null> {
  try {
    const rows = await getDatabase().select<Row[]>(
      'SELECT * FROM website_services WHERE id = $1 LIMIT 1',
      [id],
    );
    return rows[0] ? rowToWebsiteService(rows[0]) : null;
  } catch (error) {
    throw new Error(
      `Laufender Posten konnte nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// ------------------------------------------------------------
// Kennzahlen (Kopfbereich der Websites-Seite)
// ------------------------------------------------------------

/** Normalisiert einen Betrag auf Monatsbasis: yearly wird durch 12 geteilt. */
export function normalizeToMonthly(amount: number | null, interval: 'monthly' | 'yearly'): number {
  if (amount === null) return 0;
  return interval === 'yearly' ? amount / 12 : amount;
}

export interface WebsiteRecurringTotals {
  monthlyIncome: number;
  monthlyCost: number;
  monthlyBalance: number;
}

/** Summiert aktive Posten monatlich normalisiert (Basis der Kennzahlen). */
export function calculateRecurringTotals(
  services: Pick<WebsiteService, 'active' | 'cost_out' | 'price_in' | 'interval'>[],
): WebsiteRecurringTotals {
  let monthlyIncome = 0;
  let monthlyCost = 0;

  for (const service of services) {
    if (!service.active) continue;
    monthlyIncome += normalizeToMonthly(service.price_in, service.interval);
    monthlyCost += normalizeToMonthly(service.cost_out, service.interval);
  }

  monthlyIncome = Number(monthlyIncome.toFixed(2));
  monthlyCost = Number(monthlyCost.toFixed(2));
  return {
    monthlyIncome,
    monthlyCost,
    monthlyBalance: Number((monthlyIncome - monthlyCost).toFixed(2)),
  };
}
