import { getDatabase } from '@/services/database';
import type { FileLink, NewFileLink } from './types';

function now(): string {
  return new Date().toISOString();
}

function rowToFileLink(row: Record<string, unknown>): FileLink {
  return {
    id: row.id as string,
    entity_type: row.entity_type as string,
    entity_id: row.entity_id as string,
    file_path: row.file_path as string,
    file_type: row.file_type as string,
    note: (row.note as string) ?? null,
    is_primary: Number(row.is_primary ?? 0),
    position: Number(row.position ?? 0),
    file_size: (row.file_size as number) ?? null,
    mime_type: (row.mime_type as string) ?? null,
    display_name: (row.display_name as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function createFileLink(data: NewFileLink): Promise<FileLink> {
  const db = getDatabase();
  const id = crypto.randomUUID();
  const timestamp = now();

  await db.execute(
    `INSERT INTO file_links (
      id, entity_type, entity_id, file_path, file_type, note, is_primary,
      position, file_size, mime_type, display_name, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12, $13
    )`,
    [
      id,
      data.entity_type,
      data.entity_id,
      data.file_path,
      data.file_type,
      data.note,
      data.is_primary,
      data.position,
      data.file_size,
      data.mime_type,
      data.display_name,
      timestamp,
      timestamp,
    ],
  );

  const rows = await db.select<Record<string, unknown>[]>(
    'SELECT * FROM file_links WHERE id = $1',
    [id],
  );
  return rowToFileLink(rows[0]);
}

export async function getFileLinksByEntity(
  entityType: string,
  entityId: string,
): Promise<FileLink[]> {
  const db = getDatabase();
  const rows = await db.select<Record<string, unknown>[]>(
    `SELECT * FROM file_links
     WHERE entity_type = $1 AND entity_id = $2
     ORDER BY file_type ASC, position ASC, created_at DESC`,
    [entityType, entityId],
  );

  return rows.map(rowToFileLink);
}

export async function updateFileLink(id: string, data: Partial<FileLink>): Promise<void> {
  const db = getDatabase();
  const allowedFields = [
    'entity_type',
    'entity_id',
    'file_path',
    'file_type',
    'note',
    'is_primary',
    'position',
    'file_size',
    'mime_type',
    'display_name',
  ] as const;
  const setClauses = ['updated_at = $1'];
  const params: unknown[] = [now()];
  let paramIndex = 2;

  for (const field of allowedFields) {
    if (field in data) {
      setClauses.push(`${field} = $${paramIndex}`);
      params.push(data[field] ?? null);
      paramIndex++;
    }
  }

  if (setClauses.length === 1) {
    return;
  }

  params.push(id);
  await db.execute(
    `UPDATE file_links SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
    params,
  );
}

export async function deleteFileLink(id: string): Promise<void> {
  const db = getDatabase();
  await db.execute('DELETE FROM file_links WHERE id = $1', [id]);
}

export async function setPrimaryFileLink(
  entityId: string,
  entityType: string,
  fileType: string,
  fileLinkId: string,
): Promise<void> {
  const db = getDatabase();
  const timestamp = now();

  await db.execute(
    `UPDATE file_links
     SET is_primary = 0, updated_at = $1
     WHERE entity_id = $2 AND entity_type = $3 AND file_type = $4 AND id != $5`,
    [timestamp, entityId, entityType, fileType, fileLinkId],
  );
  await db.execute('UPDATE file_links SET is_primary = 1, updated_at = $1 WHERE id = $2', [
    timestamp,
    fileLinkId,
  ]);

  if (entityType === 'product' && fileType === 'image') {
    const rows = await db.select<{ file_path: string }[]>(
      'SELECT file_path FROM file_links WHERE id = $1',
      [fileLinkId],
    );
    const imagePath = rows[0]?.file_path ?? null;
    await db.execute('UPDATE products SET primary_image_path = $1, updated_at = $2 WHERE id = $3', [
      imagePath,
      timestamp,
      entityId,
    ]);
  }
}

export async function searchProductsForFileLinks(
  query: string,
): Promise<{ id: string; name: string }[]> {
  const db = getDatabase();
  const term = `%${query.trim()}%`;
  return db.select<{ id: string; name: string }[]>(
    `SELECT id, name FROM products
     WHERE deleted_at IS NULL AND name LIKE $1
     ORDER BY name ASC
     LIMIT 5`,
    [term],
  );
}
