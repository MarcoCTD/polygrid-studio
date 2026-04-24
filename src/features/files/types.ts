import { z } from 'zod';

export const fileTypeSchema = z.enum(['stl', 'slicer', 'image', 'mockup', 'beleg', 'sonstiges']);

export const newFileLinkSchema = z.object({
  entity_type: z.string().min(1),
  entity_id: z.string().min(1),
  file_path: z.string().min(1),
  file_type: fileTypeSchema,
  note: z.string().nullable(),
  is_primary: z.number().int().min(0).max(1),
  position: z.number().int().min(0),
  file_size: z.number().int().min(0).nullable(),
  mime_type: z.string().nullable(),
  display_name: z.string().nullable(),
});

export interface FileLink {
  id: string;
  entity_type: string;
  entity_id: string;
  file_path: string;
  file_type: string;
  note: string | null;
  is_primary: number;
  position: number;
  file_size: number | null;
  mime_type: string | null;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface FileLinkWithProductName extends FileLink {
  product_name: string | null;
}

export type NewFileLink = Omit<FileLink, 'id' | 'created_at' | 'updated_at'>;
export type FileType = z.infer<typeof fileTypeSchema>;
