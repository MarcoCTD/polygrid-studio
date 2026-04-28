import type { ListingInsert, Platform } from './schemas';

export interface PlatformLimits {
  maxTitleLength: number;
  maxTagCount: number;
  maxTagLength: number;
  maxImages: number;
  descriptionAllowsHtml: boolean;
}

export const PLATFORMS = ['etsy', 'ebay', 'kleinanzeigen'] as const satisfies readonly Platform[];

export const PLATFORM_LABELS: Record<Platform, string> = {
  etsy: 'Etsy',
  ebay: 'eBay',
  kleinanzeigen: 'Kleinanzeigen',
};

export const PLATFORM_LIMITS: Record<Platform, PlatformLimits> = {
  etsy: {
    maxTitleLength: 140,
    maxTagCount: 13,
    maxTagLength: 20,
    maxImages: 10,
    // Etsy akzeptiert formatierten Text nur eingeschränkt; der Editor behandelt HTML daher vorsichtig.
    descriptionAllowsHtml: true,
  },
  ebay: {
    maxTitleLength: 80,
    maxTagCount: 0,
    maxTagLength: 0,
    maxImages: 24,
    descriptionAllowsHtml: true,
  },
  kleinanzeigen: {
    maxTitleLength: 65,
    maxTagCount: 0,
    maxTagLength: 0,
    maxImages: 20,
    descriptionAllowsHtml: false,
  },
};

export const DEFAULT_LISTING_VALUES = {
  master_short_description: null,
  master_long_description: null,
  master_bullet_points: null,
  master_tags: [],
  base_price: 0,
  currency: 'EUR',
  inventory_mode: 'made_to_order',
  stock_quantity: null,
  sku_base: null,
  processing_time_min_days: null,
  processing_time_max_days: null,
  weight_grams: null,
  dimension_length_cm: null,
  dimension_width_cm: null,
  dimension_height_cm: null,
  condition: 'new',
  language: 'de',
  status: 'draft',
  seo_notes: null,
  append_legal_texts: true,
} as const satisfies Omit<ListingInsert, 'product_id' | 'master_title'>;
