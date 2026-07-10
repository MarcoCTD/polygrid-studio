/**
 * PDF-Ablage in OneDrive (Modul 17, Spec Abschnitt 4, PDF-Weg 2).
 *
 * Tauri 2 bietet ohne Zusatz-Plugin kein programmatisches Print-to-PDF
 * (siehe ENTSCHEIDUNGEN_MODUL_17 E17-10). Deshalb der dokumentierte
 * Fallback: Der Zielordner /01_Finanzen/Rechnungen_{JJJJ}/ bzw.
 * Angebote_{JJJJ}/ wird angelegt, der Systemdruckdialog geöffnet
 * ("Als PDF sichern") und der erwartete Dateiname angezeigt. Nach dem
 * Speichern bestätigt der Nutzer; existiert die Datei, werden pdf_path
 * gesetzt und ein file_link (Modul 03) angelegt.
 */
import {
  checkPathExists,
  createDirectory,
  ensureOneDriveStructure,
  getOneDriveBasePath,
  openInExplorer,
} from '@/services/filesystem';
import { createFileLink } from '@/features/files/db';
import type { DocumentSnapshot } from '../schemas';
import { updateDocumentPdfPath } from './documentsService';

export interface OneDriveExportTarget {
  /** Absoluter Zielordner, z.B. …/01_Finanzen/Rechnungen_2026 */
  directory: string;
  /** Erwarteter Dateiname: {nummer}_{kundenname-slug}.pdf */
  filename: string;
  /** Absoluter erwarteter Pfad der PDF */
  expectedPath: string;
  /** Pfad relativ zum OneDrive-Basisordner (für file_links, portabel) */
  relativePath: string;
}

/** Slug-Regeln wie Produktordner (Modul 03): Umlaute, Kleinbuchstaben, Bindestriche. */
export function documentNameSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'kunde';
}

export function documentPdfFilename(snapshot: DocumentSnapshot): string {
  return `${snapshot.number}_${documentNameSlug(snapshot.recipient.name)}.pdf`;
}

export function documentOneDriveSubdirectory(snapshot: DocumentSnapshot): string {
  const year = snapshot.issue_date.slice(0, 4);
  return snapshot.type === 'invoice' ? `Rechnungen_${year}` : `Angebote_${year}`;
}

export async function isOneDriveConfigured(): Promise<boolean> {
  try {
    return (await getOneDriveBasePath()) !== null;
  } catch {
    return false;
  }
}

/** Legt den Zielordner an (falls nötig) und liefert Pfad + Dateinamen. */
export async function prepareOneDriveExportTarget(
  snapshot: DocumentSnapshot,
): Promise<OneDriveExportTarget> {
  try {
    const basePath = await getOneDriveBasePath();
    if (!basePath) {
      throw new Error('Kein OneDrive-Basispfad konfiguriert (Einstellungen → Allgemein).');
    }

    await ensureOneDriveStructure(basePath);
    const relativeDirectory = `01_Finanzen/${documentOneDriveSubdirectory(snapshot)}`;
    const directory = `${basePath}/${relativeDirectory}`;
    if (!(await checkPathExists(directory))) {
      await createDirectory(directory);
    }

    const filename = documentPdfFilename(snapshot);
    return {
      directory,
      filename,
      expectedPath: `${directory}/${filename}`,
      relativePath: `${relativeDirectory}/${filename}`,
    };
  } catch (error) {
    throw new Error(
      `OneDrive-Ablage konnte nicht vorbereitet werden: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

export async function openOneDriveExportFolder(target: OneDriveExportTarget): Promise<void> {
  try {
    await openInExplorer(target.directory);
  } catch (error) {
    throw new Error(
      `Ordner konnte nicht geöffnet werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Prüft nach dem Speichern, ob die PDF am erwarteten Pfad liegt.
 * Wenn ja: pdf_path setzen und file_link anlegen (einmalig).
 */
export async function confirmOneDrivePdfSaved(
  documentId: string,
  target: OneDriveExportTarget,
  options?: { hadPdfPath?: boolean },
): Promise<boolean> {
  try {
    const exists = await checkPathExists(target.expectedPath);
    if (!exists) return false;

    await updateDocumentPdfPath(documentId, target.expectedPath);
    if (!options?.hadPdfPath) {
      await createFileLink({
        entity_type: 'document',
        entity_id: documentId,
        file_path: target.relativePath,
        file_type: 'beleg',
        note: null,
        is_primary: 1,
        position: 0,
        file_size: null,
        mime_type: 'application/pdf',
        display_name: target.filename,
      });
    }
    return true;
  } catch (error) {
    throw new Error(
      `PDF-Ablage konnte nicht bestätigt werden: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
