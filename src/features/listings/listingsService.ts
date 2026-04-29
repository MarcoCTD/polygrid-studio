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
import { PLATFORM_LABELS, PLATFORM_LIMITS, PLATFORMS } from './constants';

export type CompletenessStatus = 'green' | 'yellow' | 'red';
export interface CompletenessResult {
  status: CompletenessStatus;
  hints: string[];
}
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
export type UpdateOverrideInput = Partial<
  Pick<
    ListingPlatformOverride,
    | 'is_active'
    | 'title_override'
    | 'short_description_override'
    | 'long_description_override'
    | 'tags_override'
    | 'price_override'
    | 'platform_category_id'
    | 'shipping_profile_id'
    | 'return_policy_id'
    | 'payment_policy_id'
    | 'external_listing_id'
    | 'external_listing_url'
    | 'sync_status'
    | 'sync_error_message'
    | 'last_synced_at'
    | 'platform_metadata'
  >
>;

export interface ProductWithoutListingOption {
  id: string;
  name: string;
  target_price: number | null;
}

export interface ImageFileLinkOption {
  id: string;
  entity_type: string;
  entity_id: string;
  file_path: string;
  file_type: string;
  display_name: string | null;
  mime_type: string | null;
  isProductFile: boolean;
}

export interface ListingListItem extends Listing {
  product_name: string | null;
  overrides: ListingPlatformOverride[];
  thumbnail_file_link_id: string | null;
  thumbnail_path: string | null;
  thumbnail_alt_text: string | null;
  imageCount: number;
  variantCount: number;
  completeness: Record<Platform, CompletenessResult>;
}

export interface ListingDetail extends ListingListItem {
  variants: ListingVariant[];
  images: ListingImage[];
}

export interface ListingImageWithFile extends ListingImage {
  file_path: string;
  file_type: string;
  display_name: string | null;
  mime_type: string | null;
}

interface ListingBaseRow extends Record<string, unknown> {
  id: string;
  product_name: string | null;
  thumbnail_file_link_id: string | null;
  thumbnail_path: string | null;
  thumbnail_alt_text: string | null;
  image_count: number | null;
  variant_count: number | null;
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

interface ImageFileLinkRow extends Record<string, unknown> {
  id: string;
  entity_type: string;
  entity_id: string;
  file_path: string;
  file_type: string;
  display_name: string | null;
  mime_type: string | null;
  is_product_file: number;
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

function rowToImageWithFile(row: Record<string, unknown>): ListingImageWithFile {
  return {
    ...rowToImage(row),
    file_path: row.file_path as string,
    file_type: row.file_type as string,
    display_name: nullableString(row.display_name),
    mime_type: nullableString(row.mime_type),
  };
}

function rowToImageFileLink(row: ImageFileLinkRow): ImageFileLinkOption {
  return {
    id: row.id,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    file_path: row.file_path,
    file_type: row.file_type,
    display_name: row.display_name,
    mime_type: row.mime_type,
    isProductFile: row.is_product_file === 1,
  };
}

function mapListItem(row: ListingBaseRow, overrides: ListingPlatformOverride[]): ListingListItem {
  const listing = rowToListing(row);
  const imageCount = row.image_count ?? 0;
  const variantCount = row.variant_count ?? 0;
  return {
    ...listing,
    product_name: row.product_name,
    overrides,
    thumbnail_file_link_id: row.thumbnail_file_link_id,
    thumbnail_path: row.thumbnail_path,
    thumbnail_alt_text: row.thumbnail_alt_text,
    imageCount,
    variantCount,
    completeness: {
      etsy: calculateCompleteness({ ...listing, overrides, imageCount, variantCount }, 'etsy'),
      ebay: calculateCompleteness({ ...listing, overrides, imageCount, variantCount }, 'ebay'),
      kleinanzeigen: calculateCompleteness(
        { ...listing, overrides, imageCount, variantCount },
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
        li.alt_text AS thumbnail_alt_text,
        (SELECT COUNT(*) FROM listing_images li_count WHERE li_count.listing_id = l.id) AS image_count,
        (SELECT COUNT(*) FROM listing_variants lv_count WHERE lv_count.listing_id = l.id) AS variant_count
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
        PLATFORMS.some((platform) =>
          filters.completeness?.includes(item.completeness[platform].status),
        ),
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
        li.alt_text AS thumbnail_alt_text,
        (SELECT COUNT(*) FROM listing_images li_count WHERE li_count.listing_id = l.id) AS image_count,
        (SELECT COUNT(*) FROM listing_variants lv_count WHERE lv_count.listing_id = l.id) AS variant_count
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

export async function getProductsWithoutListing(): Promise<ProductWithoutListingOption[]> {
  const db = getDatabase();

  try {
    return await db.select<ProductWithoutListingOption[]>(
      `SELECT p.id, p.name, p.target_price
       FROM products p
       LEFT JOIN listings l ON l.product_id = p.id
       WHERE p.deleted_at IS NULL AND l.id IS NULL
       ORDER BY p.name ASC`,
    );
  } catch (err) {
    throw new Error(
      `Produkte ohne Listing konnten nicht geladen werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function getListingsForProduct(productId: string): Promise<ListingListItem[]> {
  const db = getDatabase();

  try {
    const rows = await db.select<ListingBaseRow[]>(
      `SELECT
        l.*,
        p.name AS product_name,
        li.file_link_id AS thumbnail_file_link_id,
        fl.file_path AS thumbnail_path,
        li.alt_text AS thumbnail_alt_text,
        (SELECT COUNT(*) FROM listing_images li_count WHERE li_count.listing_id = l.id) AS image_count,
        (SELECT COUNT(*) FROM listing_variants lv_count WHERE lv_count.listing_id = l.id) AS variant_count
      FROM listings l
      LEFT JOIN products p ON p.id = l.product_id
      LEFT JOIN listing_images li ON li.listing_id = l.id AND li.sort_order = 0
      LEFT JOIN file_links fl ON fl.id = li.file_link_id
      WHERE l.product_id = $1 AND l.deleted_at IS NULL
      ORDER BY l.updated_at DESC`,
      [productId],
    );

    const overridesByListing = await loadOverridesForListings(rows.map((row) => row.id));
    return rows.map((row) => mapListItem(row, overridesByListing.get(row.id) ?? []));
  } catch (err) {
    throw new Error(
      `Produkt-Listings konnten nicht geladen werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function duplicateListing(
  sourceId: string,
  targetProductId: string,
): Promise<ListingDetail> {
  const source = await getListing(sourceId);
  if (!source) throw new Error('Vorlagen-Listing nicht gefunden');

  const db = getDatabase();
  const timestamp = now();
  const newListingId = createId();

  try {
    await db.execute(
      `INSERT INTO listings (
        id, product_id, master_title, master_short_description, master_long_description,
        master_bullet_points, master_tags, base_price, currency, inventory_mode, stock_quantity,
        sku_base, processing_time_min_days, processing_time_max_days, weight_grams,
        dimension_length_cm, dimension_width_cm, dimension_height_cm, condition, language,
        status, seo_notes, append_legal_texts, created_at, updated_at, deleted_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, 'draft', $20, $21, $22, $22, NULL
      )`,
      [
        newListingId,
        targetProductId,
        source.master_title,
        source.master_short_description,
        source.master_long_description,
        JSON.stringify(source.master_bullet_points),
        JSON.stringify(source.master_tags),
        source.base_price,
        source.currency,
        source.inventory_mode,
        source.sku_base,
        source.processing_time_min_days,
        source.processing_time_max_days,
        source.weight_grams,
        source.dimension_length_cm,
        source.dimension_width_cm,
        source.dimension_height_cm,
        source.condition,
        source.language,
        source.seo_notes,
        source.append_legal_texts,
        timestamp,
      ],
    );

    for (const override of source.overrides) {
      await db.execute(
        `INSERT INTO listing_platform_overrides (
          id, listing_id, platform, is_active, title_override, short_description_override,
          long_description_override, tags_override, price_override, platform_category_id,
          shipping_profile_id, return_policy_id, payment_policy_id, external_listing_id,
          external_listing_url, sync_status, sync_error_message, last_synced_at,
          platform_metadata, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NULL, NULL,
          'manual', NULL, NULL, $14, $15, $15
        )`,
        [
          createId(),
          newListingId,
          override.platform,
          override.is_active,
          override.title_override,
          override.short_description_override,
          override.long_description_override,
          override.tags_override ? JSON.stringify(override.tags_override) : null,
          override.price_override,
          override.platform_category_id,
          override.shipping_profile_id,
          override.return_policy_id,
          override.payment_policy_id,
          override.platform_metadata ? JSON.stringify(override.platform_metadata) : null,
          timestamp,
        ],
      );
    }

    for (const variant of source.variants) {
      await db.execute(
        `INSERT INTO listing_variants (
          id, listing_id, name, sku_suffix, price, stock_quantity, color_hex, sort_order, is_default
        ) VALUES ($1, $2, $3, $4, $5, NULL, $6, $7, $8)`,
        [
          createId(),
          newListingId,
          variant.name,
          variant.sku_suffix,
          variant.price,
          variant.color_hex,
          variant.sort_order,
          variant.is_default,
        ],
      );
    }

    const created = await getListing(newListingId);
    if (!created) throw new Error('Listing wurde dupliziert, konnte aber nicht geladen werden');
    return created;
  } catch (err) {
    throw new Error(
      `Listing konnte nicht dupliziert werden: ${err instanceof Error ? err.message : String(err)}`,
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

export async function bulkUpdateStatus(ids: string[], status: ListingStatus): Promise<void> {
  return updateListingsStatus(ids, status);
}

export async function bulkUpdatePrice(ids: string[], changePercent: number): Promise<void> {
  if (ids.length === 0) return;
  const db = getDatabase();
  const timestamp = now();
  const multiplier = 1 + changePercent / 100;
  const placeholders = ids.map((_, index) => `$${index + 3}`).join(', ');

  try {
    await db.execute(
      `UPDATE listings
       SET base_price = ROUND(base_price * $1, 2), updated_at = $2
       WHERE id IN (${placeholders})`,
      [multiplier, timestamp, ...ids],
    );
  } catch (err) {
    throw new Error(
      `Listing-Preise konnten nicht aktualisiert werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function getOverride(
  listingId: string,
  platform: Platform,
): Promise<ListingPlatformOverride | null> {
  const db = getDatabase();

  try {
    const rows = await db.select<OverrideRow[]>(
      'SELECT * FROM listing_platform_overrides WHERE listing_id = $1 AND platform = $2 LIMIT 1',
      [listingId, platform],
    );
    const row = rows[0];
    return row ? rowToOverride(row) : null;
  } catch (err) {
    throw new Error(
      `Plattformdaten konnten nicht geladen werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function upsertOverride(
  listingId: string,
  platform: Platform,
  data: UpdateOverrideInput,
): Promise<ListingPlatformOverride> {
  const db = getDatabase();
  const timestamp = now();

  try {
    const existing = await getOverride(listingId, platform);

    if (!existing) {
      await db.execute(
        `INSERT INTO listing_platform_overrides (
          id, listing_id, platform, is_active, title_override, short_description_override,
          long_description_override, tags_override, price_override, platform_category_id,
          shipping_profile_id, return_policy_id, payment_policy_id, external_listing_id,
          external_listing_url, sync_status, sync_error_message, last_synced_at,
          platform_metadata, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20, $20
        )`,
        [
          createId(),
          listingId,
          platform,
          data.is_active ?? false,
          data.title_override ?? null,
          data.short_description_override ?? null,
          data.long_description_override ?? null,
          data.tags_override ? JSON.stringify(data.tags_override) : null,
          data.price_override ?? null,
          data.platform_category_id ?? null,
          data.shipping_profile_id ?? null,
          data.return_policy_id ?? null,
          data.payment_policy_id ?? null,
          data.external_listing_id ?? null,
          data.external_listing_url ?? null,
          data.sync_status ?? 'manual',
          data.sync_error_message ?? null,
          data.last_synced_at ?? null,
          data.platform_metadata ? JSON.stringify(data.platform_metadata) : null,
          timestamp,
        ],
      );
    } else {
      const setClauses = ['updated_at = $1'];
      const params: unknown[] = [timestamp];
      let paramIndex = 2;

      for (const [key, value] of Object.entries(data)) {
        setClauses.push(`${key} = $${paramIndex}`);
        params.push(
          Array.isArray(value) || (value && typeof value === 'object')
            ? JSON.stringify(value)
            : (value ?? null),
        );
        paramIndex++;
      }

      if (setClauses.length > 1) {
        params.push(listingId, platform);
        await db.execute(
          `UPDATE listing_platform_overrides
           SET ${setClauses.join(', ')}
           WHERE listing_id = $${paramIndex} AND platform = $${paramIndex + 1}`,
          params,
        );
      }
    }

    const override = await getOverride(listingId, platform);
    if (!override) throw new Error('Override wurde gespeichert, konnte aber nicht geladen werden');
    return override;
  } catch (err) {
    throw new Error(
      `Plattformdaten konnten nicht gespeichert werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function togglePlatformActive(
  listingId: string,
  platform: Platform,
  isActive: boolean,
): Promise<ListingPlatformOverride> {
  return upsertOverride(listingId, platform, { is_active: isActive });
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

export async function bulkSoftDelete(ids: string[]): Promise<void> {
  return softDeleteListings(ids);
}

export async function getListingImages(listingId: string): Promise<ListingImageWithFile[]> {
  const db = getDatabase();

  try {
    const rows = await db.select<Record<string, unknown>[]>(
      `SELECT li.*, fl.file_path, fl.file_type, fl.display_name, fl.mime_type
       FROM listing_images li
       INNER JOIN file_links fl ON fl.id = li.file_link_id
       WHERE li.listing_id = $1
       ORDER BY li.sort_order ASC`,
      [listingId],
    );

    return rows.map(rowToImageWithFile);
  } catch (err) {
    throw new Error(
      `Listing-Bilder konnten nicht geladen werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function getAvailableListingImageFileLinks(
  listingId: string,
  productId: string,
): Promise<ImageFileLinkOption[]> {
  const db = getDatabase();

  try {
    const rows = await db.select<ImageFileLinkRow[]>(
      `SELECT
        fl.id,
        fl.entity_type,
        fl.entity_id,
        fl.file_path,
        fl.file_type,
        fl.display_name,
        fl.mime_type,
        CASE WHEN fl.entity_type = 'product' AND fl.entity_id = $2 THEN 1 ELSE 0 END AS is_product_file
       FROM file_links fl
       LEFT JOIN listing_images li ON li.file_link_id = fl.id AND li.listing_id = $1
       WHERE li.id IS NULL
         AND (
          fl.file_type IN ('image', 'mockup')
          OR fl.mime_type LIKE 'image/%'
          OR lower(fl.file_path) LIKE '%.png'
          OR lower(fl.file_path) LIKE '%.jpg'
          OR lower(fl.file_path) LIKE '%.jpeg'
          OR lower(fl.file_path) LIKE '%.webp'
         )
       ORDER BY is_product_file DESC, fl.position ASC, fl.created_at DESC`,
      [listingId, productId],
    );

    return rows.map(rowToImageFileLink);
  } catch (err) {
    throw new Error(
      `Bilddateien konnten nicht geladen werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function addListingImage(
  listingId: string,
  fileLinkId: string,
  altText: string | null = null,
): Promise<ListingImageWithFile> {
  const db = getDatabase();
  const id = createId();

  try {
    const rows = await db.select<{ max_sort_order: number | null }[]>(
      'SELECT MAX(sort_order) AS max_sort_order FROM listing_images WHERE listing_id = $1',
      [listingId],
    );
    const sortOrder = (rows[0]?.max_sort_order ?? -1) + 1;

    await db.execute(
      `INSERT INTO listing_images (id, listing_id, file_link_id, sort_order, alt_text, platforms)
       VALUES ($1, $2, $3, $4, $5, NULL)`,
      [id, listingId, fileLinkId, sortOrder, altText],
    );

    const images = await getListingImages(listingId);
    const image = images.find((item) => item.id === id);
    if (!image) throw new Error('Bildverknüpfung wurde erstellt, konnte aber nicht geladen werden');
    return image;
  } catch (err) {
    throw new Error(
      `Bild konnte nicht verknüpft werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function updateListingImageOrder(
  images: Array<{ id: string; sort_order: number }>,
): Promise<void> {
  if (images.length === 0) return;
  const db = getDatabase();

  try {
    for (const image of images) {
      await db.execute('UPDATE listing_images SET sort_order = $1 WHERE id = $2', [
        image.sort_order,
        image.id,
      ]);
    }
  } catch (err) {
    throw new Error(
      `Bildreihenfolge konnte nicht gespeichert werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function updateListingImage(
  id: string,
  data: Partial<Pick<ListingImage, 'alt_text' | 'platforms'>>,
): Promise<void> {
  const db = getDatabase();
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if ('alt_text' in data) {
    setClauses.push(`alt_text = $${paramIndex}`);
    params.push(data.alt_text ?? null);
    paramIndex++;
  }

  if ('platforms' in data) {
    setClauses.push(`platforms = $${paramIndex}`);
    params.push(
      data.platforms === undefined || data.platforms === null
        ? null
        : JSON.stringify(data.platforms),
    );
    paramIndex++;
  }

  if (setClauses.length === 0) return;

  params.push(id);

  try {
    await db.execute(
      `UPDATE listing_images SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
      params,
    );
  } catch (err) {
    throw new Error(
      `Bildverknüpfung konnte nicht aktualisiert werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function removeListingImage(id: string): Promise<void> {
  const db = getDatabase();

  try {
    await db.execute('DELETE FROM listing_images WHERE id = $1', [id]);
  } catch (err) {
    throw new Error(
      `Bildverknüpfung konnte nicht entfernt werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export type CreateVariantInput = Partial<
  Pick<
    ListingVariant,
    'name' | 'sku_suffix' | 'price' | 'stock_quantity' | 'color_hex' | 'is_default'
  >
>;

export type UpdateVariantInput = Partial<
  Pick<ListingVariant, 'name' | 'sku_suffix' | 'price' | 'stock_quantity' | 'color_hex'>
>;

export async function getListingVariants(listingId: string): Promise<ListingVariant[]> {
  const db = getDatabase();

  try {
    const rows = await db.select<VariantRow[]>(
      'SELECT * FROM listing_variants WHERE listing_id = $1 ORDER BY sort_order ASC',
      [listingId],
    );
    return rows.map(rowToVariant);
  } catch (err) {
    throw new Error(
      `Listing-Varianten konnten nicht geladen werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function createVariant(
  listingId: string,
  data: CreateVariantInput = {},
): Promise<ListingVariant> {
  const db = getDatabase();
  const id = createId();

  try {
    const [countRow] = await db.select<{ count: number }[]>(
      'SELECT COUNT(*) AS count FROM listing_variants WHERE listing_id = $1',
      [listingId],
    );
    const [sortRow] = await db.select<{ max_sort_order: number | null }[]>(
      'SELECT MAX(sort_order) AS max_sort_order FROM listing_variants WHERE listing_id = $1',
      [listingId],
    );
    const isFirst = (countRow?.count ?? 0) === 0;
    const isDefault = data.is_default ?? isFirst;
    const sortOrder = (sortRow?.max_sort_order ?? -1) + 1;

    if (isDefault) {
      await db.execute('UPDATE listing_variants SET is_default = 0 WHERE listing_id = $1', [
        listingId,
      ]);
    }

    await db.execute(
      `INSERT INTO listing_variants (
        id, listing_id, name, sku_suffix, price, stock_quantity, color_hex, sort_order, is_default
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        listingId,
        data.name ?? 'Neue Variante',
        data.sku_suffix ?? null,
        data.price ?? 0,
        data.stock_quantity ?? null,
        data.color_hex ?? null,
        sortOrder,
        isDefault,
      ],
    );

    const variants = await getListingVariants(listingId);
    const variant = variants.find((item) => item.id === id);
    if (!variant) throw new Error('Variante wurde erstellt, konnte aber nicht geladen werden');
    return variant;
  } catch (err) {
    throw new Error(
      `Variante konnte nicht erstellt werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function updateVariant(id: string, data: UpdateVariantInput): Promise<void> {
  const db = getDatabase();
  const allowedFields = ['name', 'sku_suffix', 'price', 'stock_quantity', 'color_hex'] as const;
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  for (const field of allowedFields) {
    if (field in data) {
      setClauses.push(`${field} = $${paramIndex}`);
      params.push(data[field] ?? null);
      paramIndex++;
    }
  }

  if (setClauses.length === 0) return;

  params.push(id);

  try {
    await db.execute(
      `UPDATE listing_variants SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
      params,
    );
  } catch (err) {
    throw new Error(
      `Variante konnte nicht aktualisiert werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function updateVariantOrder(
  variants: Array<{ id: string; sort_order: number }>,
): Promise<void> {
  if (variants.length === 0) return;
  const db = getDatabase();

  try {
    for (const variant of variants) {
      await db.execute('UPDATE listing_variants SET sort_order = $1 WHERE id = $2', [
        variant.sort_order,
        variant.id,
      ]);
    }
  } catch (err) {
    throw new Error(
      `Varianten-Reihenfolge konnte nicht gespeichert werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function deleteVariant(id: string): Promise<void> {
  const db = getDatabase();

  try {
    const [target] = await db.select<{ listing_id: string; is_default: number }[]>(
      'SELECT listing_id, is_default FROM listing_variants WHERE id = $1',
      [id],
    );
    if (!target) return;

    const [countRow] = await db.select<{ count: number }[]>(
      'SELECT COUNT(*) AS count FROM listing_variants WHERE listing_id = $1',
      [target.listing_id],
    );
    if ((countRow?.count ?? 0) <= 1) {
      throw new Error('Die letzte Variante kann nicht gelöscht werden');
    }

    if (target.is_default === 1) {
      throw new Error('Die Default-Variante kann nicht gelöscht werden');
    }

    await db.execute('DELETE FROM listing_variants WHERE id = $1', [id]);
  } catch (err) {
    throw new Error(
      err instanceof Error ? err.message : `Variante konnte nicht gelöscht werden: ${String(err)}`,
    );
  }
}

export async function setDefaultVariant(id: string, listingId: string): Promise<void> {
  const db = getDatabase();

  try {
    await db.execute('UPDATE listing_variants SET is_default = 0 WHERE listing_id = $1', [
      listingId,
    ]);
    await db.execute('UPDATE listing_variants SET is_default = 1 WHERE id = $1', [id]);
  } catch (err) {
    throw new Error(
      `Default-Variante konnte nicht gesetzt werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export function calculateCompleteness(
  listing: Listing & {
    overrides?: ListingPlatformOverride[];
    imageCount?: number;
    variantCount?: number;
  },
  platform: Platform,
): CompletenessResult {
  const override = listing.overrides?.find((entry) => entry.platform === platform);
  const titleOverride = override?.title_override?.trim() ?? '';
  const masterTitle = listing.master_title.trim();
  const title = titleOverride || masterTitle;
  const description =
    override?.long_description_override?.trim() ||
    override?.short_description_override?.trim() ||
    listing.master_long_description?.trim() ||
    listing.master_short_description?.trim() ||
    '';
  const tags = override?.tags_override ?? listing.master_tags;
  const limit = PLATFORM_LIMITS[platform];
  const redHints: string[] = [];

  if (!masterTitle) {
    redHints.push(`${PLATFORM_LABELS[platform]}: Master-Titel fehlt`);
  }

  if (masterTitle.length > limit.maxTitleLength && !titleOverride) {
    redHints.push(
      `${PLATFORM_LABELS[platform]}: Master-Titel zu lang (${masterTitle.length}/${limit.maxTitleLength}), Override nötig`,
    );
  }

  if (title.length > limit.maxTitleLength) {
    redHints.push(
      `${PLATFORM_LABELS[platform]}: Titel zu lang (${title.length}/${limit.maxTitleLength})`,
    );
  }

  if (listing.base_price <= 0) {
    redHints.push(`${PLATFORM_LABELS[platform]}: Basispreis fehlt`);
  }

  if (tags.length === 0) {
    redHints.push(`${PLATFORM_LABELS[platform]}: Tags fehlen`);
  }

  if (redHints.length > 0) {
    return { status: 'red', hints: redHints };
  }

  const hasImage = (listing.imageCount ?? 0) > 0;
  const hasPlatformCategory = Boolean(override?.platform_category_id?.trim());
  const variantCount = listing.variantCount ?? 0;
  const hints: string[] = [];

  if (!description.trim()) {
    hints.push(`${PLATFORM_LABELS[platform]}: Beschreibung fehlt`);
  }

  if (platform === 'etsy' && tags.length < 5) {
    hints.push(`${PLATFORM_LABELS[platform]}: mindestens 5 Tags empfohlen (${tags.length}/5)`);
  }

  if (!hasImage) {
    hints.push(`${PLATFORM_LABELS[platform]}: mindestens 1 Bild fehlt`);
  }

  if (!hasPlatformCategory) {
    hints.push(`${PLATFORM_LABELS[platform]}: Plattform-Kategorie fehlt`);
  }

  if (variantCount === 0) {
    hints.push(`${PLATFORM_LABELS[platform]}: keine Varianten definiert`);
  }

  if (override?.is_active && !hasOverrideContent(override)) {
    hints.push(`${PLATFORM_LABELS[platform]}: Plattform ist aktiv, aber ohne Override-Daten`);
  }

  if (hints.length > 0) {
    return { status: 'yellow', hints };
  }

  return {
    status: 'green',
    hints: [`${PLATFORM_LABELS[platform]}: alle Pflichtfelder sind vollständig`],
  };
}

function hasOverrideContent(override: ListingPlatformOverride): boolean {
  return Boolean(
    override.title_override?.trim() ||
    override.short_description_override?.trim() ||
    override.long_description_override?.trim() ||
    (override.tags_override && override.tags_override.length > 0) ||
    override.price_override !== null ||
    override.platform_category_id?.trim(),
  );
}
