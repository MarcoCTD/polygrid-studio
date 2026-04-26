import { createDirectory } from '@/services/filesystem';

export const PRODUCT_SUBFOLDERS = ['STL', 'Slicer', 'Bilder', 'Listings', 'Verpackung', 'Lizenz'];

export function normalizeProductFolderName(name: string): string {
  return name
    .replace(/Ä/g, 'Ae')
    .replace(/Ö/g, 'Oe')
    .replace(/Ü/g, 'Ue')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function joinFilePath(parent: string, child: string): string {
  const separator = parent.includes('\\') ? '\\' : '/';
  return `${parent.replace(/[\\/]+$/, '')}${separator}${child}`;
}

export function getProductFolderPath(basePath: string, productName: string): string {
  return joinFilePath(
    joinFilePath(basePath, '02_Produkte'),
    normalizeProductFolderName(productName),
  );
}

export async function createProductFolderStructure(
  basePath: string,
  productName: string,
): Promise<string> {
  const productFolder = getProductFolderPath(basePath, productName);
  await createDirectory(productFolder);

  for (const subfolder of PRODUCT_SUBFOLDERS) {
    await createDirectory(joinFilePath(productFolder, subfolder));
  }

  return productFolder;
}

export function absoluteToRelative(absPath: string, basePath: string): string {
  const normalizedBase = basePath.replace(/[\\/]+$/, '');
  const normalizedPath = absPath.replace(/\\/g, '/');
  const normalizedBaseForward = normalizedBase.replace(/\\/g, '/');

  if (normalizedPath === normalizedBaseForward) {
    return '';
  }

  if (!normalizedPath.startsWith(`${normalizedBaseForward}/`)) {
    throw new Error('Datei liegt nicht innerhalb des OneDrive-Basispfads.');
  }

  return normalizedPath.slice(normalizedBaseForward.length + 1);
}

export function relativeToAbsolute(relativePath: string, basePath: string): string {
  return joinFilePath(basePath, relativePath);
}
