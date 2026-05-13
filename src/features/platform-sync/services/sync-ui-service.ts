import { getDatabase } from '@/services/database';
import { getProduct } from '@/features/products/db';
import {
  getListing,
  getListingImages,
  getListings,
  type ListingDetail,
  type ListingImageWithFile,
  type ListingListItem,
} from '@/features/listings/listingsService';
import type { FileLink } from '@/features/files/types';
import type { Platform } from '../providers/types';
import type { ListingWithProduct } from '../providers/types';

export interface SyncListingFilters {
  platform?: Platform | 'all';
  status?: 'all' | 'error' | 'conflict' | 'pending' | 'not_synced' | 'synced';
}

export interface SyncListingItem extends ListingListItem {
  syncPlatform: Platform;
}

export interface ResolvedSyncListing {
  listing: ListingWithProduct;
  detail: ListingDetail;
  images: FileLink[];
}

function isSyncPlatform(value: string): value is Platform {
  return value === 'etsy' || value === 'ebay';
}

function toFileLink(image: ListingImageWithFile): FileLink {
  return {
    id: image.file_link_id,
    entity_type: 'listing',
    entity_id: image.listing_id,
    file_path: image.file_path,
    file_type: image.file_type,
    note: image.alt_text,
    is_primary: image.sort_order === 0 ? 1 : 0,
    position: image.sort_order,
    file_size: null,
    mime_type: image.mime_type,
    display_name: image.display_name,
    created_at: '',
    updated_at: '',
  };
}

export async function getSyncListings(
  filters: SyncListingFilters = {},
): Promise<SyncListingItem[]> {
  try {
    const listings = await getListings({ showDeleted: false });
    return listings
      .filter((listing) => isSyncPlatform(listing.platform))
      .filter((listing) => {
        if (filters.platform && filters.platform !== 'all' && listing.platform !== filters.platform) {
          return false;
        }
        if (filters.status && filters.status !== 'all' && listing.sync_status !== filters.status) {
          return false;
        }
        return true;
      })
      .map((listing) => ({ ...listing, syncPlatform: listing.platform as Platform }));
  } catch (error) {
    throw new Error(
      `Sync-Listings konnten nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function getSyncErrorCount(): Promise<number> {
  try {
    const rows = await getDatabase().select<Array<{ count: number }>>(
      `SELECT COUNT(*) AS count
       FROM listings
       WHERE deleted_at IS NULL
         AND platform IN ('etsy', 'ebay')
         AND sync_status = 'error'`,
    );
    return rows[0]?.count ?? 0;
  } catch (error) {
    throw new Error(
      `Sync-Fehleranzahl konnte nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function getPendingSyncListings(platform?: Platform): Promise<SyncListingItem[]> {
  const listings = await getSyncListings({ platform: platform ?? 'all' });
  return listings.filter((listing) =>
    ['not_synced', 'pending', 'error', 'conflict'].includes(listing.sync_status),
  );
}

export async function resolveSyncListing(listingId: string): Promise<ResolvedSyncListing> {
  try {
    const detail = await getListing(listingId);
    if (!detail) {
      throw new Error('Listing nicht gefunden.');
    }
    if (!isSyncPlatform(detail.platform)) {
      throw new Error(`Platform Sync unterstützt diese Plattform nicht: ${detail.platform}`);
    }

    const product = await getProduct(detail.product_id);
    if (!product) {
      throw new Error('Produkt zum Listing nicht gefunden.');
    }

    const imageRows = await getListingImages(listingId);
    const images = imageRows.map(toFileLink);

    return {
      detail,
      images,
      listing: {
        listing: detail,
        product,
        overrides: {},
        platformMetadata: detail.platform_metadata,
      },
    };
  } catch (error) {
    throw new Error(
      `Sync-Listing konnte nicht aufgelöst werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
