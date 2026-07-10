/**
 * Kunden-Service (Modul 16). CRUD mit Soft-Delete analog zu den übrigen
 * Services. Zugangsdaten-Metadaten liegen als JSON am Datensatz, Secrets
 * ausschließlich im Keychain (siehe credentialsService).
 */
import { getDatabase } from '@/services/database';
import {
  ClientSchema,
  NewClientSchema,
  UpdateClientSchema,
  type Client,
  type ClientListItem,
  type CredentialMeta,
  type NewClientInput,
  type UpdateClientInput,
} from '../schemas';

type Row = Record<string, unknown>;

function now(): string {
  return new Date().toISOString();
}

export function parseCredentials(value: unknown): CredentialMeta[] {
  if (typeof value !== 'string' || value.trim() === '') return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as CredentialMeta[]) : [];
  } catch {
    return [];
  }
}

function rowToClient(row: Row): Client {
  return ClientSchema.parse({
    id: row.id,
    name: row.name,
    contact_person: row.contact_person ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    address: row.address ?? null,
    credentials: parseCredentials(row.credentials),
    notes: row.notes ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at ?? null,
  });
}

export async function createClient(data: NewClientInput): Promise<Client> {
  try {
    const input = NewClientSchema.parse(data);
    const db = getDatabase();
    const id = crypto.randomUUID();
    const timestamp = now();

    await db.execute(
      `INSERT INTO clients (
        id, name, contact_person, email, phone, address, credentials, notes,
        created_at, updated_at, deleted_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id,
        input.name,
        input.contact_person ?? null,
        input.email ?? null,
        input.phone ?? null,
        input.address ?? null,
        JSON.stringify([]),
        input.notes ?? null,
        timestamp,
        timestamp,
        null,
      ],
    );

    const client = await getClientById(id);
    if (!client) throw new Error('Kunde wurde nach dem Erstellen nicht gefunden.');
    return client;
  } catch (error) {
    throw new Error(
      `Kunde konnte nicht erstellt werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

const CLIENT_UPDATE_FIELDS = [
  'name',
  'contact_person',
  'email',
  'phone',
  'address',
  'credentials',
  'notes',
] as const;

export async function updateClient(id: string, data: UpdateClientInput): Promise<Client> {
  try {
    const input = UpdateClientSchema.parse(data);
    const existing = await getClientById(id);
    if (!existing) throw new Error(`Kunde ${id} nicht gefunden.`);

    const setClauses = ['updated_at = $1'];
    const params: unknown[] = [now()];

    for (const field of CLIENT_UPDATE_FIELDS) {
      if (!(field in input) || input[field] === undefined) continue;
      params.push(
        field === 'credentials' ? JSON.stringify(input.credentials) : (input[field] ?? null),
      );
      setClauses.push(`${field} = $${params.length}`);
    }

    if (setClauses.length > 1) {
      params.push(id);
      await getDatabase().execute(
        `UPDATE clients SET ${setClauses.join(', ')} WHERE id = $${params.length}`,
        params,
      );
    }

    const updated = await getClientById(id);
    if (!updated) throw new Error(`Kunde ${id} nicht gefunden nach Update.`);
    return updated;
  } catch (error) {
    throw new Error(
      `Kunde konnte nicht aktualisiert werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Soft-Delete. Kunden mit aktiven Projekten oder laufenden Posten werden
 * nicht gelöscht – erst die abhängigen Datensätze entfernen (Datenintegrität,
 * siehe ENTSCHEIDUNGEN_MODUL_16).
 */
export async function softDeleteClient(id: string): Promise<void> {
  try {
    const db = getDatabase();
    const [projects, services] = await Promise.all([
      db.select<{ count: number }[]>(
        'SELECT COUNT(*) AS count FROM website_projects WHERE client_id = $1 AND deleted_at IS NULL',
        [id],
      ),
      db.select<{ count: number }[]>(
        'SELECT COUNT(*) AS count FROM website_services WHERE client_id = $1 AND deleted_at IS NULL',
        [id],
      ),
    ]);

    const projectCount = Number(projects[0]?.count ?? 0);
    const serviceCount = Number(services[0]?.count ?? 0);
    if (projectCount > 0 || serviceCount > 0) {
      throw new Error(
        'Kunde hat noch aktive Projekte oder laufende Posten. Bitte zuerst diese löschen.',
      );
    }

    const timestamp = now();
    await db.execute('UPDATE clients SET deleted_at = $1, updated_at = $2 WHERE id = $3', [
      timestamp,
      timestamp,
      id,
    ]);
  } catch (error) {
    throw new Error(
      `Kunde konnte nicht gelöscht werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function getClients(options?: { showDeleted?: boolean }): Promise<ClientListItem[]> {
  try {
    const where = options?.showDeleted ? '' : 'WHERE c.deleted_at IS NULL';
    const rows = await getDatabase().select<Row[]>(
      `SELECT c.*,
        (SELECT COUNT(*) FROM website_projects p
          WHERE p.client_id = c.id AND p.deleted_at IS NULL) AS project_count,
        (SELECT COUNT(*) FROM website_services s
          WHERE s.client_id = c.id AND s.deleted_at IS NULL) AS service_count
       FROM clients c
       ${where}
       ORDER BY c.name COLLATE NOCASE ASC`,
    );

    return rows.map((row) => ({
      ...rowToClient(row),
      project_count: Number(row.project_count ?? 0),
      service_count: Number(row.service_count ?? 0),
    }));
  } catch (error) {
    throw new Error(
      `Kunden konnten nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function getClientById(id: string): Promise<Client | null> {
  try {
    const rows = await getDatabase().select<Row[]>('SELECT * FROM clients WHERE id = $1 LIMIT 1', [
      id,
    ]);
    return rows[0] ? rowToClient(rows[0]) : null;
  } catch (error) {
    throw new Error(
      `Kunde konnte nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
