/**
 * Search-Params der Websites-Route (Modul 16).
 * - tab: aktiver Tab (projects | clients | services)
 * - filter: Vorfilter aus Smart-Action-Navigation
 *   - expiring: Laufende Posten mit ablaufender Domain
 *   - deadline: Projekte mit naher/überschrittener Deadline
 */
export type WebsitesTab = 'projects' | 'clients' | 'services';
export type WebsitesFilter = 'expiring' | 'deadline';

export interface WebsitesSearch {
  tab?: WebsitesTab;
  filter?: WebsitesFilter;
}

const TABS: readonly WebsitesTab[] = ['projects', 'clients', 'services'];
const FILTERS: readonly WebsitesFilter[] = ['expiring', 'deadline'];

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
