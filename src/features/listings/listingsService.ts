import { getDatabase } from '@/services/database';
import {
  listingImageSelectSchema,
  listingInsertSchema,
  listingPlatformOverrideSelectSchema,
  listingSelectSchema,
  listingVariantSelectSchema,
  type InventoryMode,
  type Listing,
  type ListingImage,
  type ListingInsert,
  type ListingPlatformOverride,
  type ListingStatus,
  type ListingVariant,
  type Platform,
} from './schemas';
import { PLATFORM_LIMITS, PLATFORMS } from './constants';

export type CompletenessStatus = 'green' | 'yellow' | 'red';
export type PlatformStatusFilter =
  `${Platform}:${ListingStatus | 'manual' | 'pending' | 'synced' | 'error'}`;
export type ListingCompletenessFilter = 'green' | 'yellow' | 'red';

export interface ListingFilters {
  search?: string;
  status?: ListingStatus[];
  platform_status?: PlatformStatusFilter[];
  inventory_mode?: InventoryMode[];
  completeness?: ListingCompletenessFilter[];
  language?: Array<'de' | 'en'>;
  showDeleted?: boolean;
}

export interface CreateListingInput extends ListingInsert {
  platforms?: Platform[];
}

export type UpdateListingInput = Partial<ListingInsert>;

export interface ListingListItem extends Listing {
  product_name: string | null;
  overrides: ListingPlatformOverride[];
  thumbnail_file_link_id: string | null;
  thumbnail_path: string | null;
  thumbnail_alt_text: string | null;
  completeness: Record<Platform, CompletenessStatus>;
}

export interface ListingDetail extends ListingListItem {
  variants: ListingVariant[];
  images: ListingImage[];
}

interface ListingBaseRow extends Record<string, unknown> {
  id: string;
  product_name: string | null;
  thumbnail_file_link_id: string | null;
  thumbnail_path: string | null;
  thumbnail_alt_text: string | null;
}

interface OverrideRow extends Record<string, unknown> {
  listing_id: string;
}

interface VariantRow extends Record<string, unknown> {
  listing_id: string;
}

interface ImageRow extends Record<string, unknown> {
  listing_id: string;
}

function now(): string {
  return new Date().toISOString();
}

function createId(): string {
  return crypto.randomUUID();
}

function parseJsonArray(value: unknown): string[] | null {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value !== 'string' || value.trim() === '') return null;

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : null;
  } catch {
    return null;
  }
}

function parseJsonRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== 'string' || value.trim() === '') return null;

  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function toBoolean(value: unknown): boolean {
  return value === true || value === 1;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function nullableInteger(value: unknown): number | null {
  return typeof value === 'number' ? Math.trunc(value) : null;
}

function rowToListing(row: Record<string, unknown>): Listing {
  return listingSelectSchema.parse({
    id: row.id,
    product_id: row.product_id,
    master_title: row.master_title,
    master_short_description: nullableString(row.master_short_description),
    master_long_description: nullableString(row.master_long_description),
    master_bullet_points: parseJsonArray(row.master_bullet_points),
    master_tags: parseJsonArray(row.master_tags) ?? [],
    base_price: row.base_price,
    currency: row.currency,
    inventory_mode: row.inventory_mode,
    stock_quantity: nullableInteger(row.stock_quantity),
    sku_base: nullableString(row.sku_base),
    processing_time_min_days: nullableInteger(row.processing_time_min_days),
    processing_time_max_days: nullableInteger(row.processing_time_max_days),
    weight_grams: nullableNumber(row.weight_grams),
    dimension_length_cm: nullableNumber(row.dimension_length_cm),
    dimension_width_cm: nullableNumber(row.dimension_width_cm),
    dimension_height_cm: nullableNumber(row.dimension_height_cm),
    condition: row.condition,
    language: row.language,
    status: row.status,
    seo_notes: nullableString(row.seo_notes),
    append_legal_texts: toBoolean(row.append_legal_texts),
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: nullableString(row.deleted_at),
  });
}

function rowToOverride(row: Record<string, unknown>): ListingPlatformOverride {
  return listingPlatformOverrideSelectSchema.parse({
    id: row.id,
    listing_id: row.listing_id,
    platform: row.platform,
    is_active: toBoolean(row.is_active),
    title_override: nullableString(row.title_override),
    short_description_override: nullableString(row.short_description_override),
    long_description_override: nullableString(row.long_description_override),
    tags_override: parseJsonArray(row.tags_override),
    price_override: nullableNumber(row.price_override),
    platform_category_id: nullableString(row.platform_category_id),
    shipping_profile_id: nullableString(row.shipping_profile_id),
    return_policy_id: nullableString(row.return_policy_id),
    payment_policy_id: nullableString(row.payment_policy_id),
    external_listing_id: nullableString(row.external_listing_id),
    external_listing_url: nullableString(row.external_listing_url),
    sync_status: row.sync_status,
    sync_error_message: nullableString(row.sync_error_message),
    last_synced_at: nullableString(row.last_synced_at),
    platform_metadata: parseJsonRecord(row.platform_metadata),
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}

function rowToVariant(row: Record<string, unknown>): ListingVariant {
  return listingVariantSelectSchema.parse({
    id: row.id,
    listing_id: row.listing_id,
    name: row.name,
    sku_suffix: nullableString(row.sku_suffix),
    price: row.price,
    stock_quantity: nullableInteger(row.stock_quantity),
    color_hex: nullableString(row.color_hex),
    sort_order: row.sort_order,
    is_default: toBoolean(row.is_default),
  });
}

function rowToImage(row: Record<string, unknown>): ListingImage {
  return listingImageSelectSchema.parse({
    id: row.id,
    listing_id: row.listing_id,
    file_link_id: row.file_link_id,
    sort_order: row.sort_order,
    alt_text: nullableString(row.alt_text),
    platforms: parseJsonArray(row.platforms),
  });
}

function mapListItem(row: ListingBaseRow, overrides: ListingPlatformOverride[]): ListingListItem {
  const listing = rowToListing(row);
  return {
    ...listing,
    product_name: row.product_name,
    overrides,
    thumbnail_file_link_id: row.thumbnail_file_link_id,
    thumbnail_path: row.thumbnail_path,
    thumbnail_alt_text: row.thumbnail_alt_text,
    completeness: {
      etsy: calculateCompleteness(
        { ...listing, overrides, imageCount: row.thumbnail_file_link_id ? 1 : 0 },
        'etsy',
      ),
      ebay: calculateCompleteness(
        { ...listing, overrides, imageCount: row.thumbnail_file_link_id ? 1 : 0 },
        'ebay',
      ),
      kleinanzeigen: calculateCompleteness(
        { ...listing, overrides, imageCount: row.thumbnail_file_link_id ? 1 : 0 },
        'kleinanzeigen',
      ),
    },
  };
}

async function loadOverridesForListings(
  ids: string[],
): Promise<Map<string, ListingPlatformOverride[]>> {
  const result = new Map<string, ListingPlatformOverride[]>();
  ids.forEach((id) => result.set(id, []));
  if (ids.length === 0) return result;

  const db = getDatabase();
  const placeholders = ids.map((_, index) => `$${index + 1}`).join(', ');
  const rows = await db.select<OverrideRow[]>(
    `SELECT * FROM listing_platform_overrides WHERE listing_id IN (${placeholders}) ORDER BY platform`,
    ids,
  );

  rows.forEach((row) => {
    const override = rowToOverride(row);
    result.get(row.listing_id)?.push(override);
  });

  return result;
}

export async function getListings(filters: ListingFilters = {}): Promise<ListingListItem[]> {
  const db = getDatabase();
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (!filters.showDeleted) {
    conditions.push('l.deleted_at IS NULL');
  }

  if (filters.search?.trim()) {
    conditions.push(`l.master_title LIKE $${paramIndex}`);
    params.push(`%${filters.search.trim()}%`);
    paramIndex++;
  }

  if (filters.status && filters.status.length > 0) {
    const placeholders = filters.status.map(() => `$${paramIndex++}`).join(', ');
    conditions.push(`l.status IN (${placeholders})`);
    params.push(...filters.status);
  }

  if (filters.inventory_mode && filters.inventory_mode.length > 0) {
    const placeholders = filters.inventory_mode.map(() => `$${paramIndex++}`).join(', ');
    conditions.push(`l.inventory_mode IN (${placeholders})`);
    params.push(...filters.inventory_mode);
  }

  if (filters.language && filters.language.length > 0) {
    const placeholders = filters.language.map(() => `$${paramIndex++}`).join(', ');
    conditions.push(`l.language IN (${placeholders})`);
    params.push(...filters.language);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const rows = await db.select<ListingBaseRow[]>(
      `SELECT
        l.*,
        p.name AS product_name,
        li.file_link_id AS thumbnail_file_link_id,
        fl.file_path AS thumbnail_path,
        li.alt_text AS thumbnail_alt_text
      FROM listings l
      LEFT JOIN products p ON p.id = l.product_id
      LEFT JOIN listing_images li ON li.listing_id = l.id AND li.sort_order = 0
      LEFT JOIN file_links fl ON fl.id = li.file_link_id
      ${whereClause}
      ORDER BY l.updated_at DESC`,
      params,
    );

    const overridesByListing = await loadOverridesForListings(rows.map((row) => row.id));
    let items = rows.map((row) => mapListItem(row, overridesByListing.get(row.id) ?? []));

    if (filters.platform_status && filters.platform_status.length > 0) {
      items = items.filter((item) =>
        filters.platform_status?.some((filterValue) => {
          const [platform, status] = filterValue.split(':') as [Platform, string];
          const override = item.overrides.find((entry) => entry.platform === platform);
          return override?.sync_status === status || item.status === status;
        }),
      );
    }

    if (filters.completeness && filters.completeness.length > 0) {
      items = items.filter((item) =>
        PLATFORMS.some((platform) => filters.completeness?.includes(item.completeness[platform])),
      );
    }

    return items;
  } catch (err) {
    throw new Error(
      `Listings konnten nicht geladen werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function getListing(id: string): Promise<ListingDetail | null> {
  const db = getDatabase();

  try {
    const rows = await db.select<ListingBaseRow[]>(
      `SELECT
        l.*,
        p.name AS product_name,
        li.file_link_id AS thumbnail_file_link_id,
        fl.file_path AS thumbnail_path,
        li.alt_text AS thumbnail_alt_text
      FROM listings l
      LEFT JOIN products p ON p.id = l.product_id
      LEFT JOIN listing_images li ON li.listing_id = l.id AND li.sort_order = 0
      LEFT JOIN file_links fl ON fl.id = li.file_link_id
      WHERE l.id = $1
      LIMIT 1`,
      [id],
    );

    const row = rows[0];
    if (!row) return null;

    const overridesByListing = await loadOverridesForListings([id]);
    const variantRows = await db.select<VariantRow[]>(
      'SELECT * FROM listing_variants WHERE listing_id = $1 ORDER BY sort_order ASC',
      [id],
    );
    const imageRows = await db.select<ImageRow[]>(
      'SELECT * FROM listing_images WHERE listing_id = $1 ORDER BY sort_order ASC',
      [id],
    );

    return {
      ...mapListItem(row, overridesByListing.get(id) ?? []),
      variants: variantRows.map(rowToVariant),
      images: imageRows.map(rowToImage),
    };
  } catch (err) {
    throw new Error(
      `Listing konnte nicht geladen werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function createListing(data: CreateListingInput): Promise<ListingDetail> {
  const db = getDatabase();
  const parsed = listingInsertSchema.parse(data);
  const timestamp = now();
  const id = createId();
  const platforms = data.platforms ?? [];

  try {
    await db.execute(
      `INSERT INTO listings (
        id, product_id, master_title, master_short_description, master_long_description,
        master_bullet_points, master_tags, base_price, currency, inventory_mode, stock_quantity,
        sku_base, processing_time_min_days, processing_time_max_days, weight_grams,
        dimension_length_cm, dimension_width_cm, dimension_height_cm, condition, language,
        status, seo_notes, append_legal_texts, created_at, updated_at, deleted_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, NULL
      )`,
      [
        id,
        parsed.product_id,
        parsed.master_title,
        parsed.master_short_description ?? null,
        parsed.master_long_description ?? null,
        JSON.stringify(parsed.master_bullet_points ?? null),
        JSON.stringify(parsed.master_tags),
        parsed.base_price,
        parsed.currency ?? 'EUR',
        parsed.inventory_mode,
        parsed.stock_quantity ?? null,
        parsed.sku_base ?? null,
        parsed.processing_time_min_days ?? null,
        parsed.processing_time_max_days ?? null,
        parsed.weight_grams ?? null,
        parsed.dimension_length_cm ?? null,
        parsed.dimension_width_cm ?? null,
        parsed.dimension_height_cm ?? null,
        parsed.condition ?? 'new',
        parsed.language,
        parsed.status ?? 'draft',
        parsed.seo_notes ?? null,
        parsed.append_legal_texts ?? true,
        timestamp,
        timestamp,
      ],
    );

    for (const platform of platforms) {
      await db.execute(
        `INSERT INTO listing_platform_overrides (
          id, listing_id, platform, is_active, sync_status, created_at, updated_at
        ) VALUES ($1, $2, $3, 1, 'manual', $4, $4)`,
        [createId(), id, platform, timestamp],
      );
    }

    const created = await getListing(id);
    if (!created) throw new Error('Listing wurde erstellt, konnte aber nicht geladen werden');
    return created;
  } catch (err) {
    throw new Error(
      `Listing konnte nicht erstellt werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function updateListing(id: string, data: UpdateListingInput): Promise<ListingDetail> {
  const db = getDatabase();
  const parsed = listingInsertSchema.partial().parse(data);
  const entries = Object.entries(parsed).filter(([, value]) => value !== undefined);

  if (entries.length === 0) {
    const existing = await getListing(id);
    if (!existing) throw new Error('Listing nicht gefunden');
    return existing;
  }

  const params: unknown[] = [];
  const assignments = entries.map(([key, value], index) => {
    params.push(
      Array.isArray(value) || (value && typeof value === 'object') ? JSON.stringify(value) : value,
    );
    return `${key} = $${index + 1}`;
  });

  params.push(now(), id);

  try {
    await db.execute(
      `UPDATE listings SET ${assignments.join(', ')}, updated_at = $${params.length - 1} WHERE id = $${params.length}`,
      params,
    );

    const updated = await getListing(id);
    if (!updated) throw new Error('Listing nicht gefunden');
    return updated;
  } catch (err) {
    throw new Error(
      `Listing konnte nicht aktualisiert werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function updateListingsStatus(ids: string[], status: ListingStatus): Promise<void> {
  if (ids.length === 0) return;
  const db = getDatabase();
  const timestamp = now();
  const placeholders = ids.map((_, index) => `$${index + 3}`).join(', ');

  try {
    await db.execute(
      `UPDATE listings SET status = $1, updated_at = $2 WHERE id IN (${placeholders})`,
      [status, timestamp, ...ids],
    );
  } catch (err) {
    throw new Error(
      `Listing-Status konnte nicht aktualisiert werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function softDeleteListing(id: string): Promise<void> {
  const db = getDatabase();
  const timestamp = now();

  try {
    await db.execute('UPDATE listings SET deleted_at = $1, updated_at = $1 WHERE id = $2', [
      timestamp,
      id,
    ]);
  } catch (err) {
    throw new Error(
      `Listing konnte nicht gelöscht werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function softDeleteListings(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = getDatabase();
  const timestamp = now();
  const placeholders = ids.map((_, index) => `$${index + 2}`).join(', ');

  try {
    await db.execute(
      `UPDATE listings SET deleted_at = $1, updated_at = $1 WHERE id IN (${placeholders})`,
      [timestamp, ...ids],
    );
  } catch (err) {
    throw new Error(
      `Listings konnten nicht gelöscht werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export function calculateCompleteness(
  listing: Listing & { overrides?: ListingPlatformOverride[]; imageCount?: number },
  platform: Platform,
): CompletenessStatus {
  const override = listing.overrides?.find((entry) => entry.platform === platform);
  const title = override?.title_override?.trim() || listing.master_title.trim();
  const description =
    override?.long_description_override?.trim() ||
    override?.short_description_override?.trim() ||
    listing.master_long_description?.trim() ||
    listing.master_short_description?.trim() ||
    '';
  const tags = override?.tags_override ?? listing.master_tags;
  const hasRequiredFields =
    title.length > 0 &&
    description.length > 0 &&
    listing.base_price >= 0 &&
    Boolean(listing.product_id);
  const limit = PLATFORM_LIMITS[platform];

  if (!hasRequiredFields || title.length > limit.maxTitleLength) {
    return 'red';
  }

  const hasImage = (listing.imageCount ?? 0) > 0;
  const hasPlatformCategory = Boolean(override?.platform_category_id?.trim());
  const etsyTagsOk = platform !== 'etsy' || tags.length >= 5;
  const overrideTitleOk =
    listing.master_title.length <= limit.maxTitleLength || Boolean(override?.title_override);

  return hasImage && hasPlatformCategory && etsyTagsOk && overrideTitleOk ? 'green' : 'yellow';
}
