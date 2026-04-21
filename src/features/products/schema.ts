import { z } from 'zod';

// ============================================================
// Enums
// ============================================================

export const statusEnum = z.enum([
  'idea',
  'review',
  'print_ready',
  'test_print',
  'launch_ready',
  'online',
  'paused',
  'discontinued',
]);

export const materialTypeEnum = z.enum(['PLA', 'PETG', 'TPU', 'ABS', 'Resin']);

export const licenseTypeEnum = z.enum([
  'own',
  'cc_by',
  'cc_by_sa',
  'cc_by_nc',
  'commercial',
  'unclear',
]);

export const licenseRiskEnum = z.enum(['safe', 'review_needed', 'risky']);

export const shippingClassEnum = z.enum(['Brief', 'Warensendung', 'Paket']);

export const platformEnum = z.enum(['etsy', 'ebay', 'kleinanzeigen']);

// ============================================================
// Shared sub-schemas
// ============================================================

export const colorVariantSchema = z.object({
  name: z.string().min(1),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

// ============================================================
// productSchema — vollständiges Produkt (DB-Zeile)
// ============================================================

export const productSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(200),
  short_name: z.string().nullable(),
  category: z.string().min(1),
  subcategory: z.string().nullable(),
  description_internal: z.string().nullable(),
  collection: z.string().nullable(),
  status: statusEnum,
  material_type: materialTypeEnum,
  color_variants: z.array(colorVariantSchema).nullable(),
  print_time_minutes: z.number().int().min(0).max(10080).nullable(),
  material_grams: z.number().min(0).max(10000).nullable(),
  electricity_cost: z.number().min(0).nullable(),
  packaging_cost: z.number().min(0).nullable(),
  shipping_class: shippingClassEnum.nullable(),
  target_price: z.number().min(0).nullable(),
  min_price: z.number().min(0).nullable(),
  price_etsy: z.number().min(0).nullable(),
  price_ebay: z.number().min(0).nullable(),
  price_kleinanzeigen: z.number().min(0).nullable(),
  estimated_margin: z.number().nullable(),
  license_source: z.string().nullable(),
  license_type: licenseTypeEnum.nullable(),
  license_url: z.string().url().nullable().or(z.literal('')).or(z.null()),
  license_risk: licenseRiskEnum.nullable(),
  platforms: z.array(platformEnum).nullable(),
  notes: z.string().nullable(),
  upsell_notes: z.string().nullable(),
  primary_image_path: z.string().nullable(),
  shipping_paid_by_customer: z.boolean().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

// ============================================================
// productCreateSchema — Input für Neues-Produkt-Modal
// Ohne id, created_at, updated_at, deleted_at, estimated_margin
// ============================================================

export const productCreateSchema = productSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
  estimated_margin: true,
  primary_image_path: true,
});

// ============================================================
// productUpdateSchema — Partial, für Auto-Save
// ============================================================

export const productUpdateSchema = productCreateSchema.partial();

// ============================================================
// Inferred types
// ============================================================

export type Product = z.infer<typeof productSchema>;
export type ProductCreate = z.infer<typeof productCreateSchema>;
export type ProductUpdate = z.infer<typeof productUpdateSchema>;
export type Status = z.infer<typeof statusEnum>;
export type MaterialType = z.infer<typeof materialTypeEnum>;
export type LicenseType = z.infer<typeof licenseTypeEnum>;
export type LicenseRisk = z.infer<typeof licenseRiskEnum>;
export type ShippingClass = z.infer<typeof shippingClassEnum>;
export type Platform = z.infer<typeof platformEnum>;
export type ColorVariant = z.infer<typeof colorVariantSchema>;
