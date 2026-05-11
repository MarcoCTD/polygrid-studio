import { z } from 'zod';

// ============================================================
// Enums
// ============================================================

export const PlatformEnum = z.enum(['etsy', 'ebay', 'kleinanzeigen']);
export const InventoryModeEnum = z.enum(['made_to_order', 'stock']);
export const ListingStatusEnum = z.enum(['draft', 'ready', 'online', 'paused', 'archived']);
export const ConditionEnum = z.enum(['new', 'used_like_new']);
export const SyncStatusEnum = z.enum(['manual', 'pending', 'synced', 'error']);
export const ListingSyncStatusEnum = z.enum([
  'not_synced',
  'synced',
  'pending',
  'error',
  'conflict',
]);

// ============================================================
// Shared sub-schemas
// ============================================================

const isoDateString = z.string().min(1);
const nullableText = z.string().trim().nullable();
const optionalNullableText = z.string().trim().nullable().optional();
const uuid = z.string().uuid();
const nonNegativeNumber = z.number().min(0);
const nonNegativeInteger = z.number().int().min(0);
const tagSchema = z.string().trim().min(1);

export const listingPlatformMetadataSchema = z.record(z.string(), z.unknown());

// ============================================================
// listings
// ============================================================

export const listingSelectSchema = z.object({
  id: uuid,
  product_id: uuid,
  master_title: z.string().trim().min(1).max(140),
  master_short_description: nullableText,
  master_long_description: nullableText,
  master_bullet_points: z.array(z.string().trim().min(1)).nullable(),
  master_tags: z.array(tagSchema).max(20),
  base_price: nonNegativeNumber,
  currency: z.string().trim().min(3).max(3),
  inventory_mode: InventoryModeEnum,
  stock_quantity: nonNegativeInteger.nullable(),
  sku_base: nullableText,
  processing_time_min_days: nonNegativeInteger.nullable(),
  processing_time_max_days: nonNegativeInteger.nullable(),
  weight_grams: nonNegativeNumber.nullable(),
  dimension_length_cm: nonNegativeNumber.nullable(),
  dimension_width_cm: nonNegativeNumber.nullable(),
  dimension_height_cm: nonNegativeNumber.nullable(),
  condition: ConditionEnum,
  language: z.enum(['de', 'en']),
  status: ListingStatusEnum,
  seo_notes: nullableText,
  append_legal_texts: z.boolean(),
  platform: PlatformEnum,
  external_id: nullableText,
  sync_status: ListingSyncStatusEnum,
  sync_error_message: nullableText,
  last_synced_at: z.string().nullable(),
  platform_metadata: listingPlatformMetadataSchema.nullable(),
  created_at: isoDateString,
  updated_at: isoDateString,
  deleted_at: z.string().nullable(),
});

export const listingInsertSchema = z.object({
  product_id: uuid,
  master_title: z.string().trim().min(1).max(140),
  master_short_description: optionalNullableText,
  master_long_description: optionalNullableText,
  master_bullet_points: z.array(z.string().trim().min(1)).nullable().optional(),
  master_tags: z.array(tagSchema).max(20),
  base_price: nonNegativeNumber,
  currency: z.string().trim().min(3).max(3).optional(),
  inventory_mode: InventoryModeEnum,
  stock_quantity: nonNegativeInteger.nullable().optional(),
  sku_base: optionalNullableText,
  processing_time_min_days: nonNegativeInteger.nullable().optional(),
  processing_time_max_days: nonNegativeInteger.nullable().optional(),
  weight_grams: nonNegativeNumber.nullable().optional(),
  dimension_length_cm: nonNegativeNumber.nullable().optional(),
  dimension_width_cm: nonNegativeNumber.nullable().optional(),
  dimension_height_cm: nonNegativeNumber.nullable().optional(),
  condition: ConditionEnum.optional(),
  language: z.enum(['de', 'en']),
  status: ListingStatusEnum.optional(),
  seo_notes: optionalNullableText,
  append_legal_texts: z.boolean().optional(),
  platform: PlatformEnum,
  external_id: optionalNullableText,
  sync_status: ListingSyncStatusEnum.optional(),
  sync_error_message: optionalNullableText,
  last_synced_at: z.string().nullable().optional(),
  platform_metadata: listingPlatformMetadataSchema.nullable().optional(),
});

// ============================================================
// listing_platform_overrides
// ============================================================

export const listingPlatformOverrideSelectSchema = z.object({
  id: uuid,
  listing_id: uuid,
  platform: PlatformEnum,
  is_active: z.boolean(),
  title_override: nullableText,
  short_description_override: nullableText,
  long_description_override: nullableText,
  tags_override: z.array(tagSchema).nullable(),
  price_override: nonNegativeNumber.nullable(),
  platform_category_id: nullableText,
  shipping_profile_id: nullableText,
  return_policy_id: nullableText,
  payment_policy_id: nullableText,
  external_listing_id: nullableText,
  external_listing_url: z.string().url().nullable().or(z.literal('')).or(z.null()),
  sync_status: SyncStatusEnum,
  sync_error_message: nullableText,
  last_synced_at: z.string().nullable(),
  platform_metadata: listingPlatformMetadataSchema.nullable(),
  created_at: isoDateString,
  updated_at: isoDateString,
});

export const listingPlatformOverrideInsertSchema = z.object({
  listing_id: uuid,
  platform: PlatformEnum,
  is_active: z.boolean().optional(),
  title_override: optionalNullableText,
  short_description_override: optionalNullableText,
  long_description_override: optionalNullableText,
  tags_override: z.array(tagSchema).nullable().optional(),
  price_override: nonNegativeNumber.nullable().optional(),
  platform_category_id: optionalNullableText,
  shipping_profile_id: optionalNullableText,
  return_policy_id: optionalNullableText,
  payment_policy_id: optionalNullableText,
  external_listing_id: optionalNullableText,
  external_listing_url: z.string().url().nullable().or(z.literal('')).optional(),
  sync_status: SyncStatusEnum.optional(),
  sync_error_message: optionalNullableText,
  last_synced_at: z.string().nullable().optional(),
  platform_metadata: listingPlatformMetadataSchema.nullable().optional(),
});

// ============================================================
// listing_variants
// ============================================================

export const listingVariantSelectSchema = z.object({
  id: uuid,
  listing_id: uuid,
  name: z.string().trim().min(1).max(120),
  sku_suffix: nullableText,
  price: nonNegativeNumber,
  stock_quantity: nonNegativeInteger.nullable(),
  color_hex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable(),
  sort_order: nonNegativeInteger,
  is_default: z.boolean(),
});

export const listingVariantInsertSchema = z.object({
  listing_id: uuid,
  name: z.string().trim().min(1).max(120),
  sku_suffix: optionalNullableText,
  price: nonNegativeNumber,
  stock_quantity: nonNegativeInteger.nullable().optional(),
  color_hex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  sort_order: nonNegativeInteger.optional(),
  is_default: z.boolean().optional(),
});

// ============================================================
// listing_images
// ============================================================

export const listingImageSelectSchema = z.object({
  id: uuid,
  listing_id: uuid,
  file_link_id: uuid,
  sort_order: nonNegativeInteger,
  alt_text: nullableText,
  platforms: z.array(PlatformEnum).nullable(),
});

export const listingImageInsertSchema = z.object({
  listing_id: uuid,
  file_link_id: uuid,
  sort_order: nonNegativeInteger.optional(),
  alt_text: optionalNullableText,
  platforms: z.array(PlatformEnum).nullable().optional(),
});

// ============================================================
// Inferred types
// ============================================================

export type Platform = z.infer<typeof PlatformEnum>;
export type InventoryMode = z.infer<typeof InventoryModeEnum>;
export type ListingStatus = z.infer<typeof ListingStatusEnum>;
export type Condition = z.infer<typeof ConditionEnum>;
export type SyncStatus = z.infer<typeof SyncStatusEnum>;
export type ListingSyncStatus = z.infer<typeof ListingSyncStatusEnum>;
export type ListingPlatformMetadata = z.infer<typeof listingPlatformMetadataSchema>;

export type Listing = z.infer<typeof listingSelectSchema>;
export type ListingInsert = z.infer<typeof listingInsertSchema>;
export type ListingPlatformOverride = z.infer<typeof listingPlatformOverrideSelectSchema>;
export type ListingPlatformOverrideInsert = z.infer<typeof listingPlatformOverrideInsertSchema>;
export type ListingVariant = z.infer<typeof listingVariantSelectSchema>;
export type ListingVariantInsert = z.infer<typeof listingVariantInsertSchema>;
export type ListingImage = z.infer<typeof listingImageSelectSchema>;
export type ListingImageInsert = z.infer<typeof listingImageInsertSchema>;
