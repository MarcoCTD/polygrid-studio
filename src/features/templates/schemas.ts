import { z } from 'zod';

export const templateCategoryEnum = z.enum([
  'impressum',
  'widerruf',
  'versand',
  'faq',
  'antwort',
  'kundenservice',
  'beilage',
  'reklamation',
  'sonstiges',
]);

export const templatePlatformEnum = z.enum(['etsy', 'ebay', 'kleinanzeigen']);

export const templateVariableSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim(),
});

export const templateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  category: templateCategoryEnum,
  content: z.string().min(1),
  platforms: z.array(templatePlatformEnum).nullable(),
  variables: z.array(templateVariableSchema).nullable(),
  version: z.number().int().min(1),
  is_legal: z.boolean(),
  notes: z.string().nullable(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
  deleted_at: z.string().nullable(),
});

export const templateCreateSchema = templateSchema
  .omit({
    id: true,
    version: true,
    created_at: true,
    updated_at: true,
    deleted_at: true,
  })
  .extend({
    platforms: z.array(templatePlatformEnum).nullable().optional(),
    variables: z.array(templateVariableSchema).nullable().optional(),
    is_legal: z.boolean().optional(),
    notes: z.string().nullable().optional(),
  });

export const templateUpdateSchema = templateCreateSchema.partial();

export const templateFilterSchema = z.object({
  category: templateCategoryEnum.optional(),
  search: z.string().trim().optional(),
});

export type TemplateCategory = z.infer<typeof templateCategoryEnum>;
export type TemplatePlatform = z.infer<typeof templatePlatformEnum>;
export type TemplateVariable = z.infer<typeof templateVariableSchema>;
export type Template = z.infer<typeof templateSchema>;
export type TemplateCreate = z.infer<typeof templateCreateSchema>;
export type TemplateUpdate = z.infer<typeof templateUpdateSchema>;
export type TemplateFilter = z.infer<typeof templateFilterSchema>;
