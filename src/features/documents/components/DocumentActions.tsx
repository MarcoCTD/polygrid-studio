/**
 * Statusaktionen des Dokument-Editors (Modul 17, Etappe D).
 * Etappe C liefert den kompilierenden Platzhalter; die Aktionen
 * (Ausstellen, Angebot→Rechnung, Bezahlt, Storno, Löschen) folgen in D.
 */
import type { BusinessDocument } from '../schemas';

export interface DocumentActionsProps {
  document: BusinessDocument;
  /** Fehlende Pflichtangaben (deaktiviert das Ausstellen mit Begründung). */
  missingRequirements: string[];
  /** Speichert den Entwurf vor dem Ausstellen; null = Speichern fehlgeschlagen. */
  onBeforeIssue: () => Promise<BusinessDocument | null>;
  onChanged: () => void;
  onDeleted: () => void;
}

export function DocumentActions(_props: DocumentActionsProps) {
  return null;
}
