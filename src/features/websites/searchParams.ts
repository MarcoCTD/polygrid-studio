/**
 * Search-Params der Websites-Route (Modul 16, erweitert in Modul 17).
 * - tab: aktiver Tab (projects | clients | services | documents)
 * - filter: Vorfilter aus Smart-Action-Navigation
 *   - expiring: Laufende Posten mit ablaufender Domain
 *   - deadline: Projekte mit naher/überschrittener Deadline
 *   - overdue: Überfällige Rechnungen (Dokumente-Tab, Modul 17)
 */
export type WebsitesTab = 'projects' | 'clients' | 'services' | 'documents';
export type WebsitesFilter = 'expiring' | 'deadline' | 'overdue';

export interface WebsitesSearch {
  tab?: WebsitesTab;
  filter?: WebsitesFilter;
}

const TABS: readonly WebsitesTab[] = ['projects', 'clients', 'services', 'documents'];
const FILTERS: readonly WebsitesFilter[] = ['expiring', 'deadline', 'overdue'];

export function validateWebsitesSearch(search: Record<string, unknown>): WebsitesSearch {
  const result: WebsitesSearch = {};

  if (typeof search.tab === 'string' && (TABS as readonly string[]).includes(search.tab)) {
    result.tab = search.tab as WebsitesTab;
  }
  if (typeof search.filter === 'string' && (FILTERS as readonly string[]).includes(search.filter)) {
    result.filter = search.filter as WebsitesFilter;
  }

  return result;
}
