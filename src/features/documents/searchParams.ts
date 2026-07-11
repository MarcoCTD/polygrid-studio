/**
 * Search-Params des Dokument-Konfigurators (Addendum 2): section wählt den
 * Abschnitt, type den Dokumenttyp im Bausteine-Abschnitt (Deep-Link aus dem
 * Editor: "Standards verwalten").
 */
import type { DocumentType } from './schemas';

export type ConfiguratorSection = 'positions' | 'blocks' | 'texts';

export interface ConfiguratorSearch {
  section?: ConfiguratorSection;
  type?: DocumentType;
}

export function validateConfiguratorSearch(search: Record<string, unknown>): ConfiguratorSearch {
  const result: ConfiguratorSearch = {};
  if (search.section === 'positions' || search.section === 'blocks' || search.section === 'texts') {
    result.section = search.section;
  }
  if (search.type === 'quote' || search.type === 'invoice') {
    result.type = search.type;
  }
  return result;
}
