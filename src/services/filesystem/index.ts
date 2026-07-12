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

/**
 * Liest Datei-Infos einer Datei AUSSERHALB des OneDrive-Basisordners
 * (z.B. fuer den Import beim Verknuepfen). Nur Lesen, keine Schreiboperation.
 */
export async function getExternalFileInfo(path: string): Promise<FileInfo> {
  return invoke<FileInfo>('get_file_info', { path, basePath: null });
}

/**
 * Importiert eine externe Datei in den OneDrive-Basisordner: Kopie in
 * `targetFolder` (relativ zur Basis, wird bei Bedarf angelegt), Namenskonflikte
 * werden per Suffix -1/-2 geloest, das Original bleibt unveraendert.
 * Liefert den relativen Pfad der neuen Kopie. Fehlversuche landen mit
 * Status 'failed' im Operations-Log.
 */
export async function importFileToBase(
  source: string,
  targetFolder: string,
  fileName: string,
): Promise<string> {
  const basePath = await requireBasePath();
  let result: WriteCommandResult;
  try {
    result = await invoke<WriteCommandResult>('import_file_to_base', {
      basePath,
      source,
      targetFolder,
      fileName,
    });
  } catch (err) {
    const message = formatImportError(err);
    try {
      await logFileOperation({
        operationType: 'import',
        sourcePath: source,
        targetPath: `${targetFolder}/${fileName}`,
        status: 'failed',
        errorMessage: message,
        isUndoable: false,
      });
    } catch {
      // Log-Fehler duerfen die eigentliche Fehlermeldung nicht verdecken.
    }
    throw new Error(message);
  }

  await logSuccessfulOperation(result);
  if (!result.targetPath) {
    throw new Error('Import lieferte keinen Zielpfad zurueck.');
  }
  return result.targetPath;
}

function formatImportError(err: unknown): string {
  if (err && typeof err === 'object' && 'kind' in err) {
    const fsError = err as FsError;
    switch (fsError.kind) {
      case 'NotFound':
        return 'Die Quelldatei wurde nicht gefunden.';
      case 'PermissionDenied':
        return 'Keine Berechtigung zum Lesen der Quelldatei oder Schreiben am Zielort.';
      case 'PathOutsideBase':
        return 'Der Zielordner liegt nicht innerhalb des OneDrive-Basisordners.';
      case 'AlreadyExists':
        return 'Am Zielort existiert bereits eine gleichnamige Datei.';
      case 'Io':
        return `Datei konnte nicht kopiert werden: ${fsError.message}`;
    }
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'Datei konnte nicht kopiert werden.';
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

/**
 * Schreibt eine Exportdatei in den OneDrive-Basisordner (relativer Pfad,
 * z.B. "01_Finanzen/Exporte/euer_2026_firma.xlsx"). Legt die
 * Standard-Ordnerstruktur bei Bedarf an. Liefert den absoluten Zielpfad.
 */
export async function writeExportFileToBase(
  relativePath: string,
  contents: Uint8Array,
): Promise<string> {
  const basePath = await requireBasePath();
  await ensureOneDriveStructure(basePath);
  return invoke<string>('write_export_file', {
    path: `${basePath}/${relativePath}`,
    basePath,
    contents: Array.from(contents),
  });
}

/** Schreibt eine Exportdatei an einen per Speichern-Dialog gewählten Pfad. */
export async function writeExportFileToPath(
  absolutePath: string,
  contents: Uint8Array,
): Promise<string> {
  return invoke<string>('write_export_file', {
    path: absolutePath,
    basePath: null,
    contents: Array.from(contents),
  });
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
