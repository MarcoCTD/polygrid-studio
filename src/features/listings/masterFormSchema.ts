import { z } from 'zod';
import type { ListingDetail, UpdateListingInput } from './listingsService';
import { InventoryModeEnum, ListingStatusEnum } from './schemas';

const nullableTrimmedText = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable();

const nullableNumber = z.number().min(0).nullable();
const nullableInteger = z.number().int().min(0).nullable();

export const masterListingFormSchema = z.object({
  master_title: z.string().trim().min(1).max(140),
  master_short_description: nullableTrimmedText,
  master_long_description: nullableTrimmedText,
  master_tags: z.array(z.string().trim().min(1)).max(20),
  base_price: z.number().min(0),
  inventory_mode: InventoryModeEnum,
  stock_quantity: nullableInteger,
  sku_base: nullableTrimmedText,
  processing_time_min_days: nullableInteger,
  processing_time_max_days: nullableInteger,
  weight_grams: nullableNumber,
  dimension_length_cm: nullableNumber,
  dimension_width_cm: nullableNumber,
  dimension_height_cm: nullableNumber,
  language: z.enum(['de', 'en']),
  status: ListingStatusEnum,
  append_legal_texts: z.boolean(),
});

export type MasterListingFormValues = z.infer<typeof masterListingFormSchema>;

export function listingToMasterFormValues(listing: ListingDetail): MasterListingFormValues {
  return {
    master_title: listing.master_title,
    master_short_description: listing.master_short_description,
    master_long_description: listing.master_long_description,
    master_tags: listing.master_tags,
    base_price: listing.base_price,
    inventory_mode: listing.inventory_mode,
    stock_quantity: listing.stock_quantity,
    sku_base: listing.sku_base,
    processing_time_min_days: listing.processing_time_min_days,
    processing_time_max_days: listing.processing_time_max_days,
    weight_grams: listing.weight_grams,
    dimension_length_cm: listing.dimension_length_cm,
    dimension_width_cm: listing.dimension_width_cm,
    dimension_height_cm: listing.dimension_height_cm,
    language: listing.language,
    status: listing.status,
    append_legal_texts: listing.append_legal_texts,
  };
}

export function masterFormValuesToUpdateInput(values: MasterListingFormValues): UpdateListingInput {
  return {
    ...values,
    stock_quantity: values.inventory_mode === 'stock' ? values.stock_quantity : null,
    currency: 'EUR',
  };
}
