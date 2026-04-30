import { convertFileSrc } from '@tauri-apps/api/core';
import { relativeToAbsolute } from '@/features/files/productFolders';
import { getOneDriveBasePath } from '@/services/filesystem';

export async function resolveImageSrc(filePath: string): Promise<string> {
  if (isAbsolutePath(filePath)) {
    return convertFileSrc(filePath);
  }

  const basePath = await getOneDriveBasePath();
  if (!basePath) {
    throw new Error('Kein OneDrive-Basispfad konfiguriert.');
  }

  return convertFileSrc(relativeToAbsolute(filePath, basePath));
}

function isAbsolutePath(filePath: string): boolean {
  return filePath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(filePath);
}
