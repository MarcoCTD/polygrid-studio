import { getDatabase } from '@/services/database';
import {
  actionResultSchema,
  playbookCreateSchema,
  playbookListItemSchema,
  playbookRunSchema,
  playbookSchema,
  playbookUpdateSchema,
  type ActionResult,
  type Playbook,
  type PlaybookCreate,
  type PlaybookListItem,
  type PlaybookRun,
  type PlaybookUpdate,
} from '../schemas';

type Row = Record<string, unknown>;

function now(): string {
  return new Date().toISOString();
}

function parseJsonColumn(value: unknown): unknown {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function playbookRowInput(row: Row): Record<string, unknown> {
  return {
    id: row.id,
    name: row.name,
    enabled: Boolean(row.enabled),
    trigger_status: row.trigger_status,
    platform_filter: parseJsonColumn(row.platform_filter),
    actions: parseJsonColumn(row.actions) ?? [],
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at ?? null,
  };
}

/** Strenge Variante für die Engine: trigger_status muss im aktuellen Enum liegen. */
export function rowToPlaybook(row: Row): Playbook {
  return playbookSchema.parse(playbookRowInput(row));
}

/** Tolerante Variante für Listen/Anzeige: unbekannter trigger_status wird markiert statt geworfen. */
export function rowToPlaybookListItem(row: Row): PlaybookListItem {
  return playbookListItemSchema.parse(playbookRowInput(row));
}

/**
 * Streng geparste Fassung eines Listen-Eintrags – null, wenn der Eintrag
 * (z.B. wegen veraltetem trigger_status) kein gültiges Playbook mehr ist.
 * Für Pfade, die ein echtes Playbook brauchen (Dry-Run).
 */
export function playbookFromListItem(item: PlaybookListItem): Playbook | null {
  const { trigger_status_valid: _valid, ...candidate } = item;
  const parsed = playbookSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function rowToPlaybookRun(row: Row): PlaybookRun {
  return playbookRunSchema.parse({
    id: row.id,
    playbook_id: row.playbook_id,
    order_id: row.order_id,
    trigger_status: row.trigger_status,
    status: row.status,
    results: parseJsonColumn(row.results) ?? [],
    executed_at: row.executed_at,
  });
}

export async function listPlaybooks(includeDeleted = false): Promise<PlaybookListItem[]> {
  try {
    const rows = await getDatabase().select<Row[]>(
      `SELECT * FROM playbooks
       ${includeDeleted ? '' : 'WHERE deleted_at IS NULL'}
       ORDER BY name COLLATE NOCASE ASC`,
    );
    // Pro Zeile parsen: ein einzelner defekter Eintrag (z.B. kaputtes
    // actions-JSON) darf die restliche Liste nicht blockieren.
    const items: PlaybookListItem[] = [];
    for (const row of rows) {
      try {
        items.push(rowToPlaybookListItem(row));
      } catch (error) {
        console.error('[Playbooks] Defekter Playbook-Eintrag übersprungen', {
          playbookId: row.id,
          error,
        });
      }
    }
    return items;
  } catch (error) {
    throw new Error(
      `Playbooks konnten nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function getPlaybookById(id: string): Promise<PlaybookListItem | null> {
  try {
    const rows = await getDatabase().select<Row[]>(
      'SELECT * FROM playbooks WHERE id = $1 LIMIT 1',
      [id],
    );
    return rows[0] ? rowToPlaybookListItem(rows[0]) : null;
  } catch (error) {
    throw new Error(
      `Playbook konnte nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function createPlaybook(data: PlaybookCreate): Promise<Playbook> {
  try {
    const input = playbookCreateSchema.parse(data);
    const id = crypto.randomUUID();
    const timestamp = now();

    await getDatabase().execute(
      `INSERT INTO playbooks (
        id, name, enabled, trigger_status, platform_filter, actions,
        created_at, updated_at, deleted_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        input.name,
        input.enabled ? 1 : 0,
        input.trigger_status,
        input.platform_filter && input.platform_filter.length > 0
          ? JSON.stringify(input.platform_filter)
          : null,
        JSON.stringify(input.actions),
        timestamp,
        timestamp,
        null,
      ],
    );

    const item = await getPlaybookById(id);
    // Frisch angelegte Playbooks sind durch playbookCreateSchema immer strikt gültig.
    const playbook = item ? playbookFromListItem(item) : null;
    if (!playbook) throw new Error(`Playbook ${id} wurde nach Erstellung nicht gefunden.`);
    return playbook;
  } catch (error) {
    throw new Error(
      `Playbook konnte nicht erstellt werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function updatePlaybook(id: string, data: PlaybookUpdate): Promise<PlaybookListItem> {
  try {
    const input = playbookUpdateSchema.parse(data);
    const existing = await getPlaybookById(id);
    if (!existing) throw new Error(`Playbook ${id} nicht gefunden.`);

    const setClauses = ['updated_at = $1'];
    const params: unknown[] = [now()];

    if (input.name !== undefined) {
      params.push(input.name);
      setClauses.push(`name = $${params.length}`);
    }
    if (input.enabled !== undefined) {
      params.push(input.enabled ? 1 : 0);
      setClauses.push(`enabled = $${params.length}`);
    }
    if (input.trigger_status !== undefined) {
      params.push(input.trigger_status);
      setClauses.push(`trigger_status = $${params.length}`);
    }
    if (input.platform_filter !== undefined) {
      params.push(
        input.platform_filter && input.platform_filter.length > 0
          ? JSON.stringify(input.platform_filter)
          : null,
      );
      setClauses.push(`platform_filter = $${params.length}`);
    }
    if (input.actions !== undefined) {
      params.push(JSON.stringify(input.actions));
      setClauses.push(`actions = $${params.length}`);
    }

    params.push(id);
    await getDatabase().execute(
      `UPDATE playbooks SET ${setClauses.join(', ')} WHERE id = $${params.length}`,
      params,
    );

    const updated = await getPlaybookById(id);
    if (!updated) throw new Error(`Playbook ${id} nicht gefunden nach Update.`);
    return updated;
  } catch (error) {
    throw new Error(
      `Playbook konnte nicht aktualisiert werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function softDeletePlaybook(id: string): Promise<void> {
  try {
    const timestamp = now();
    await getDatabase().execute(
      'UPDATE playbooks SET deleted_at = $1, updated_at = $1 WHERE id = $2',
      [timestamp, id],
    );
  } catch (error) {
    throw new Error(
      `Playbook konnte nicht gelöscht werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// ============================================================
// Runs (Ausführungs-Log)
// ============================================================

export interface PlaybookRunListItem extends PlaybookRun {
  playbook_name: string | null;
  order_receipt_number: string | null;
}

export async function getRecentRuns(limit = 50): Promise<PlaybookRunListItem[]> {
  try {
    const rows = await getDatabase().select<Row[]>(
      `SELECT r.*, p.name AS playbook_name, o.receipt_number AS order_receipt_number
       FROM playbook_runs r
       LEFT JOIN playbooks p ON p.id = r.playbook_id
       LEFT JOIN orders o ON o.id = r.order_id
       ORDER BY r.executed_at DESC
       LIMIT $1`,
      [limit],
    );
    // Pro Zeile parsen: ein defekter Alt-Eintrag darf das Log nicht blockieren.
    const items: PlaybookRunListItem[] = [];
    for (const row of rows) {
      try {
        items.push({
          ...rowToPlaybookRun(row),
          playbook_name: (row.playbook_name as string | null | undefined) ?? null,
          order_receipt_number: (row.order_receipt_number as string | null | undefined) ?? null,
        });
      } catch (error) {
        console.error('[Playbooks] Defekter Log-Eintrag übersprungen', { runId: row.id, error });
      }
    }
    return items;
  } catch (error) {
    throw new Error(
      `Playbook-Log konnte nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** Letzte Ausführung pro Playbook (für die Verwaltungsliste). */
export async function getLastRunPerPlaybook(): Promise<Map<string, string>> {
  try {
    const rows = await getDatabase().select<{ playbook_id: string; last_run: string }[]>(
      `SELECT playbook_id, MAX(executed_at) AS last_run
       FROM playbook_runs
       GROUP BY playbook_id`,
    );
    return new Map(rows.map((row) => [row.playbook_id, row.last_run]));
  } catch (error) {
    throw new Error(
      `Letzte Ausführungen konnten nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// ============================================================
// Vorlagen-Vorschläge (suggest_template)
// Offene Vorschläge leben in results der Runs, kein eigenes Schema.
// ============================================================

export interface TemplateSuggestion {
  run_id: string;
  result_index: number;
  template_id: string;
  template_name: string;
  playbook_id: string;
}

export async function getOpenTemplateSuggestions(orderId: string): Promise<TemplateSuggestion[]> {
  try {
    const rows = await getDatabase().select<Row[]>(
      `SELECT * FROM playbook_runs
       WHERE order_id = $1 AND status != 'dry_run'
       ORDER BY executed_at DESC`,
      [orderId],
    );

    const suggestions: TemplateSuggestion[] = [];
    for (const row of rows) {
      let run: PlaybookRun;
      try {
        run = rowToPlaybookRun(row);
      } catch (error) {
        // Ein defekter Alt-Run darf die Vorschläge der übrigen nicht blockieren.
        console.error('[Playbooks] Defekter Run bei Vorschlags-Suche übersprungen', {
          runId: row.id,
          error,
        });
        continue;
      }
      run.results.forEach((result, index) => {
        if (
          result.action_type === 'suggest_template' &&
          result.status === 'success' &&
          !result.dismissed &&
          result.template_id
        ) {
          suggestions.push({
            run_id: run.id,
            result_index: index,
            template_id: result.template_id,
            template_name: result.template_name ?? 'Unbenannte Vorlage',
            playbook_id: run.playbook_id,
          });
        }
      });
    }
    return suggestions;
  } catch (error) {
    throw new Error(
      `Vorlagen-Vorschläge konnten nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** Markiert einen suggest_template-Vorschlag im Run-Result als verworfen. */
export async function dismissTemplateSuggestion(runId: string, resultIndex: number): Promise<void> {
  try {
    const db = getDatabase();
    const rows = await db.select<Row[]>('SELECT * FROM playbook_runs WHERE id = $1 LIMIT 1', [
      runId,
    ]);
    if (!rows[0]) throw new Error(`Run ${runId} nicht gefunden.`);

    const run = rowToPlaybookRun(rows[0]);
    const result = run.results[resultIndex];
    if (!result) throw new Error(`Run ${runId} hat kein Result an Position ${resultIndex}.`);

    const updatedResults: ActionResult[] = run.results.map((entry, index) =>
      index === resultIndex ? actionResultSchema.parse({ ...entry, dismissed: true }) : entry,
    );

    await db.execute('UPDATE playbook_runs SET results = $1 WHERE id = $2', [
      JSON.stringify(updatedResults),
      runId,
    ]);
  } catch (error) {
    throw new Error(
      `Vorschlag konnte nicht verworfen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
