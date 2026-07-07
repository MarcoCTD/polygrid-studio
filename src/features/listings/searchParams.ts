import type { CompletenessStatus } from './listingsService';
import type { ListingStatus } from './schemas';

/**
 * Search-Params der Listings-Route.
 * - completeness: Komma-getrennte Ampel-Werte (z.B. "red")
 * - status: Komma-getrennte Listing-Status (z.B. "online,draft")
 */
export interface ListingsSearch {
  completeness?: string;
  status?: string;
}

const COMPLETENESS_VALUES: CompletenessStatus[] = ['green', 'yellow', 'red'];
const STATUS_VALUES: ListingStatus[] = ['draft', 'ready', 'online', 'paused', 'archived'];

export function parseCompletenessList(value: string | undefined): CompletenessStatus[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item): item is CompletenessStatus =>
      (COMPLETENESS_VALUES as string[]).includes(item),
    );
}

export function parseListingStatusList(value: string | undefined): ListingStatus[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item): item is ListingStatus => (STATUS_VALUES as string[]).includes(item));
}

export function validateListingsSearch(search: Record<string, unknown>): ListingsSearch {
  const result: ListingsSearch = {};

  if (typeof search.completeness === 'string' && parseCompletenessList(search.completeness).length > 0) {
    result.completeness = search.completeness;
  }
  if (typeof search.status === 'string' && parseListingStatusList(search.status).length > 0) {
    result.status = search.status;
  }

  return result;
}
