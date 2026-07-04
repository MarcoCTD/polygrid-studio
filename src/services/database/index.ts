/**
 * Zentraler Datenbank-Service fuer PolyGrid Studio.
 *
 * Verwendet @tauri-apps/plugin-sql fuer SQLite-Zugriff.
 * Drizzle ORM liefert Schema-Definitionen und TypeScript-Typen,
 * Queries laufen direkt ueber die Tauri SQL Plugin API.
 */
import Database from '@tauri-apps/plugin-sql';
import { invoke } from '@tauri-apps/api/core';
import { DEFAULTS } from '@/services/settings/defaults';
import { MIGRATIONS, type Migration } from './migrations';

const DB_PATH = 'sqlite:polygrid.db';
const STATEMENT_BREAKPOINT = '--> statement-breakpoint';

let dbInstance: Database | null = null;

function migrationBackupErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

async function createPreMigrationBackup(pendingMigrations: Migration[]): Promise<void> {
  const timestamp = new Date().toISOString();
  const migrationTags = pendingMigrations.map((migration) => migration.tag).join(', ');

  try {
    const path = await invoke<string>('create_pre_migration_backup', { timestamp });
    console.info('[Database] Pre-migration backup created', {
      path,
      timestamp,
      pendingMigrations: migrationTags,
    });
  } catch (error) {
    const message = migrationBackupErrorMessage(error);
    console.error('[Database] Pre-migration backup failed', {
      timestamp,
      pendingMigrations: migrationTags,
      error,
    });
    throw new Error(
      `Pre-Migration-Backup fehlgeschlagen. Die ausstehenden Migrationen wurden nicht ausgeführt. Ursache: ${message}`,
    );
  }
}

/**
 * Gibt die aktive DB-Instanz zurueck.
 * Wirft einen Fehler, wenn die DB noch nicht initialisiert wurde.
 */
export function getDatabase(): Database {
  if (!dbInstance) {
    throw new Error('Datenbank nicht initialisiert. Bitte initDatabase() zuerst aufrufen.');
  }
  return dbInstance;
}

/**
 * Initialisiert die SQLite-Datenbank:
 * 1. Verbindung oeffnen
 * 2. PRAGMA foreign_keys = ON
 * 3. Migrations-Tracking-Tabelle erstellen
 * 4. Ausstehende Migrations ausfuehren
 * 5. Default-Settings einfuegen falls leer
 *
 * Wirft bei Fehler – die App darf NICHT mit einer fehlerhaften DB starten.
 */
export async function initDatabase(): Promise<void> {
  const db = await Database.load(DB_PATH);

  // PRAGMA foreign_keys muss bei jeder Verbindung gesetzt werden
  await db.execute('PRAGMA foreign_keys = ON');

  // Migrations-Tracking-Tabelle
  await db.execute(`
    CREATE TABLE IF NOT EXISTS _migrations (
      tag TEXT PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);

  // Bereits angewendete Migrations ermitteln
  const applied = await db.select<{ tag: string }[]>('SELECT tag FROM _migrations ORDER BY tag');
  const appliedTags = new Set(applied.map((row) => row.tag));
  const pendingMigrations = MIGRATIONS.filter((migration) => !appliedTags.has(migration.tag));

  if (pendingMigrations.length > 0) {
    await createPreMigrationBackup(pendingMigrations);
  }

  // Ausstehende Migrations sequenziell ausfuehren
  for (const migration of pendingMigrations) {
    // SQL am Breakpoint-Marker aufteilen und einzeln ausfuehren
    const statements = migration.sql
      .split(STATEMENT_BREAKPOINT)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      await db.execute(statement);
    }

    // Migration als angewendet markieren
    await db.execute('INSERT INTO _migrations (tag, applied_at) VALUES ($1, $2)', [
      migration.tag,
      new Date().toISOString(),
    ]);
  }

  // Default-Settings einfuegen, ohne bestehende Nutzerwerte zu ueberschreiben.
  const now = new Date().toISOString();
  for (const [key, value] of Object.entries(DEFAULTS)) {
    await db.execute(
      'INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES ($1, $2, $3)',
      [key, JSON.stringify(value), now],
    );
  }

  dbInstance = db;
}

/**
 * Liest einen Wert aus app_settings.
 */
export async function getSetting<T = string>(key: string): Promise<T | null> {
  const db = getDatabase();
  const rows = await db.select<{ value: string }[]>(
    'SELECT value FROM app_settings WHERE key = $1',
    [key],
  );
  if (rows.length === 0) return null;
  return JSON.parse(rows[0].value) as T;
}

/**
 * Schreibt einen Wert in app_settings (upsert).
 */
export async function setSetting(key: string, value: unknown): Promise<void> {
  const db = getDatabase();
  const jsonValue = JSON.stringify(value);
  const now = new Date().toISOString();

  await db.execute(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ($1, $2, $3)
     ON CONFLICT(key) DO UPDATE SET value = $2, updated_at = $3`,
    [key, jsonValue, now],
  );
}
