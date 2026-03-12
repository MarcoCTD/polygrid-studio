import { z } from "zod";

export const LISTING_STATUSES = ["draft", "online", "paused", "archived"] as const;
export const LISTING_PLATFORMS = ["Etsy", "Amazon", "eBay", "Shopify", "Website", "Sonstiges"] as const;
export const LISTING_LANGUAGES = ["de", "en"] as const;

export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  draft: "Entwurf",
  online: "Online",
  paused: "Pausiert",
  archived: "Archiviert",
};

export const LISTING_STATUS_VARIANTS: Record<ListingStatus, "muted" | "success" | "warning" | "danger"> = {
  draft: "muted",
  online: "success",
  paused: "warning",
  archived: "danger",
};

// ── Full listing type (from DB) ──────────────────────────────────────────────

export const ListingSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
  product_id: z.string(),
  platform: z.string(),
  title: z.string(),
  short_description: z.string().nullable(),
  long_description: z.string().nullable(),
  bullet_points: z.array(z.string()),
  tags: z.array(z.string()),
  price: z.number(),
  variants: z.array(z.string()),
  shipping_info: z.string().nullable(),
  processing_time_days: z.number().nullable(),
  status: z.enum(LISTING_STATUSES),
  language: z.string(),
  seo_notes: z.string().nullable(),
  platform_specific_notes: z.string().nullable(),
});

export type Listing = z.infer<typeof ListingSchema>;

// ── Create/Edit form schema ──────────────────────────────────────────────────

const requiredPositiveNumber = z
  .union([z.string(), z.number()])
  .transform((v) => {
    const n = Number(v);
    if (isNaN(n) || n < 0) throw new Error("Ungültiger Betrag");
    return n;
  });

const optionalPositiveInt = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = parseInt(String(v), 10);
    return isNaN(n) ? null : n;
  })
  .nullable()
  .optional();

export const CreateListingSchema = z.object({
  product_id: z.string().min(1, "Produkt ist erforderlich"),
  platform: z.string().min(1, "Plattform ist erforderlich"),
  title: z.string().min(1, "Titel ist erforderlich"),
  short_description: z.string().optional().nullable(),
  long_description: z.string().optional().nullable(),
  price: requiredPositiveNumber,
  status: z.enum(LISTING_STATUSES).default("draft"),
  language: z.string().default("de"),
  processing_time_days: optionalPositiveInt,
  shipping_info: z.string().optional().nullable(),
  seo_notes: z.string().optional().nullable(),
  platform_specific_notes: z.string().optional().nullable(),
});

export type CreateListingInput = z.output<typeof CreateListingSchema>;
