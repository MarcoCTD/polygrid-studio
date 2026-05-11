import { z } from 'zod';
import {
  type Platform,
  type SyncDirection,
  type SyncJobStatus,
  type SyncOperation,
} from '../providers/types';

export const platformSchema = z.enum(['etsy', 'ebay']);
export const syncDirectionSchema = z.enum(['push', 'pull']);
export const syncJobStatusSchema = z.enum(['pending', 'running', 'success', 'error', 'retrying']);
export const syncOperationSchema = z.enum([
  'push_listing',
  'update_listing',
  'pause_listing',
  'delete_listing',
  'upload_image',
  'pull_orders',
  'load_policies',
  'token_refresh',
]);

export const syncJobSchema = z.object({
  id: z.string().uuid(),
  platform: platformSchema,
  operation: syncOperationSchema,
  listing_id: z.string().uuid().nullable(),
  order_id: z.string().uuid().nullable(),
  direction: syncDirectionSchema,
  status: syncJobStatusSchema,
  request_payload: z.string().nullable(),
  response_payload: z.string().nullable(),
  error_message: z.string().nullable(),
  http_status_code: z.number().int().nullable(),
  retry_count: z.number().int().min(0),
  started_at: z.string().min(1),
  completed_at: z.string().nullable(),
  created_at: z.string().min(1),
});

export const createSyncJobSchema = z.object({
  platform: platformSchema,
  operation: syncOperationSchema,
  listing_id: z.string().uuid().nullable().optional(),
  order_id: z.string().uuid().nullable().optional(),
  direction: syncDirectionSchema,
  request_payload: z.unknown().optional(),
});

export const updateSyncJobSchema = z.object({
  status: syncJobStatusSchema.optional(),
  response_payload: z.unknown().optional(),
  error_message: z.string().nullable().optional(),
  http_status_code: z.number().int().nullable().optional(),
  retry_count: z.number().int().min(0).optional(),
  completed_at: z.string().nullable().optional(),
});

export type SyncJob = z.infer<typeof syncJobSchema>;
export type CreateSyncJobInput = z.infer<typeof createSyncJobSchema>;
export type UpdateSyncJobInput = z.infer<typeof updateSyncJobSchema>;

export type { Platform, SyncDirection, SyncJobStatus, SyncOperation };
