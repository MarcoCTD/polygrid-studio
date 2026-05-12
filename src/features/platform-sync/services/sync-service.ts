import type {
  Platform,
  PlatformSyncProvider,
  PullOrdersResult,
  SyncResult,
  ListingWithProduct,
} from '../providers/types';
import { platformProviderRegistry, type PlatformProviderRegistry } from '../providers/registry';
import { etsyProvider } from '../providers/etsy';

if (!platformProviderRegistry.hasProvider('etsy')) {
  platformProviderRegistry.registerProvider(etsyProvider);
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

  private platformForListing(listing: ListingWithProduct): Platform {
    const { platform } = listing.listing;
    if (platform !== 'etsy' && platform !== 'ebay') {
      throw new Error(`Platform Sync unterstützt diese Listing-Plattform nicht: ${platform}`);
    }
    return platform;
  }
}

export const syncService = new SyncService();
