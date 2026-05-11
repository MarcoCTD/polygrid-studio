import { getDatabase } from '@/services/database';
import {
  createSyncJobSchema,
  updateSyncJobSchema,
  type CreateSyncJobInput,
  type SyncJob,
  type UpdateSyncJobInput,
} from '../db/sync-jobs-schema';
import { getSyncJobs } from '../db/sync-jobs-queries';

const MAX_PAYLOAD_LENGTH = 10_000;

function now(): string {
  return new Date().toISOString();
}

function serializePayload(payload: unknown): string | null {
  if (payload === undefined || payload === null) return null;
  const value = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return value.length > MAX_PAYLOAD_LENGTH ? value.slice(0, MAX_PAYLOAD_LENGTH) : value;
}

export async function createSyncJob(input: CreateSyncJobInput): Promise<string> {
  try {
    const parsed = createSyncJobSchema.parse(input);
    const id = crypto.randomUUID();
    const timestamp = now();

    await getDatabase().execute(
      `INSERT INTO sync_jobs (
        id, platform, operation, listing_id, order_id, direction, status, request_payload,
        response_payload, error_message, http_status_code, retry_count, started_at, completed_at,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'running', $7, NULL, NULL, NULL, 0, $8, NULL, $8)`,
      [
        id,
        parsed.platform,
        parsed.operation,
        parsed.listing_id ?? null,
        parsed.order_id ?? null,
        parsed.direction,
        serializePayload(parsed.request_payload),
        timestamp,
      ],
    );

    return id;
  } catch (error) {
    throw new Error(
      `Sync-Job konnte nicht erstellt werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function updateSyncJob(id: string, input: UpdateSyncJobInput): Promise<void> {
  try {
    const parsed = updateSyncJobSchema.parse(input);
    const entries = Object.entries(parsed).filter(([, value]) => value !== undefined);
    if (entries.length === 0) return;

    const params: unknown[] = [];
    const assignments = entries.map(([key, value]) => {
      params.push(
        key === 'response_payload' ? serializePayload(value) : value,
      );
      return `${key} = $${params.length}`;
    });
    params.push(id);

    await getDatabase().execute(
      `UPDATE sync_jobs SET ${assignments.join(', ')} WHERE id = $${params.length}`,
      params,
    );
  } catch (error) {
    throw new Error(
      `Sync-Job konnte nicht aktualisiert werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function completeSyncJob(
  id: string,
  input: Omit<UpdateSyncJobInput, 'completed_at'>,
): Promise<void> {
  await updateSyncJob(id, { ...input, completed_at: now() });
}

export async function failSyncJob(
  id: string,
  errorMessage: string,
  httpStatusCode: number | null = null,
  retryCount?: number,
): Promise<void> {
  await completeSyncJob(id, {
    status: 'error',
    error_message: errorMessage,
    http_status_code: httpStatusCode,
    retry_count: retryCount,
  });
}

export async function getRecentSyncJobs(limit = 50): Promise<SyncJob[]> {
  return getSyncJobs({ limit });
}
