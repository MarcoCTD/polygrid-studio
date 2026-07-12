/**
 * Bug-Fix Playbook-Trigger nach der Status/Zahlungs-Trennung (Migration 0018):
 * - 0017 zog nur playbooks.trigger_status um, nicht playbook_runs → Alt-Runs
 *   mit 'paid' ließen das komplette Playbook-Log am Zod-Enum scheitern.
 * - 0018 zieht die Runs nach (kollisionssicher gegen den Idempotenz-Index)
 *   und die Services tolerieren verbleibende Alt-Werte pro Eintrag.
 *
 * Testaufbau gegen sql.js mit den echten App-Migrationen: erst bis 0016
 * migrieren, Alt-Daten mit 'paid' seeden, dann 0017 + 0018 anwenden –
 * das ist exakt der Upgrade-Pfad einer bestehenden Installation.
 */
import path from 'node:path';
import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic } from 'sql.js';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MIGRATIONS, type Migration } from '@/services/database/migrations';

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

class TestDatabase {
  constructor(private readonly db: SqlJsDatabase) {}

  async execute(query: string, values: unknown[] = []): Promise<unknown> {
    if (values.length > 0) this.db.run(query, toBindParams(query, values));
    else this.db.run(query);
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
  getSetting: async () => null,
  setSetting: async () => undefined,
}));

const { listPlaybooks, getRecentRuns, createPlaybook } = await import('./playbookService');

let SQL: SqlJsStatic;
let rawDb: SqlJsDatabase;

function execute(query: string, values: unknown[] = []): void {
  if (values.length > 0) rawDb.run(query, toBindParams(query, values));
  else rawDb.run(query);
}

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

function applyMigration(migration: Migration): void {
  const statements = migration.sql
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
  for (const statement of statements) {
    rawDb.run(statement);
  }
}

const MIGRATION_0017_INDEX = MIGRATIONS.findIndex(
  (migration) => migration.tag === '0017_modul_08_status_trennung',
);
const MIGRATION_0018 = MIGRATIONS.find(
  (migration) => migration.tag === '0018_fix_playbook_trigger_paid',
);

let counter = 0;

function seedOrder(): string {
  const id = crypto.randomUUID();
  counter += 1;
  const timestamp = new Date().toISOString();
  execute(
    `INSERT INTO orders (id, receipt_number, platform, quantity, sale_price, status, payment_status, order_date, tax_locked, created_at, updated_at)
     VALUES ($1, $2, 'direkt', 1, 25, 'confirmed', 'paid', '2026-06-01', 0, $3, $3)`,
    [id, `2026-${String(counter).padStart(4, '0')}`, timestamp],
  );
  return id;
}

function seedPlaybook(triggerStatus: string): string {
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  execute(
    `INSERT INTO playbooks (id, name, enabled, trigger_status, platform_filter, actions, created_at, updated_at)
     VALUES ($1, $2, 1, $3, NULL, $4, $5, $5)`,
    [
      id,
      `Playbook ${triggerStatus}`,
      triggerStatus,
      JSON.stringify([
        {
          type: 'create_task',
          title_template: 'Aufgabe',
          priority: 'medium',
          due_offset_days: null,
          link_order: true,
        },
      ]),
      timestamp,
    ],
  );
  return id;
}

function seedRun(
  playbookId: string,
  orderId: string,
  triggerStatus: string,
  status = 'success',
): string {
  const id = crypto.randomUUID();
  execute(
    `INSERT INTO playbook_runs (id, playbook_id, order_id, trigger_status, status, results, executed_at)
     VALUES ($1, $2, $3, $4, $5, '[]', $6)`,
    [id, playbookId, orderId, triggerStatus, status, new Date().toISOString()],
  );
  return id;
}

beforeAll(async () => {
  SQL = await initSqlJs({
    locateFile: (file: string) => path.join(process.cwd(), 'node_modules/sql.js/dist', file),
  });
  expect(MIGRATION_0017_INDEX).toBeGreaterThan(-1);
  expect(MIGRATION_0018).toBeDefined();
});

beforeEach(() => {
  rawDb = new SQL.Database();
  holder.db = new TestDatabase(rawDb) as never;
  counter = 0;
  // Zustand einer Alt-Installation: alles bis einschließlich 0016.
  for (const migration of MIGRATIONS.slice(0, MIGRATION_0017_INDEX)) {
    applyMigration(migration);
  }
});

describe('Migration 0018: playbook_runs paid → confirmed', () => {
  it('zieht Alt-Runs mit trigger_status=paid auf confirmed um (inkl. dry_run)', () => {
    const playbookId = seedPlaybook('paid');
    const orderId = seedOrder();
    const runId = seedRun(playbookId, orderId, 'paid');
    const dryRunId = seedRun(playbookId, orderId, 'paid', 'dry_run');

    applyMigration(MIGRATIONS[MIGRATION_0017_INDEX]);
    applyMigration(MIGRATION_0018!);

    const runs = select('SELECT id, trigger_status FROM playbook_runs');
    expect(runs).toHaveLength(2);
    for (const run of runs) {
      expect([runId, dryRunId]).toContain(run.id);
      expect(run.trigger_status).toBe('confirmed');
    }
  });

  it('setzt playbooks mit trigger_status=paid auf confirmed (Sicherheitsnetz zu 0017)', () => {
    seedPlaybook('paid');
    seedPlaybook('shipped');

    applyMigration(MIGRATIONS[MIGRATION_0017_INDEX]);
    applyMigration(MIGRATION_0018!);

    const statuses = select('SELECT trigger_status FROM playbooks ORDER BY trigger_status').map(
      (row) => row.trigger_status,
    );
    // Enthält auch die zwei Seed-Playbooks aus Migration 0013 (paid→confirmed, shipped).
    expect(statuses).not.toContain('paid');
    expect(statuses).toContain('confirmed');
    expect(statuses).toContain('shipped');
  });

  it('lässt kollidierende Alt-Runs stehen statt am Unique-Index zu scheitern', () => {
    const playbookId = seedPlaybook('paid');
    const orderId = seedOrder();
    const legacyRunId = seedRun(playbookId, orderId, 'paid');
    // Nach dem Rename hat dasselbe Paar bereits einen echten confirmed-Run.
    const confirmedRunId = seedRun(playbookId, orderId, 'confirmed');

    applyMigration(MIGRATIONS[MIGRATION_0017_INDEX]);
    expect(() => applyMigration(MIGRATION_0018!)).not.toThrow();

    const legacy = select('SELECT trigger_status FROM playbook_runs WHERE id = $1', [legacyRunId]);
    const confirmed = select('SELECT trigger_status FROM playbook_runs WHERE id = $1', [
      confirmedRunId,
    ]);
    expect(legacy[0].trigger_status).toBe('paid');
    expect(confirmed[0].trigger_status).toBe('confirmed');
  });

  it('ist idempotent: zweiter Lauf verändert nichts und wirft nicht', () => {
    const playbookId = seedPlaybook('paid');
    const orderId = seedOrder();
    seedRun(playbookId, orderId, 'paid');
    seedRun(playbookId, orderId, 'confirmed');

    applyMigration(MIGRATIONS[MIGRATION_0017_INDEX]);
    applyMigration(MIGRATION_0018!);
    const firstPass = select('SELECT id, trigger_status FROM playbook_runs ORDER BY id');

    expect(() => applyMigration(MIGRATION_0018!)).not.toThrow();
    const secondPass = select('SELECT id, trigger_status FROM playbook_runs ORDER BY id');
    expect(secondPass).toEqual(firstPass);
  });
});

describe('Tolerantes Laden trotz veralteter trigger_status-Werte', () => {
  beforeEach(() => {
    applyMigration(MIGRATIONS[MIGRATION_0017_INDEX]);
    applyMigration(MIGRATION_0018!);
  });

  it('listPlaybooks markiert unbekannte Trigger statt komplett zu scheitern', async () => {
    // Rest-Zustand simulieren, den die Migration nicht erreichen konnte.
    seedPlaybook('paid');

    const items = await listPlaybooks();
    const invalid = items.filter((item) => !item.trigger_status_valid);
    expect(invalid).toHaveLength(1);
    expect(invalid[0].trigger_status).toBe('paid');
    // Die zwei Seeds aus Migration 0013 bleiben normal nutzbar.
    expect(items.filter((item) => item.trigger_status_valid)).toHaveLength(2);
  });

  it('listPlaybooks überspringt komplett defekte Einträge einzeln', async () => {
    const playbookId = seedPlaybook('confirmed');
    execute(`UPDATE playbooks SET actions = 'kein json' WHERE id = $1`, [playbookId]);

    const items = await listPlaybooks();
    expect(items.some((item) => item.id === playbookId)).toBe(false);
    expect(items).toHaveLength(2);
  });

  it('getRecentRuns liefert auch Runs mit veraltetem trigger_status', async () => {
    const playbookId = seedPlaybook('confirmed');
    const orderId = seedOrder();
    seedRun(playbookId, orderId, 'paid');
    seedRun(playbookId, orderId, 'confirmed');

    const runs = await getRecentRuns();
    expect(runs).toHaveLength(2);
    expect(runs.map((run) => run.trigger_status).sort()).toEqual(['confirmed', 'paid']);
  });

  it('createPlaybook funktioniert weiterhin (Anlegen nicht blockiert)', async () => {
    seedPlaybook('paid');

    const playbook = await createPlaybook({
      name: 'Neues Playbook',
      trigger_status: 'confirmed',
      actions: [
        {
          type: 'create_task',
          title_template: 'Neue Aufgabe',
          priority: 'medium',
          due_offset_days: null,
          link_order: true,
        },
      ],
    });
    expect(playbook.trigger_status).toBe('confirmed');

    const items = await listPlaybooks();
    expect(items.some((item) => item.id === playbook.id)).toBe(true);
  });
});
