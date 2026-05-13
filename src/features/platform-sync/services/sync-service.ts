import type {
  BatchSyncResult,
  Platform,
  PlatformSyncProvider,
  PullOrdersResult,
  SyncResult,
  ListingWithProduct,
  SyncDiff,
  SyncLogFilters,
  SyncStatusInfo,
} from '../providers/types';
import { platformProviderRegistry, type PlatformProviderRegistry } from '../providers/registry';
import { etsyProvider } from '../providers/etsy';
import { ebayProvider } from '../providers/ebay';
import { getSyncJobs } from '../db/sync-jobs-queries';
import type { SyncJob } from '../db/sync-jobs-schema';
import {
  getPendingSyncListings,
  resolveSyncListing,
} from './sync-ui-service';
import {
  buildSyncDiff,
  toLocalRemoteListingData,
} from '../utils/diff';

if (!platformProviderRegistry.hasProvider('etsy')) {
  platformProviderRegistry.registerProvider(etsyProvider);
}
if (!platformProviderRegistry.hasProvider('ebay')) {
  platformProviderRegistry.registerProvider(ebayProvider);
}

export class SyncService {
  constructor(private readonly registry: PlatformProviderRegistry = platformProviderRegistry) {}

  registerProvider(provider: PlatformSyncProvider): void {
    this.registry.registerProvider(provider);
  }

  getProvider(platform: Platform): PlatformSyncProvider {
    return this.registry.getProvider(platform);
  }

  async pushListing(
    listing: ListingWithProduct,
    images: Parameters<PlatformSyncProvider['pushListing']>[1],
  ): Promise<SyncResult> {
    return this.getProvider(this.platformForListing(listing)).pushListing(listing, images);
  }

  async pushListingById(listingId: string): Promise<SyncResult> {
    const { listing, images } = await resolveSyncListing(listingId);
    const provider = this.getProvider(this.platformForListing(listing));
    if (listing.listing.external_id) {
      return provider.updateListing(listing, images);
    }
    return provider.pushListing(listing, images);
  }

  async updateListing(
    listing: ListingWithProduct,
    images: Parameters<PlatformSyncProvider['updateListing']>[1],
  ): Promise<SyncResult> {
    return this.getProvider(this.platformForListing(listing)).updateListing(listing, images);
  }

  async pauseListing(listing: ListingWithProduct): Promise<SyncResult> {
    return this.getProvider(this.platformForListing(listing)).pauseListing(listing);
  }

  async deleteListing(listing: ListingWithProduct): Promise<SyncResult> {
    return this.getProvider(this.platformForListing(listing)).deleteListing(listing);
  }

  async pullOrders(platform: Platform, since?: Date): Promise<PullOrdersResult> {
    return this.getProvider(platform).pullOrders(since);
  }

  async pushAllPending(
    platform?: Platform,
    options: {
      shouldCancel?: () => boolean;
      onProgress?: (current: number, total: number, result: SyncResult) => void;
    } = {},
  ): Promise<BatchSyncResult> {
    const pending = await getPendingSyncListings(platform);
    const results: SyncResult[] = [];
    let cancelled = false;

    for (const [index, item] of pending.entries()) {
      if (options.shouldCancel?.()) {
        cancelled = true;
        break;
      }

      const result = await this.pushListingById(item.id);
      results.push(result);
      options.onProgress?.(index + 1, pending.length, result);
    }

    const succeeded = results.filter((result) => result.success).length;
    return {
      total: pending.length,
      succeeded,
      failed: results.length - succeeded,
      cancelled,
      results,
    };
  }

  async getDiff(listingId: string, platform?: Platform): Promise<SyncDiff> {
    const { detail, images } = await resolveSyncListing(listingId);
    const resolvedPlatform = platform ?? this.platformFromValue(detail.platform);
    if (detail.platform !== resolvedPlatform) {
      throw new Error(`Listing ist für ${detail.platform} konfiguriert, nicht für ${resolvedPlatform}.`);
    }

    const local = toLocalRemoteListingData(detail, images);
    const remoteIdentifier = this.remoteIdentifierForDiff(detail);
    const remote = remoteIdentifier
      ? await this.getProvider(resolvedPlatform).fetchRemoteListing(remoteIdentifier)
      : null;

    return buildSyncDiff({
      listingId,
      platform: resolvedPlatform,
      local,
      remote,
    });
  }

  async getSyncStatus(listingId: string): Promise<SyncStatusInfo> {
    const { detail } = await resolveSyncListing(listingId);
    return {
      listingId,
      platform: this.platformFromValue(detail.platform),
      status: detail.sync_status,
      lastSyncedAt: detail.last_synced_at,
      errorMessage: detail.sync_error_message,
    };
  }

  async getSyncLog(filters: SyncLogFilters = {}): Promise<SyncJob[]> {
    return getSyncJobs(filters);
  }

  private platformForListing(listing: ListingWithProduct): Platform {
    return this.platformFromValue(listing.listing.platform);
  }

  private platformFromValue(platform: string): Platform {
    if (platform !== 'etsy' && platform !== 'ebay') {
      throw new Error(`Platform Sync unterstützt diese Listing-Plattform nicht: ${platform}`);
    }
    return platform;
  }

  private remoteIdentifierForDiff(listing: ListingWithProduct['listing']): string | null {
    if (listing.platform === 'ebay') {
      const ebayMetadata = listing.platform_metadata?.ebay;
      if (ebayMetadata && typeof ebayMetadata === 'object' && !Array.isArray(ebayMetadata)) {
        const sku = (ebayMetadata as { sku?: unknown }).sku;
        if (typeof sku === 'string' && sku.trim()) return sku;
      }
    }
    return listing.external_id;
  }
}

export const syncService = new SyncService();
