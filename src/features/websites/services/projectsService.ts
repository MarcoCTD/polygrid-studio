/**
 * Website-Projekt-Service (Modul 16). CRUD mit Soft-Delete plus "Abrechnen":
 * erzeugt über den bestehenden Order-Service einen Auftrag (Plattform
 * website, Status ordered) und verknüpft ihn am Projekt (order_id).
 */
import { createOrder } from '@/features/orders/services';
import type { Order } from '@/features/orders/types';
import { createDocument } from '@/features/documents/services';
import type { BusinessDocument } from '@/features/documents/schemas';
import { getDatabase } from '@/services/database';
import {
  NewWebsiteProjectSchema,
  UpdateWebsiteProjectSchema,
  WebsiteProjectSchema,
  type NewWebsiteProjectInput,
  type UpdateWebsiteProjectInput,
  type WebsiteProject,
  type WebsiteProjectListItem,
} from '../schemas';
import { parseCredentials } from './clientsService';

type Row = Record<string, unknown>;

function now(): string {
  return new Date().toISOString();
}

function todayISODate(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function rowToProject(row: Row): WebsiteProject {
  return WebsiteProjectSchema.parse({
    id: row.id,
    client_id: row.client_id,
    name: row.name,
    status: row.status,
    price: row.price === null || row.price === undefined ? null : Number(row.price),
    deadline: row.deadline ?? null,
    url: row.url ?? null,
    order_id: row.order_id ?? null,
    credentials: parseCredentials(row.credentials),
    notes: row.notes ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at ?? null,
  });
}

export async function createWebsiteProject(data: NewWebsiteProjectInput): Promise<WebsiteProject> {
  try {
    const input = NewWebsiteProjectSchema.parse(data);
    const db = getDatabase();
    const id = crypto.randomUUID();
    const timestamp = now();

    await db.execute(
      `INSERT INTO website_projects (
        id, client_id, name, status, price, deadline, url, order_id,
        credentials, notes, created_at, updated_at, deleted_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        id,
        input.client_id,
        input.name,
        input.status ?? 'inquiry',
        input.price ?? null,
        input.deadline ?? null,
        input.url ?? null,
        null,
        JSON.stringify([]),
        input.notes ?? null,
        timestamp,
        timestamp,
        null,
      ],
    );

    const project = await getWebsiteProjectById(id);
    if (!project) throw new Error('Projekt wurde nach dem Erstellen nicht gefunden.');
    return project;
  } catch (error) {
    throw new Error(
      `Projekt konnte nicht erstellt werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

const PROJECT_UPDATE_FIELDS = [
  'client_id',
  'name',
  'status',
  'price',
  'deadline',
  'url',
  'order_id',
  'credentials',
  'notes',
] as const;

export async function updateWebsiteProject(
  id: string,
  data: UpdateWebsiteProjectInput,
): Promise<WebsiteProject> {
  try {
    const input = UpdateWebsiteProjectSchema.parse(data);
    const existing = await getWebsiteProjectById(id);
    if (!existing) throw new Error(`Projekt ${id} nicht gefunden.`);

    const setClauses = ['updated_at = $1'];
    const params: unknown[] = [now()];

    for (const field of PROJECT_UPDATE_FIELDS) {
      if (!(field in input) || input[field] === undefined) continue;
      params.push(
        field === 'credentials' ? JSON.stringify(input.credentials) : (input[field] ?? null),
      );
      setClauses.push(`${field} = $${params.length}`);
    }

    if (setClauses.length > 1) {
      params.push(id);
      await getDatabase().execute(
        `UPDATE website_projects SET ${setClauses.join(', ')} WHERE id = $${params.length}`,
        params,
      );
    }

    const updated = await getWebsiteProjectById(id);
    if (!updated) throw new Error(`Projekt ${id} nicht gefunden nach Update.`);
    return updated;
  } catch (error) {
    throw new Error(
      `Projekt konnte nicht aktualisiert werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function softDeleteWebsiteProject(id: string): Promise<void> {
  try {
    const timestamp = now();
    await getDatabase().execute(
      'UPDATE website_projects SET deleted_at = $1, updated_at = $2 WHERE id = $3',
      [timestamp, timestamp, id],
    );
  } catch (error) {
    throw new Error(
      `Projekt konnte nicht gelöscht werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function getWebsiteProjects(options?: {
  showDeleted?: boolean;
}): Promise<WebsiteProjectListItem[]> {
  try {
    const where = options?.showDeleted ? '' : 'WHERE p.deleted_at IS NULL';
    const rows = await getDatabase().select<Row[]>(
      `SELECT p.*, c.name AS client_name
       FROM website_projects p
       JOIN clients c ON c.id = p.client_id
       ${where}
       ORDER BY p.created_at DESC`,
    );

    return rows.map((row) => ({
      ...rowToProject(row),
      client_name: String(row.client_name ?? ''),
    }));
  } catch (error) {
    throw new Error(
      `Projekte konnten nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function getWebsiteProjectById(id: string): Promise<WebsiteProject | null> {
  try {
    const rows = await getDatabase().select<Row[]>(
      'SELECT * FROM website_projects WHERE id = $1 LIMIT 1',
      [id],
    );
    return rows[0] ? rowToProject(rows[0]) : null;
  } catch (error) {
    throw new Error(
      `Projekt konnte nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * "Abrechnen": erzeugt den Einnahmen-Auftrag zum Projekt (Plattform website,
 * Status ordered, payment_status pending – Zahlungseingang bestätigt der
 * Nutzer manuell) und setzt order_id am Projekt. Pro Projekt nur einmal.
 */
export async function billWebsiteProject(
  projectId: string,
): Promise<{ project: WebsiteProject; order: Order }> {
  try {
    const project = await getWebsiteProjectById(projectId);
    if (!project) throw new Error(`Projekt ${projectId} nicht gefunden.`);
    if (project.order_id) throw new Error('Projekt wurde bereits abgerechnet.');
    if (project.price === null) {
      throw new Error('Projekt hat keinen Preis – bitte zuerst einen Projektpreis eintragen.');
    }

    const clientRows = await getDatabase().select<Row[]>(
      'SELECT name FROM clients WHERE id = $1 LIMIT 1',
      [project.client_id],
    );
    const clientName = (clientRows[0]?.name as string | undefined) ?? null;

    const order = await createOrder({
      platform: 'website',
      customer_name: clientName,
      sale_price: project.price,
      status: 'ordered',
      payment_status: 'pending',
      order_date: todayISODate(),
      notes: `Website-Projekt „${project.name}“`,
    });

    const updated = await updateWebsiteProject(projectId, { order_id: order.id });
    return { project: updated, order };
  } catch (error) {
    throw new Error(
      `Projekt konnte nicht abgerechnet werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * "Abrechnen mit Rechnung" (Modul 17): erzeugt Auftrag UND Rechnungs-Draft
 * mit einer Position aus dem Projektpreis; Rechnung ist mit Kunde, Projekt
 * und Auftrag verknüpft. Schlägt das Anlegen des Drafts fehl, bleibt der
 * Auftrag bestehen (Abrechnung ist dann normal erfolgt) – der Fehler nennt
 * das explizit.
 */
export async function billWebsiteProjectWithInvoice(
  projectId: string,
): Promise<{ project: WebsiteProject; order: Order; invoice: BusinessDocument }> {
  const { project, order } = await billWebsiteProject(projectId);
  try {
    const invoice = await createDocument({
      type: 'invoice',
      client_id: project.client_id,
      project_id: project.id,
      order_id: order.id,
      line_items: [
        {
          description: `Website-Projekt „${project.name}“`,
          quantity: 1,
          unit_price: order.sale_price,
        },
      ],
      intro_text: 'vielen Dank für Ihren Auftrag. Wir berechnen Ihnen wie vereinbart:',
    });
    return { project, order, invoice };
  } catch (error) {
    throw new Error(
      `Auftrag ${order.receipt_number} wurde erstellt, aber der Rechnungs-Entwurf schlug fehl: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
