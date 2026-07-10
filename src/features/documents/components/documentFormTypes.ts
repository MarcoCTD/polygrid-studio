import type { DocumentLayout } from '../schemas';

/** Formularwerte des Dokument-Editors (nur Drafts sind editierbar). */
export interface DocumentFormValues {
  client_id: string;
  /** '' = kein Projekt */
  project_id: string;
  service_date: string;
  intro_text: string;
  outro_text: string;
  layout: DocumentLayout;
  line_items: { description: string; quantity: number; unit_price: number }[];
}
