import Database from "@tauri-apps/plugin-sql";

const DB_PATH = "sqlite:polygrid.db";

let _db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!_db) {
    _db = await Database.load(DB_PATH);
  }
  return _db;
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
