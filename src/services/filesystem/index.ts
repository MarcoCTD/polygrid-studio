import { invoke } from '@tauri-apps/api/core';
import {
  getLastUndoableOperation,
  logFileOperation,
  markOperationUndone,
  type FileOperationLogInput,
} from './operations';
import { getOneDriveBasePath } from './settings';

export type FsError =
  | { kind: 'PathOutsideBase' }
  | { kind: 'NotFound' }
  | { kind: 'PermissionDenied' }
  | { kind: 'AlreadyExists' }
  | { kind: 'Io'; message: string };

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number | null;
  modifiedAt: number | null;
  extension: string | null;
}

export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number | null;
  modifiedAt: number | null;
  extension: string | null;
}

interface PathCommandArgs extends Record<string, unknown> {
  path: string;
  basePath: string | null;
}

interface WriteCommandResult {
  operationType: FileOperationLogInput['operationType'];
  sourcePath: string;
  targetPath: string | null;
  isUndoable: boolean;
}

async function withBasePath(path: string): Promise<PathCommandArgs> {
  return {
    path,
    basePath: await getOneDriveBasePath(),
  };
}

async function requireBasePath(): Promise<string> {
  const basePath = await getOneDriveBasePath();
  if (!basePath) {
    throw new Error('Kein OneDrive-Basispfad konfiguriert.');
  }
  return basePath;
}

export async function listDirectory(path: string): Promise<FileEntry[]> {
  return invoke<FileEntry[]>('list_directory', await withBasePath(path));
}

export async function getFileInfo(path: string): Promise<FileInfo> {
  return invoke<FileInfo>('get_file_info', await withBasePath(path));
}

export async function createDirectory(path: string): Promise<void> {
  await invoke<void>('create_directory', await withBasePath(path));
}

export async function openInExplorer(path: string): Promise<void> {
  await invoke<void>('open_in_explorer', await withBasePath(path));
}

export async function checkPathExists(path: string): Promise<boolean> {
  return invoke<boolean>('check_path_exists', await withBasePath(path));
}

export async function ensureOneDriveStructure(basePath: string): Promise<void> {
  await invoke<void>('ensure_onedrive_structure', { basePath });
}

export async function renameFile(oldPath: string, newPath: string): Promise<void> {
  const basePath = await requireBasePath();
  const result = await invoke<WriteCommandResult>('rename_file', { basePath, oldPath, newPath });
  await logSuccessfulOperation(result);
}

export async function moveFile(source: string, target: string): Promise<void> {
  const basePath = await requireBasePath();
  const result = await invoke<WriteCommandResult>('move_file', { basePath, source, target });
  await logSuccessfulOperation(result);
}

export async function copyFile(source: string, target: string): Promise<void> {
  const basePath = await requireBasePath();
  const result = await invoke<WriteCommandResult>('copy_file', { basePath, source, target });
  await logSuccessfulOperation(result);
}

export async function deleteToArchive(path: string): Promise<void> {
  const basePath = await requireBasePath();
  const result = await invoke<WriteCommandResult>('delete_to_archive', { basePath, path });
  await logSuccessfulOperation(result);
}

export async function undoLastOperation(): Promise<void> {
  const basePath = await requireBasePath();
  const operation = await getLastUndoableOperation();
  if (!operation) {
    throw new Error('Keine rueckgaengig machbare Dateioperation gefunden.');
  }

  await invoke<void>('undo_last_operation', {
    basePath,
    operationType: operation.operationType,
    sourcePath: operation.sourcePath,
    targetPath: operation.targetPath,
  });
  await markOperationUndone(operation.id);
}

async function logSuccessfulOperation(result: WriteCommandResult): Promise<void> {
  // DB-Zugriff existiert im Frontend-Service via Tauri SQL Plugin; Rust bleibt auf sichere
  // Dateisystemoperationen beschraenkt und liefert nur relative Log-Metadaten zurueck.
  await logFileOperation({
    operationType: result.operationType,
    sourcePath: result.sourcePath,
    targetPath: result.targetPath,
    status: 'success',
    errorMessage: null,
    isUndoable: result.isUndoable,
  });
}

export { getLastUndoableOperation, getRecentOperations, type FileOperation } from './operations';
export { getOneDriveBasePath, hasOneDriveBasePath, setOneDriveBasePath } from './settings';
