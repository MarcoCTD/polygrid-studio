import { getDatabase } from '@/services/database';
import type {
  IncompleteListing,
  LowMarginProduct,
  PipelineProduct,
  PipelineProductGroup,
  RecentOrder,
  RecentProduct,
} from '../types';

const PIPELINE_STATUSES = ['idea', 'review', 'test_print'] as const;

interface RecentProductRow {
  id: string;
  name: string;
  status: string;
  updated_at: string;
}

interface LowMarginProductRow {
  id: string;
  name: string;
  estimated_margin: number | string | null;
  status: string;
}

interface ListingRow {
  id: string;
  title: string;
  master_short_description: string | null;
  master_long_description: string | null;
  master_tags: unknown;
  platform: string | null;
}

interface PipelineProductRow {
  id: string;
  name: string;
  status: string;
}

interface RecentOrderRow {
  id: string;
  receipt_number: string;
  platform: string;
  product_name: string | null;
  status: string;
  updated_at: string;
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  if (typeof value !== 'string' || value.trim() === '') return [];

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

function groupPipelineProducts(rows: PipelineProductRow[]): PipelineProductGroup[] {
  const groups = new Map<string, PipelineProduct[]>();

  for (const status of PIPELINE_STATUSES) {
    groups.set(status, []);
  }

  for (const row of rows) {
    groups.get(row.status)?.push(row);
  }

  return Array.from(groups.entries())
    .map(([status, products]) => ({ status, products }))
    .filter((group) => group.products.length > 0);
}

function toIncompleteListing(row: ListingRow): IncompleteListing | null {
  const missingFields: string[] = [];
  const tags = parseStringArray(row.master_tags);
  const hasDescription = Boolean(
    row.master_short_description?.trim() || row.master_long_description?.trim(),
  );

  if (tags.length === 0) missingFields.push('Tags');
  if (!hasDescription) missingFields.push('Beschreibung');
  if (missingFields.length === 0) return null;

  return {
    id: row.id,
    title: row.title,
    platform: row.platform,
    completeness: Math.max(100 - missingFields.length * 50, 0),
    missingFields,
  };
}

export async function getRecentProducts(): Promise<RecentProduct[]> {
  try {
    const rows = await getDatabase().select<RecentProductRow[]>(
      `SELECT id, name, status, updated_at
       FROM products
       WHERE deleted_at IS NULL
       ORDER BY updated_at DESC
       LIMIT 5`,
    );
    return rows;
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Zuletzt bearbeitete Produkte konnten nicht laden',
    );
  }
}

export async function getLowMarginProducts(threshold: number): Promise<LowMarginProduct[]> {
  try {
    const rows = await getDatabase().select<LowMarginProductRow[]>(
      `SELECT id, name, estimated_margin, status
       FROM products
       WHERE deleted_at IS NULL
         AND status = 'online'
         AND estimated_margin IS NOT NULL
         AND estimated_margin < ?
       ORDER BY estimated_margin ASC
       LIMIT 5`,
      [threshold],
    );

    return rows.map((row) => ({
      ...row,
      estimated_margin: Number(row.estimated_margin ?? 0),
    }));
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Produkte mit schwacher Marge konnten nicht laden',
    );
  }
}

export async function getIncompleteListings(): Promise<IncompleteListing[]> {
  try {
    const rows = await getDatabase().select<ListingRow[]>(
      `SELECT
         l.id,
         l.master_title AS title,
         l.master_short_description,
         l.master_long_description,
         l.master_tags,
         (
           SELECT platform
           FROM listing_platform_overrides
           WHERE listing_id = l.id AND is_active = 1
           ORDER BY platform ASC
           LIMIT 1
         ) AS platform
       FROM listings l
       WHERE l.deleted_at IS NULL
         AND l.status != 'archived'
         AND (
           l.master_short_description IS NULL
           OR trim(l.master_short_description) = ''
           OR l.master_long_description IS NULL
           OR trim(l.master_long_description) = ''
           OR l.master_tags = '[]'
         )
       ORDER BY l.updated_at DESC
       LIMIT 5`,
    );

    return rows
      .map(toIncompleteListing)
      .filter((listing): listing is IncompleteListing => listing !== null);
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Unvollständige Listings konnten nicht laden',
    );
  }
}

export async function getPipelineProducts(): Promise<PipelineProductGroup[]> {
  try {
    const rows = await getDatabase().select<PipelineProductRow[]>(
      `SELECT id, name, status
       FROM products
       WHERE deleted_at IS NULL
         AND status IN (${placeholders(PIPELINE_STATUSES.length)})
       ORDER BY updated_at DESC
       LIMIT 30`,
      [...PIPELINE_STATUSES],
    );

    return groupPipelineProducts(rows);
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Pipeline-Produkte konnten nicht laden',
    );
  }
}

export async function getRecentOrders(): Promise<RecentOrder[]> {
  try {
    const rows = await getDatabase().select<RecentOrderRow[]>(
      `SELECT
         o.id,
         o.receipt_number,
         o.platform,
         p.name AS product_name,
         o.status,
         o.updated_at
       FROM orders o
       LEFT JOIN products p ON p.id = o.product_id
       WHERE o.deleted_at IS NULL
       ORDER BY o.updated_at DESC
       LIMIT 5`,
    );
    return rows;
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Auftrags-Timeline konnte nicht laden',
    );
  }
}
