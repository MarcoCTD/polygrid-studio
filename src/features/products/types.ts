import { z } from "zod";

export const PRODUCT_STATUSES = [
  "idea",
  "review",
  "print_ready",
  "test_print",
  "launch_ready",
  "online",
  "paused",
  "discontinued",
] as const;

export const MATERIAL_TYPES = [
  "PLA",
  "PLA+",
  "PETG",
  "ABS",
  "ASA",
  "TPU",
  "Resin",
  "Nylon",
  "PC",
  "HIPS",
] as const;

export const LICENSE_TYPES = [
  "own",
  "cc_by",
  "cc_by_sa",
  "cc_by_nc",
  "commercial",
  "unclear",
] as const;

export const LICENSE_RISKS = ["safe", "review_needed", "risky"] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
export type MaterialType = (typeof MATERIAL_TYPES)[number];

// ── Full product type (from DB) ───────────────────────────────────────────────

export const ProductSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
  name: z.string(),
  short_name: z.string().nullable(),
  category: z.string(),
  subcategory: z.string().nullable(),
  description_internal: z.string().nullable(),
  collection: z.string().nullable(),
  status: z.enum(PRODUCT_STATUSES),
  material_type: z.enum(MATERIAL_TYPES),
  color_variants: z.array(z.string()),      // parsed from JSON
  print_time_minutes: z.number().nullable(),
  material_grams: z.number().nullable(),
  electricity_cost: z.number().nullable(),
  packaging_cost: z.number().nullable(),
  shipping_class: z.string().nullable(),
  target_price: z.number().nullable(),
  min_price: z.number().nullable(),
  estimated_margin: z.number().nullable(),
  upsell_notes: z.string().nullable(),
  license_source: z.string().nullable(),
  license_type: z.enum(LICENSE_TYPES).nullable(),
  license_url: z.string().nullable(),
  license_risk: z.enum(LICENSE_RISKS).nullable(),
  platforms: z.array(z.string()),           // parsed from JSON
  notes: z.string().nullable(),
});

export type Product = z.infer<typeof ProductSchema>;

// ── Create/Edit form schema ───────────────────────────────────────────────────

const optionalPositiveNumber = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
  })
  .nullable()
  .optional();

export const CreateProductSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  category: z.string().min(1, "Kategorie ist erforderlich"),
  short_name: z.string().optional().nullable(),
  material_type: z.enum(MATERIAL_TYPES).default("PLA"),
  status: z.enum(PRODUCT_STATUSES).default("idea"),
  description_internal: z.string().optional().nullable(),
  target_price: optionalPositiveNumber,
  min_price: optionalPositiveNumber,
  print_time_minutes: optionalPositiveNumber,
  material_grams: optionalPositiveNumber,
  packaging_cost: optionalPositiveNumber,
  shipping_class: z.string().optional().nullable(),
  license_risk: z.enum(LICENSE_RISKS).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>;
