import { z } from "zod";

// ── Entity types that can have linked files ──────────────────────────────────

export const ENTITY_TYPES = ["product", "expense", "order", "listing", "template"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  product: "Produkt",
  expense: "Ausgabe",
  order: "Auftrag",
  listing: "Listing",
  template: "Vorlage",
};

// ── File types ───────────────────────────────────────────────────────────────

export const FILE_TYPES = [
  "stl",
  "slicer",
  "image",
  "mockup",
  "listing_text",
  "packaging",
  "manual",
  "license",
  "receipt",
  "other",
] as const;
export type FileType = (typeof FILE_TYPES)[number];

export const FILE_TYPE_LABELS: Record<FileType, string> = {
  stl: "STL-Datei",
  slicer: "Slicer-Profil",
  image: "Bild",
  mockup: "Mockup",
  listing_text: "Listing-Text",
  packaging: "Verpackung",
  manual: "Anleitung",
  license: "Lizenz",
  receipt: "Beleg",
  other: "Sonstiges",
};

// ── Schemas ──────────────────────────────────────────────────────────────────

export const FileLinkSchema = z.object({
  id: z.string().uuid(),
  entity_type: z.enum(ENTITY_TYPES),
  entity_id: z.string().uuid(),
  file_type: z.enum(FILE_TYPES),
  file_path: z.string().min(1),
  file_name: z.string().min(1),
  file_size_bytes: z.number().int().nonnegative().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

export type FileLink = z.infer<typeof FileLinkSchema>;

export const CreateFileLinkSchema = z.object({
  entity_type: z.enum(ENTITY_TYPES, { message: "Entitätstyp ist erforderlich" }),
  entity_id: z.string().uuid(),
  file_type: z.enum(FILE_TYPES, { message: "Dateityp ist erforderlich" }),
  file_path: z.string().min(1, "Dateipfad ist erforderlich"),
  file_name: z.string().min(1, "Dateiname ist erforderlich"),
  file_size_bytes: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
});

export type CreateFileLink = z.infer<typeof CreateFileLinkSchema>;
