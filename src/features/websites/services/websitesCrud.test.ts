/**
 * Integrationstests Website-CRM Etappe A (Modul 16) gegen eine echte
 * In-Memory-SQLite (sql.js) mit den echten Drizzle-Migrationen der App –
 * gleiches Muster wie playbookEngine.test.ts.
 */
import path from 'node:path';
import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic } from 'sql.js';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MIGRATIONS } from '@/services/database/migrations';

type SqlValue = string | number | null;
type Row = Record<string, unknown>;

function toSqlValue(value: unknown): SqlValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number' || typeof value === 'string') return value;
  return JSON.stringify(value);
}

function toBindParams(query: string, values: unknown[]): Record<string, SqlValue> | SqlValue[] {
  if (/\$\d+/.test(query)) {
    const params: Record<string, SqlValue> = {};
    values.forEach((value, index) => {
      params[`$${index + 1}`] = toSqlValue(value);
    });
    return params;
  }
  return values.map(toSqlValue);
}

/** Minimaler Ersatz für die Tauri-SQL-Plugin-Database im Test. */
class TestDatabase {
  constructor(private readonly db: SqlJsDatabase) {}

  async execute(query: string, values: unknown[] = []): Promise<unknown> {
    if (values.length > 0) {
      this.db.run(query, toBindParams(query, values));
    } else {
      this.db.run(query);
    }
    return [this.db.getRowsModified(), 0];
  }

  async select<T>(query: string, values: unknown[] = []): Promise<T> {
    const stmt = this.db.prepare(query);
    try {
      if (values.length > 0) stmt.bind(toBindParams(query, values));
      const rows: Row[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      return rows as T;
    } finally {
      stmt.free();
    }
  }
}

const holder = vi.hoisted(() => ({
  db: null as unknown as { select: <T>(q: string, v?: unknown[]) => Promise<T> },
}));

vi.mock('@/services/database', () => ({
  getDatabase: () => holder.db,
  initDatabase: async () => undefined,
  getSetting: async <T>(key: string): Promise<T | null> => {
    const rows = await holder.db.select<{ value: string }[]>(
      'SELECT value FROM app_settings WHERE key = $1',
      [key],
    );
    if (rows.length === 0) return null;
    return JSON.parse(rows[0].value) as T;
  },
  setSetting: async () => undefined,
}));

// Nach dem Mock importieren, damit alle Services die Test-DB nutzen.
const { createClient, updateClient, softDeleteClient, getClients, getClientById } =
  await import('./clientsService');
const {
  createWebsiteProject,
  updateWebsiteProject,
  softDeleteWebsiteProject,
  getWebsiteProjects,
  billWebsiteProject,
} = await import('./projectsService');
const {
  createWebsiteService,
  updateWebsiteService,
  softDeleteWebsiteService,
  getWebsiteServices,
  calculateRecurringTotals,
  normalizeToMonthly,
} = await import('./websiteServicesService');
const { NewWebsiteServiceSchema } = await import('../schemas');

let SQL: SqlJsStatic;
let rawDb: SqlJsDatabase;

function select(query: string, values: unknown[] = []): Row[] {
  const stmt = rawDb.prepare(query);
  try {
    if (values.length > 0) stmt.bind(toBindParams(query, values));
    const rows: Row[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
}

beforeAll(async () => {
  SQL = await initSqlJs({
    locateFile: (file: string) => path.join(process.cwd(), 'node_modules/sql.js/dist', file),
  });
});

beforeEach(() => {
  rawDb = new SQL.Database();
  holder.db = new TestDatabase(rawDb) as never;
  for (const migration of MIGRATIONS) {
    const statements = migration.sql
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0);
    for (const statement of statements) {
      rawDb.run(statement);
    }
  }
});

describe('Migration 0014', () => {
  it('legt clients, website_projects und website_services an', () => {
    const tables = select(
      `SELECT name FROM sqlite_master WHERE type = 'table'
       AND name IN ('clients', 'website_projects', 'website_services')
       ORDER BY name`,
    );
    expect(tables.map((row) => row.name)).toEqual([
      'clients',
      'website_projects',
      'website_services',
    ]);
  });
});

describe('clientsService', () => {
  it('legt Kunden an, aktualisiert und soft-deleted sie', async () => {
    const client = await createClient({ name: 'Malerbetrieb Weber', email: 'info@weber.de' });
    expect(client.name).toBe('Malerbetrieb Weber');
    expect(client.credentials).toEqual([]);
    expect(client.deleted_at).toBeNull();

    const updated = await updateClient(client.id, { phone: '0171 123456' });
    expect(updated.phone).toBe('0171 123456');
    expect(updated.email).toBe('info@weber.de');

    await softDeleteClient(client.id);
    const deleted = await getClientById(client.id);
    expect(deleted?.deleted_at).not.toBeNull();
    expect(await getClients()).toHaveLength(0);
    expect(await getClients({ showDeleted: true })).toHaveLength(1);
  });

  it('blockiert Löschen bei aktiven Projekten oder Posten', async () => {
    const client = await createClient({ name: 'Kunde A' });
    const project = await createWebsiteProject({ client_id: client.id, name: 'Relaunch' });

    await expect(softDeleteClient(client.id)).rejects.toThrow(/aktive Projekte/);

    await softDeleteWebsiteProject(project.id);
    await expect(softDeleteClient(client.id)).resolves.toBeUndefined();
  });

  it('zählt Projekte und Posten des Kunden in der Liste', async () => {
    const client = await createClient({ name: 'Kunde B' });
    await createWebsiteProject({ client_id: client.id, name: 'Projekt 1' });
    await createWebsiteProject({ client_id: client.id, name: 'Projekt 2' });
    await createWebsiteService({
      client_id: client.id,
      type: 'hosting',
      label: 'Webspace',
      cost_out: 5,
      interval: 'monthly',
      next_due: '2026-08-01',
    });

    const [item] = await getClients();
    expect(item.project_count).toBe(2);
    expect(item.service_count).toBe(1);
  });
});

describe('projectsService', () => {
  it('legt Projekte mit Default-Status inquiry an und aktualisiert Felder', async () => {
    const client = await createClient({ name: 'Kunde C' });
    const project = await createWebsiteProject({ client_id: client.id, name: 'Relaunch Weber' });
    expect(project.status).toBe('inquiry');
    expect(project.order_id).toBeNull();

    const updated = await updateWebsiteProject(project.id, {
      status: 'in_progress',
      price: 1500,
      deadline: '2026-08-15',
    });
    expect(updated.status).toBe('in_progress');
    expect(updated.price).toBe(1500);

    const [listItem] = await getWebsiteProjects();
    expect(listItem.client_name).toBe('Kunde C');
  });

  it('soft-deleted Projekte, Liste blendet sie aus', async () => {
    const client = await createClient({ name: 'Kunde D' });
    const project = await createWebsiteProject({ client_id: client.id, name: 'Shop' });
    await softDeleteWebsiteProject(project.id);
    expect(await getWebsiteProjects()).toHaveLength(0);
    expect(await getWebsiteProjects({ showDeleted: true })).toHaveLength(1);
  });

  it('Abrechnen erzeugt Website-Auftrag mit Gebühr 0 und verknüpft ihn genau einmal', async () => {
    const client = await createClient({ name: 'Malerbetrieb Weber' });
    const project = await createWebsiteProject({
      client_id: client.id,
      name: 'Relaunch',
      price: 1200,
      status: 'live',
    });

    const { project: billed, order } = await billWebsiteProject(project.id);
    expect(order.platform).toBe('website');
    expect(order.status).toBe('ordered');
    expect(order.payment_status).toBe('pending');
    expect(order.payment_received_date).toBeNull();
    expect(order.sale_price).toBe(1200);
    expect(order.platform_fee).toBe(0);
    expect(order.customer_name).toBe('Malerbetrieb Weber');
    expect(billed.order_id).toBe(order.id);

    // Zweites Abrechnen ist blockiert – es entsteht kein weiterer Auftrag.
    await expect(billWebsiteProject(project.id)).rejects.toThrow(/bereits abgerechnet/);
    const orders = select(`SELECT id FROM orders WHERE platform = 'website'`);
    expect(orders).toHaveLength(1);
  });

  it('Abrechnen ohne Projektpreis wird abgelehnt', async () => {
    const client = await createClient({ name: 'Kunde E' });
    const project = await createWebsiteProject({ client_id: client.id, name: 'Ohne Preis' });
    await expect(billWebsiteProject(project.id)).rejects.toThrow(/keinen Preis/);
  });
});

describe('websiteServicesService', () => {
  async function seedClient(name = 'Kunde F'): Promise<string> {
    const client = await createClient({ name });
    return client.id;
  }

  it('verlangt mindestens cost_out oder price_in (Zod-Refinement)', async () => {
    const clientId = await seedClient();
    const base = {
      client_id: clientId,
      type: 'hosting' as const,
      label: 'Webspace',
      interval: 'monthly' as const,
      next_due: '2026-08-01',
    };

    expect(NewWebsiteServiceSchema.safeParse(base).success).toBe(false);
    await expect(createWebsiteService(base)).rejects.toThrow();

    const withCost = await createWebsiteService({ ...base, cost_out: 4.9 });
    expect(withCost.cost_out).toBe(4.9);
    expect(withCost.price_in).toBeNull();
    expect(withCost.active).toBe(true);
    expect(withCost.last_generated_until).toBeNull();
  });

  it('blockiert Update, das sowohl Kosten als auch Einnahme entfernt', async () => {
    const clientId = await seedClient();
    const service = await createWebsiteService({
      client_id: clientId,
      type: 'hosting',
      label: 'Hetzner Webspace',
      cost_out: 5,
      price_in: 15,
      interval: 'monthly',
      next_due: '2026-08-01',
    });

    await expect(
      updateWebsiteService(service.id, { cost_out: null, price_in: null }),
    ).rejects.toThrow(/Kosten oder Einnahme/);

    const updated = await updateWebsiteService(service.id, { cost_out: null });
    expect(updated.cost_out).toBeNull();
    expect(updated.price_in).toBe(15);
  });

  it('soft-deleted Posten und löst Kunden-/Projektnamen in der Liste auf', async () => {
    const clientId = await seedClient('Kunde G');
    const project = await createWebsiteProject({ client_id: clientId, name: 'Firmenseite' });
    const service = await createWebsiteService({
      client_id: clientId,
      project_id: project.id,
      type: 'domain',
      label: 'weber-maler.de',
      cost_out: 12,
      interval: 'yearly',
      next_due: '2027-01-15',
      expires_at: '2027-01-15',
    });

    const [item] = await getWebsiteServices();
    expect(item.client_name).toBe('Kunde G');
    expect(item.project_name).toBe('Firmenseite');

    await softDeleteWebsiteService(service.id);
    expect(await getWebsiteServices()).toHaveLength(0);
    expect(await getWebsiteServices({ showDeleted: true })).toHaveLength(1);
  });

  it('normalisiert Kennzahlen monthly/yearly korrekt auf Monatsbasis', () => {
    expect(normalizeToMonthly(12, 'yearly')).toBe(1);
    expect(normalizeToMonthly(5, 'monthly')).toBe(5);
    expect(normalizeToMonthly(null, 'monthly')).toBe(0);

    const totals = calculateRecurringTotals([
      { active: true, interval: 'monthly', cost_out: 5, price_in: 15 },
      { active: true, interval: 'yearly', cost_out: 12, price_in: 120 },
      // Inaktive Posten zählen nicht in die Kennzahlen
      { active: false, interval: 'monthly', cost_out: 99, price_in: 99 },
    ]);
    expect(totals.monthlyIncome).toBe(25);
    expect(totals.monthlyCost).toBe(6);
    expect(totals.monthlyBalance).toBe(19);
  });
});

describe('Plattform website in der Auftragsverwaltung', () => {
  it('akzeptiert website im Zod-Enum und in Filtern des Order-Service', async () => {
    const { OrderPlatformEnum } = await import('@/features/orders/types');
    expect(OrderPlatformEnum.safeParse('website').success).toBe(true);

    const { createOrder, getOrders } = await import('@/features/orders/services/ordersService');
    await createOrder({
      platform: 'website',
      sale_price: 25,
      order_date: '2026-07-01',
      status: 'ordered',
      payment_status: 'pending',
    });
    await createOrder({
      platform: 'etsy',
      sale_price: 10,
      order_date: '2026-07-01',
    });

    const filtered = await getOrders({ platform: ['website'] });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].platform).toBe('website');
    // Plattformgebühr 0 aus den Default-Settings
    expect(filtered[0].platform_fee).toBe(0);
  });
});
