import { normalizeProductFolderName } from './productFolders';
import type { FileType } from './types';

/**
 * Zielordner-Logik fuer den Auto-Import beim Datei-Verknuepfen:
 * bestimmt, wohin eine Datei von ausserhalb des OneDrive-Basisordners
 * kopiert wird. Alle Rueckgaben sind relative Pfade zur Basis.
 */
export type ImportContext =
  | { kind: 'product'; productName: string }
  | { kind: 'expense'; expenseDate: string | null }
  | { kind: 'order' };

const PRODUCT_SUBFOLDER_BY_FILE_TYPE: Partial<Record<FileType, string>> = {
  image: 'Bilder',
  mockup: 'Bilder',
  stl: 'STL',
  slicer: 'Slicer',
};

export function getImportTargetFolder(context: ImportContext, fileType: FileType): string {
  switch (context.kind) {
    case 'product': {
      const productRoot = `02_Produkte/${normalizeProductFolderName(context.productName)}`;
      const subfolder = PRODUCT_SUBFOLDER_BY_FILE_TYPE[fileType];
      return subfolder ? `${productRoot}/${subfolder}` : productRoot;
    }
    case 'expense':
      return `01_Finanzen/Belege_${getBelegeYear(context.expenseDate)}`;
    case 'order':
      return '04_Auftraege';
  }
}

/** Jahr aus dem Ausgabendatum (ISO), Fallback: aktuelles Jahr. */
export function getBelegeYear(expenseDate: string | null): number {
  const match = expenseDate?.match(/^(\d{4})-\d{2}-\d{2}/);
  if (match) {
    return Number(match[1]);
  }
  return new Date().getFullYear();
}

/** Liegt der absolute Pfad innerhalb des OneDrive-Basisordners? */
export function isPathInsideBase(filePath: string, basePath: string): boolean {
  const normalizedFilePath = normalizePathForCompare(filePath);
  const normalizedBasePath = normalizePathForCompare(basePath);
  return (
    normalizedFilePath === normalizedBasePath ||
    normalizedFilePath.startsWith(`${normalizedBasePath}/`)
  );
}

function normalizePathForCompare(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '');
}
