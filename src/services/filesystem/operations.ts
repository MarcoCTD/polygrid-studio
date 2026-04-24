import { getDatabase } from '@/services/database';

export type FileOperationType = 'rename' | 'move' | 'copy' | 'archive' | 'create_dir';
export type FileOperationStatus = 'success' | 'failed' | 'undone';

export interface FileOperation {
  id: string;
  operationType: FileOperationType;
  sourcePath: string;
  targetPath: string | null;
  status: FileOperationStatus;
  errorMessage: string | null;
  isUndoable: boolean;
  createdAt: string;
  undoneAt: string | null;
}

export interface FileOperationLogInput {
  operationType: FileOperationType;
  sourcePath: string;
  targetPath: string | null;
  status?: FileOperationStatus;
  errorMessage?: string | null;
  isUndoable: boolean;
}

interface FileOperationRow {
  id: string;
  operation_type: FileOperationType;
  source_path: string;
  target_path: string | null;
  status: FileOperationStatus;
  error_message: string | null;
  is_undoable: number | boolean;
  created_at: string;
  undone_at: string | null;
}

export async function logFileOperation(input: FileOperationLogInput): Promise<FileOperation> {
  const db = getDatabase();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  await db.execute(
    `INSERT INTO file_operations (
      id, operation_type, source_path, target_path, status, error_message,
      is_undoable, created_at, undone_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL)`,
    [
      id,
      input.operationType,
      input.sourcePath,
      input.targetPath,
      input.status ?? 'success',
      input.errorMessage ?? null,
      input.isUndoable ? 1 : 0,
      createdAt,
    ],
  );

  return {
    id,
    operationType: input.operationType,
    sourcePath: input.sourcePath,
    targetPath: input.targetPath,
    status: input.status ?? 'success',
    errorMessage: input.errorMessage ?? null,
    isUndoable: input.isUndoable,
    createdAt,
    undoneAt: null,
  };
}

export async function getRecentOperations(limit = 20): Promise<FileOperation[]> {
  const db = getDatabase();
  const rows = await db.select<FileOperationRow[]>(
    `SELECT * FROM file_operations
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit],
  );

  return rows.map(rowToFileOperation);
}

export async function getLastUndoableOperation(): Promise<FileOperation | null> {
  const db = getDatabase();
  const rows = await db.select<FileOperationRow[]>(
    `SELECT * FROM file_operations
     WHERE status = 'success'
       AND is_undoable = 1
       AND undone_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
  );

  if (rows.length === 0) {
    return null;
  }

  return rowToFileOperation(rows[0]);
}

export async function markOperationUndone(id: string): Promise<void> {
  const db = getDatabase();
  await db.execute(
    `UPDATE file_operations
     SET status = 'undone', undone_at = $1
     WHERE id = $2`,
    [new Date().toISOString(), id],
  );
}

function rowToFileOperation(row: FileOperationRow): FileOperation {
  return {
    id: row.id,
    operationType: row.operation_type,
    sourcePath: row.source_path,
    targetPath: row.target_path,
    status: row.status,
    errorMessage: row.error_message,
    isUndoable: Boolean(row.is_undoable),
    createdAt: row.created_at,
    undoneAt: row.undone_at,
  };
}
