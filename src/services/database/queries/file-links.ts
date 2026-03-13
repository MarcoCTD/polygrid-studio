import { getDb, now } from "../db";
import type { FileLink, CreateFileLink, EntityType } from "@/features/files/types";

// ── Row shape from SQLite ────────────────────────────────────────────────────

interface FileLinkRow {
  id: string;
  entity_type: string;
  entity_id: string;
  file_type: string;
  file_path: string;
  file_name: string;
  file_size_bytes: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function rowToFileLink(row: FileLinkRow): FileLink {
  return {
    id: row.id,
    entity_type: row.entity_type as FileLink["entity_type"],
    entity_id: row.entity_id,
    file_type: row.file_type as FileLink["file_type"],
    file_path: row.file_path,
    file_name: row.file_name,
    file_size_bytes: row.file_size_bytes,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

// ── Queries ──────────────────────────────────────────────────────────────────

export async function listFileLinks(): Promise<FileLink[]> {
  const db = await getDb();
  const rows = await db.select<FileLinkRow[]>(
    `SELECT * FROM file_links WHERE deleted_at IS NULL ORDER BY created_at DESC`
  );
  return rows.map(rowToFileLink);
}

export async function listFileLinksByEntity(
  entityType: EntityType,
  entityId: string
): Promise<FileLink[]> {
  const db = await getDb();
  const rows = await db.select<FileLinkRow[]>(
    `SELECT * FROM file_links
     WHERE deleted_at IS NULL AND entity_type = ? AND entity_id = ?
     ORDER BY file_type, file_name`,
    [entityType, entityId]
  );
  return rows.map(rowToFileLink);
}

export async function getFileLink(id: string): Promise<FileLink | null> {
  const db = await getDb();
  const rows = await db.select<FileLinkRow[]>(
    `SELECT * FROM file_links WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  return rows.length > 0 ? rowToFileLink(rows[0]) : null;
}

export async function createFileLink(data: CreateFileLink): Promise<FileLink> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const ts = now();

  await db.execute(
    `INSERT INTO file_links (id, entity_type, entity_id, file_type, file_path, file_name, file_size_bytes, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.entity_type,
      data.entity_id,
      data.file_type,
      data.file_path,
      data.file_name,
      data.file_size_bytes ?? null,
      data.notes ?? null,
      ts,
      ts,
    ]
  );

  const created = await getFileLink(id);
  if (!created) throw new Error("Failed to create file link");
  return created;
}

export async function deleteFileLink(id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE file_links SET deleted_at = ?, updated_at = ? WHERE id = ?`,
    [now(), now(), id]
  );
}

export async function getFileLinkCounts(): Promise<Record<string, number>> {
  const db = await getDb();
  const rows = await db.select<{ entity_type: string; count: number }[]>(
    `SELECT entity_type, COUNT(*) as count FROM file_links
     WHERE deleted_at IS NULL GROUP BY entity_type`
  );
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.entity_type] = row.count;
  }
  return counts;
}
