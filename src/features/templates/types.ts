import { z } from "zod";

export const TEMPLATE_CATEGORIES = [
  "impressum",
  "widerruf",
  "versand",
  "faq",
  "antwort",
  "kundenservice",
  "beilage",
  "reklamation",
  "sonstiges",
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  impressum: "Impressum",
  widerruf: "Widerrufsbelehrung",
  versand: "Versandinfo",
  faq: "FAQ",
  antwort: "Antwortvorlage",
  kundenservice: "Kundenservice",
  beilage: "Beilagentext",
  reklamation: "Reklamation",
  sonstiges: "Sonstiges",
};

// ── Full template type (from DB) ─────────────────────────────────────────────

export const TemplateSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
  name: z.string(),
  category: z.enum(TEMPLATE_CATEGORIES),
  content: z.string(),
  platforms: z.array(z.string()),
  variables: z.array(z.string()),
  version: z.number(),
  is_legal: z.boolean(),
  notes: z.string().nullable(),
});

export type Template = z.infer<typeof TemplateSchema>;

// ── Create/Edit form schema ──────────────────────────────────────────────────

export const CreateTemplateSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  category: z.enum(TEMPLATE_CATEGORIES, {
    message: "Kategorie ist erforderlich",
  }),
  content: z.string().min(1, "Inhalt ist erforderlich"),
  is_legal: z.boolean().default(false),
  notes: z.string().optional().nullable(),
});

export type CreateTemplateInput = z.output<typeof CreateTemplateSchema>;
