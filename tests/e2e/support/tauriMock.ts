/**
 * Tauri-API-Mock fuer Browser-E2E-Tests.
 *
 * Die App spricht Tauri ueber `window.__TAURI_INTERNALS__.invoke` an.
 * Dieser Mock brueckt alle invoke-Aufrufe per Playwright exposeFunction
 * in den Node-Prozess und bedient sie dort:
 *
 * - `plugin:sql|*`  -> echte SQLite-Semantik via sql.js (In-Memory).
 *   Dadurch laufen die echten Drizzle-Migrationen der App beim Start.
 *   Die DB lebt pro Test im Node-Prozess und ueberlebt page.reload().
 * - Keychain-/Backup-/Dateisystem-Commands -> In-Memory-Fixtures.
 * - Unbekannte Commands -> Fehler, damit Luecken im Mock sichtbar werden.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as base, type Page } from '@playwright/test';
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

let sqlJsPromise: Promise<SqlJsStatic> | null = null;

function loadSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs({
      locateFile: (file: string) => path.join(projectRoot, 'node_modules/sql.js/dist', file),
    });
  }
  return sqlJsPromise;
}

type SqlValue = string | number | null;
type InvokeArgs = Record<string, unknown>;

function toSqlValue(value: unknown): SqlValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number' || typeof value === 'string') return value;
  return JSON.stringify(value);
}

/**
 * Die App nutzt gemischt `$1`-Parameter und `?`-Parameter (wie sqlx).
 * sql.js braucht dafuer unterschiedliche Bind-Formen: benanntes Objekt
 * fuer `$N`, positionsbasiertes Array fuer `?`.
 */
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

export class TauriMock {
  private db: Database;
  /** Alle invoke-Kommandos in Aufruf-Reihenfolge, fuer Assertions in Tests. */
  readonly invokeLog: Array<{ cmd: string; args: InvokeArgs }> = [];
  readonly keychain = new Map<string, string>();
  readonly writtenFiles = new Map<string, string>();
  /** Rueckgabewert fuer den naechsten plugin:dialog|open / |save Aufruf. */
  nextDialogResult: string | string[] | null = null;
  /** Simuliert belegte Zielpfade fuer import_file_to_base (relativ zur Basis). */
  readonly existingImportTargets = new Set<string>();
  /** Erfolgreiche Importe in Aufruf-Reihenfolge, fuer Assertions. */
  readonly importedFiles: Array<{ source: string; targetPath: string }> = [];
  /** Fehlermeldung, mit der der naechste import_file_to_base-Aufruf abbricht. */
  nextImportError: string | null = null;

  constructor(db: Database) {
    this.db = db;
  }

  static async create(): Promise<TauriMock> {
    const SQL = await loadSqlJs();
    return new TauriMock(new SQL.Database());
  }

  async handle(cmd: string, args: InvokeArgs): Promise<unknown> {
    this.invokeLog.push({ cmd, args });

    switch (cmd) {
      // ---------- SQL-Plugin: echte SQLite-Semantik via sql.js ----------
      case 'plugin:sql|load':
        return args.db as string;
      case 'plugin:sql|execute': {
        const query = args.query as string;
        const values = (args.values as unknown[]) ?? [];
        if (values.length > 0) {
          this.db.run(query, toBindParams(query, values));
        } else {
          this.db.run(query);
        }
        const rowsAffected = this.db.getRowsModified();
        const idResult = this.db.exec('SELECT last_insert_rowid() AS id');
        const lastInsertId = Number(idResult[0]?.values[0]?.[0] ?? 0);
        return [rowsAffected, lastInsertId];
      }
      case 'plugin:sql|select': {
        const query = args.query as string;
        const values = (args.values as unknown[]) ?? [];
        const stmt = this.db.prepare(query);
        try {
          if (values.length > 0) {
            stmt.bind(toBindParams(query, values));
          }
          const rows: Record<string, unknown>[] = [];
          while (stmt.step()) {
            rows.push(stmt.getAsObject());
          }
          return rows;
        } finally {
          stmt.free();
        }
      }
      case 'plugin:sql|close':
        return true;

      // ---------- Keychain (Rust-Commands) ----------
      case 'keychain_set':
      case 'set_api_key': {
        const key = String(args.key ?? args.provider ?? args.service ?? 'default');
        this.keychain.set(key, String(args.value ?? args.apiKey ?? ''));
        return null;
      }
      case 'keychain_get':
      case 'get_api_key': {
        const key = String(args.key ?? args.provider ?? args.service ?? 'default');
        return this.keychain.get(key) ?? null;
      }
      case 'keychain_delete':
      case 'delete_api_key': {
        const key = String(args.key ?? args.provider ?? args.service ?? 'default');
        this.keychain.delete(key);
        return null;
      }

      // ---------- Backup / Migration ----------
      case 'create_pre_migration_backup':
        return `/mock/backups/pre-migration-${String(args.timestamp ?? 'now')}.db`;
      case 'create_backup':
        return '/mock/backups/manual-backup.db';
      case 'get_backup_directory':
        return '/mock/backups';
      case 'list_backups':
        return [];
      case 'delete_backup':
        return null;

      // ---------- Dateisystem (Rust-Commands) ----------
      case 'check_path_exists':
        return true;
      case 'ensure_onedrive_structure':
        return null;
      case 'list_directory':
        return [];
      case 'get_file_info': {
        // Plausible Datei-Infos aus dem Pfad ableiten (Form wie im Rust-Command).
        const filePath = String(args.path ?? '');
        const name = filePath.split(/[\\/]/).filter(Boolean).pop() ?? filePath;
        const dotIndex = name.lastIndexOf('.');
        return {
          name,
          path: filePath,
          isDirectory: false,
          size: 1234,
          modifiedAt: 1_750_000_000,
          extension: dotIndex > 0 ? name.slice(dotIndex + 1) : null,
        };
      }
      case 'import_file_to_base': {
        if (this.nextImportError) {
          const message = this.nextImportError;
          this.nextImportError = null;
          throw new Error(message);
        }

        const targetFolder = String(args.targetFolder ?? '');
        const fileName = String(args.fileName ?? '');
        const targetPath = this.resolveImportTarget(targetFolder, fileName);
        this.existingImportTargets.add(targetPath);
        this.importedFiles.push({ source: String(args.source ?? ''), targetPath });
        return {
          operationType: 'import',
          sourcePath: String(args.source ?? ''),
          targetPath,
          isUndoable: false,
        };
      }
      case 'write_export_file': {
        // Binärdatei-Export (Modul 14): Inhalt als Base64 ablegen, damit Tests
        // die xlsx im Node-Prozess zurücklesen können.
        const filePath = String(args.path ?? '');
        const contents = Buffer.from((args.contents as number[]) ?? []).toString('base64');
        this.writtenFiles.set(filePath, contents);
        return filePath;
      }
      case 'create_directory':
      case 'copy_file':
      case 'move_file':
      case 'rename_file':
      case 'delete_to_archive':
      case 'undo_last_operation':
      case 'open_in_explorer':
        return null;

      // ---------- KI (im Browser-Test nicht verfuegbar) ----------
      case 'ai_test_connection':
      case 'ai_generate_text':
      case 'ai_generate_structured':
      case 'ai_estimate_cost':
        throw new Error('KI-Funktionen sind im E2E-Mock nicht verfuegbar');

      // ---------- Tauri-Plugins ----------
      case 'plugin:dialog|open':
      case 'plugin:dialog|save': {
        const result = this.nextDialogResult;
        this.nextDialogResult = null;
        return result;
      }
      case 'plugin:fs|write_text_file':
      case 'plugin:fs|write_file': {
        const filePath = String(args.path ?? '');
        this.writtenFiles.set(filePath, String(args.contents ?? ''));
        return null;
      }
      case 'plugin:fs|read_text_file': {
        const filePath = String(args.path ?? '');
        const contents = this.writtenFiles.get(filePath);
        if (contents === undefined) throw new Error(`Mock: Datei nicht gefunden: ${filePath}`);
        return contents;
      }
      case 'plugin:opener|open_url':
      case 'plugin:opener|open_path':
      case 'plugin:opener|reveal_item_in_dir':
        return null;

      default:
        throw new Error(`TauriMock: unbekanntes Kommando "${cmd}" (Args: ${JSON.stringify(args)})`);
    }
  }

  /** Namenskonflikt-Aufloesung wie im Rust-Command: Suffix -1, -2, ... */
  private resolveImportTarget(targetFolder: string, fileName: string): string {
    const first = `${targetFolder}/${fileName}`;
    if (!this.existingImportTargets.has(first)) {
      return first;
    }

    const dotIndex = fileName.lastIndexOf('.');
    const stem = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
    const extension = dotIndex > 0 ? fileName.slice(dotIndex) : '';
    for (let suffix = 1; suffix <= 999; suffix++) {
      const candidate = `${targetFolder}/${stem}-${suffix}${extension}`;
      if (!this.existingImportTargets.has(candidate)) {
        return candidate;
      }
    }
    throw new Error('Mock: kein freier Dateiname am Zielort gefunden.');
  }

  /** Direkter SQL-Zugriff fuer Test-Assertions und Seeds. */
  select(query: string, values: unknown[] = []): Record<string, unknown>[] {
    const stmt = this.db.prepare(query);
    try {
      if (values.length > 0) stmt.bind(toBindParams(query, values));
      const rows: Record<string, unknown>[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      return rows;
    } finally {
      stmt.free();
    }
  }

  execute(query: string, values: unknown[] = []): void {
    if (values.length > 0) {
      this.db.run(query, toBindParams(query, values));
    } else {
      this.db.run(query);
    }
  }
}

export async function installTauriMock(page: Page): Promise<TauriMock> {
  const mock = await TauriMock.create();

  await page.exposeFunction('__TAURI_MOCK_INVOKE__', (cmd: string, args: InvokeArgs) =>
    mock.handle(cmd, args ?? {}),
  );

  await page.addInitScript(() => {
    const internals = {
      invoke: (cmd: string, args?: Record<string, unknown>) =>
        (
          window as unknown as {
            __TAURI_MOCK_INVOKE__: (c: string, a: Record<string, unknown>) => Promise<unknown>;
          }
        ).__TAURI_MOCK_INVOKE__(cmd, args ?? {}),
      convertFileSrc: (filePath: string, protocol = 'asset') => `${protocol}://${filePath}`,
      transformCallback: (callback?: (response: unknown) => void) => {
        const id = Math.floor(Math.random() * 1_000_000);
        (window as unknown as Record<string, unknown>)[`_${id}`] = callback;
        return id;
      },
      unregisterCallback: () => undefined,
      metadata: {
        currentWindow: { label: 'main' },
        currentWebview: { label: 'main', windowLabel: 'main' },
      },
      plugins: {},
    };
    Object.defineProperty(window, '__TAURI_INTERNALS__', { value: internals });
  });

  return mock;
}

/**
 * Playwright-Fixture: `page` hat den Tauri-Mock bereits installiert,
 * `tauri` gibt Zugriff auf DB/Keychain/Invoke-Log fuer Assertions.
 */
export const test = base.extend<{ tauri: TauriMock }>({
  tauri: [
    async ({ page }, use) => {
      const mock = await installTauriMock(page);
      await use(mock);
    },
    // auto: Mock wird fuer JEDEN Test installiert, auch wenn die Fixture
    // nicht explizit destrukturiert wird.
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
