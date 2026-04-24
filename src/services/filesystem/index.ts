import { invoke } from '@tauri-apps/api/core';
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

async function withBasePath(path: string): Promise<PathCommandArgs> {
  return {
    path,
    basePath: await getOneDriveBasePath(),
  };
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

export { getOneDriveBasePath, hasOneDriveBasePath, setOneDriveBasePath } from './settings';
