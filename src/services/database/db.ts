import { isTauri } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";

const DB_PATH = "sqlite:polygrid.db";
const DB_TIMEOUT_MS = 10_000;
const TAURI_RUNTIME_ERROR =
  "Tauri-Runtime nicht verfügbar. Starte die App mit `npm run tauri:dev` oder verwende einen gebauten Desktop-Build.";

let _dbPromise: Promise<Database> | null = null;

/** Wrap a promise with a timeout to prevent infinite hangs */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label}: Timeout nach ${ms}ms`));
    }, ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

export function getDb(): Promise<Database> {
  if (!isTauri()) {
    return Promise.reject(new Error(TAURI_RUNTIME_ERROR));
  }

  if (!_dbPromise) {
    console.log("[DB] Initialisiere Datenbankverbindung…", DB_PATH);
    _dbPromise = withTimeout(Database.load(DB_PATH), DB_TIMEOUT_MS, "Database.load")
      .then(async (db) => {
        console.log("[DB] Verbindung hergestellt, setze PRAGMAs…");
        await withTimeout(db.execute("PRAGMA journal_mode=WAL;", []), DB_TIMEOUT_MS, "PRAGMA journal_mode");
        await withTimeout(db.execute("PRAGMA foreign_keys=ON;", []), DB_TIMEOUT_MS, "PRAGMA foreign_keys");
        console.log("[DB] Datenbank bereit.");
        return db;
      })
      .catch((err) => {
        console.error("[DB] Fehler bei Initialisierung:", err);
        _dbPromise = null; // Allow retry on next call
        throw err;
      });
  }
  return _dbPromise;
}

export async function dbSelect<T>(
  query: string,
  bindValues: unknown[] = [],
  label = "db.select"
): Promise<T> {
  const db = await getDb();
  return withTimeout(db.select<T>(query, bindValues), DB_TIMEOUT_MS, label);
}

export async function dbExecute(
  query: string,
  bindValues: unknown[] = [],
  label = "db.execute"
) {
  const db = await getDb();
  return withTimeout(db.execute(query, bindValues), DB_TIMEOUT_MS, label);
}

/** Parse a JSON column that may be null/empty → typed array */
export function parseJsonArray<T>(value: string | null | undefined): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Serialize array to JSON string for storage */
export function toJsonString(value: unknown[] | null | undefined): string | null {
  if (!value || value.length === 0) return null;
  return JSON.stringify(value);
}

/** ISO-8601 timestamp for now */
export function now(): string {
  return new Date().toISOString();
}
