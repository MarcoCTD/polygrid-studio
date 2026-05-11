import { getDatabase } from '@/services/database';
import { syncJobSchema, type Platform, type SyncJob, type SyncJobStatus } from './sync-jobs-schema';

export interface SyncJobFilters {
  platform?: Platform;
  status?: SyncJobStatus;
  listingId?: string;
  limit?: number;
}

type SyncJobRow = Record<string, unknown>;

function rowToSyncJob(row: SyncJobRow): SyncJob {
  return syncJobSchema.parse({
    ...row,
    listing_id: row.listing_id ?? null,
    order_id: row.order_id ?? null,
    request_payload: row.request_payload ?? null,
    response_payload: row.response_payload ?? null,
    error_message: row.error_message ?? null,
    http_status_code: row.http_status_code ?? null,
    completed_at: row.completed_at ?? null,
  });
}

export async function getSyncJobs(filters: SyncJobFilters = {}): Promise<SyncJob[]> {
  try {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.platform) {
      params.push(filters.platform);
      conditions.push(`platform = $${params.length}`);
    }

    if (filters.status) {
      params.push(filters.status);
      conditions.push(`status = $${params.length}`);
    }

    if (filters.listingId) {
      params.push(filters.listingId);
      conditions.push(`listing_id = $${params.length}`);
    }

    const limit = Math.max(1, Math.min(filters.limit ?? 50, 200));
    params.push(limit);

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await getDatabase().select<SyncJobRow[]>(
      `SELECT * FROM sync_jobs ${where} ORDER BY started_at DESC LIMIT $${params.length}`,
      params,
    );
    return rows.map(rowToSyncJob);
  } catch (error) {
    throw new Error(
      `Sync-Jobs konnten nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function getRunningSyncJobs(): Promise<SyncJob[]> {
  try {
    const rows = await getDatabase().select<SyncJobRow[]>(
      `SELECT * FROM sync_jobs
       WHERE status IN ('pending', 'running', 'retrying')
       ORDER BY started_at DESC`,
    );
    return rows.map(rowToSyncJob);
  } catch (error) {
    throw new Error(
      `Laufende Sync-Jobs konnten nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
