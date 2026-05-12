import { DEFAULTS, getSettingWithDefault } from '@/services/settings';
import { updateListing } from '@/features/listings/listingsService';
import type { FileLink } from '@/features/files/types';
import { TokenManager } from '../../services/token-manager';
import { createSyncJob, completeSyncJob } from '../../services/sync-jobs-service';
import type {
  ConnectionInfo,
  ListingWithProduct,
  OAuthResult,
  PlatformProfiles,
  PlatformSyncProvider,
  PullOrdersResult,
  RemoteListingData,
  SyncResult,
  TokenResult,
} from '../types';
import {
  etsyRefreshHandler,
  getEtsyApiKey,
  loadEtsyShopInfo,
  startEtsyOAuthFlow,
} from './etsy-auth';
import { etsyApiRequest, etsyUploadListingImage } from './etsy-client';
import {
  importEtsyReceipt,
  listingIdFromMetadata,
  mergeEtsyMetadata,
  resolveEtsyListing,
  sortEtsyImages,
  toCreateListingPayload,
  toPlatformProfiles,
  toRemoteListingData,
  toUpdateListingPayload,
} from './etsy-mappers';
import type {
  EtsyListingImageResponse,
  EtsyListingResponse,
  EtsyReceiptsResponse,
  EtsyShippingProfilesResponse,
} from './etsy-types';

function now(): string {
  return new Date().toISOString();
}

function dateToUnix(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

export class EtsyProvider implements PlatformSyncProvider {
  readonly platform = 'etsy' as const;

  private readonly tokenManager = new TokenManager(etsyRefreshHandler);

  async startOAuthFlow(): Promise<OAuthResult> {
    return startEtsyOAuthFlow();
  }

  async refreshToken(): Promise<TokenResult> {
    try {
      await this.tokenManager.refreshToken('etsy');
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async disconnect(): Promise<void> {
    await this.tokenManager.clearTokens('etsy');
  }

  async isConnected(): Promise<boolean> {
    return this.tokenManager.hasValidToken('etsy');
  }

  async getConnectionInfo(): Promise<ConnectionInfo | null> {
    if (!(await this.isConnected())) return null;
    const accessToken = await this.tokenManager.getValidToken('etsy');
    const apiKey = await getEtsyApiKey();
    const shop = await loadEtsyShopInfo(accessToken, apiKey);

    return {
      platform: 'etsy',
      connected: true,
      shopName: shop.shop_name,
      connectedSince: '',
      tokenExpiresAt: '',
    };
  }

  async pushListing(listing: ListingWithProduct, images: FileLink[]): Promise<SyncResult> {
    return this.runListingOperation('push_listing', listing, async (syncJobId) => {
      this.ensurePushable(listing);
      const accessToken = await this.tokenManager.ensureFreshToken('etsy');
      const apiKey = await getEtsyApiKey();
      const shopId = await this.shopId();
      const resolved = await resolveEtsyListing(listing);
      const draft = await etsyApiRequest<EtsyListingResponse>({
        method: 'POST',
        path: `/application/shops/${shopId}/listings`,
        accessToken,
        apiKey,
        body: toCreateListingPayload(resolved),
        contentType: 'application/x-www-form-urlencoded',
      });

      const listingId = String(draft.body.listing_id);
      const uploadedImageIds = await this.uploadImages(
        accessToken,
        apiKey,
        shopId,
        listingId,
        images,
      );

      await etsyApiRequest<EtsyListingResponse>({
        method: 'PUT',
        path: `/application/shops/${shopId}/listings/${listingId}`,
        accessToken,
        apiKey,
        body: { state: 'active' },
        contentType: 'application/x-www-form-urlencoded',
      });

      await this.markListingSynced(listing, listingId, {
        listing_id: draft.body.listing_id,
        state: 'active',
        image_ids: uploadedImageIds,
        taxonomy_id: resolved.taxonomyId,
        shipping_profile_id: resolved.shippingProfileId,
        return_policy_id: resolved.returnPolicyId,
        who_made: resolved.whoMade,
        when_made: resolved.whenMade,
        last_remote_updated_at: now(),
      });

      return { success: true, externalId: listingId, syncJobId };
    });
  }

  async updateListing(listing: ListingWithProduct, images: FileLink[]): Promise<SyncResult> {
    return this.runListingOperation('update_listing', listing, async (syncJobId) => {
      const listingId = this.requiredExternalId(listing);
      const accessToken = await this.tokenManager.ensureFreshToken('etsy');
      const apiKey = await getEtsyApiKey();
      const shopId = await this.shopId();
      const resolved = await resolveEtsyListing(listing);

      await etsyApiRequest<EtsyListingResponse>({
        method: 'PUT',
        path: `/application/shops/${shopId}/listings/${listingId}`,
        accessToken,
        apiKey,
        body: toUpdateListingPayload(
          resolved,
          listing.listing.status === 'paused' ? 'inactive' : 'active',
        ),
        contentType: 'application/x-www-form-urlencoded',
      });

      const uploadedImageIds = await this.uploadImages(
        accessToken,
        apiKey,
        shopId,
        listingId,
        images,
      );

      await this.markListingSynced(listing, listingId, {
        state: listing.listing.status === 'paused' ? 'inactive' : 'active',
        image_ids: uploadedImageIds,
        last_remote_updated_at: now(),
      });

      return { success: true, externalId: listingId, syncJobId };
    });
  }

  async pauseListing(listing: ListingWithProduct): Promise<SyncResult> {
    return this.runListingOperation('pause_listing', listing, async (syncJobId) => {
      const listingId = this.requiredExternalId(listing);
      await this.setRemoteState(listingId, 'inactive');
      await this.markListingSynced(listing, listingId, {
        state: 'inactive',
        last_remote_updated_at: now(),
      });
      return { success: true, externalId: listingId, syncJobId };
    });
  }

  async deleteListing(listing: ListingWithProduct): Promise<SyncResult> {
    return this.runListingOperation('delete_listing', listing, async (syncJobId) => {
      const listingId = this.requiredExternalId(listing);
      const accessToken = await this.tokenManager.ensureFreshToken('etsy');
      const apiKey = await getEtsyApiKey();
      await etsyApiRequest<null>({
        method: 'DELETE',
        path: `/application/listings/${listingId}`,
        accessToken,
        apiKey,
      });
      await updateListing(listing.listing.id, {
        sync_status: 'not_synced',
        sync_error_message: null,
        last_synced_at: null,
        external_id: null,
        platform_metadata: mergeEtsyMetadata(listing.platformMetadata, {
          state: 'deleted',
          last_remote_updated_at: now(),
        }),
      });
      return { success: true, externalId: listingId, syncJobId };
    });
  }

  async fetchRemoteListing(externalId: string): Promise<RemoteListingData | null> {
    const accessToken = await this.tokenManager.ensureFreshToken('etsy');
    const apiKey = await getEtsyApiKey();
    const response = await etsyApiRequest<EtsyListingResponse>({
      method: 'GET',
      path: `/application/listings/${externalId}`,
      accessToken,
      apiKey,
    });
    return toRemoteListingData(response.body);
  }

  async pullOrders(since?: Date): Promise<PullOrdersResult> {
    const syncJobId = await createSyncJob({
      platform: 'etsy',
      operation: 'pull_orders',
      direction: 'pull',
    });

    try {
      const accessToken = await this.tokenManager.ensureFreshToken('etsy');
      const apiKey = await getEtsyApiKey();
      const shopId = await this.shopId();
      const response = await etsyApiRequest<EtsyReceiptsResponse>({
        method: 'GET',
        path: `/application/shops/${shopId}/receipts`,
        accessToken,
        apiKey,
        query: {
          was_paid: true,
          min_created: since ? dateToUnix(since) : undefined,
          limit: 25,
          offset: 0,
        },
      });

      let imported = 0;
      let skipped = 0;
      const errors: Array<{ externalId: string; error: string }> = [];

      for (const receipt of response.body.results) {
        try {
          const result = await importEtsyReceipt(receipt);
          if (result === 'imported') imported++;
          else skipped++;
        } catch (error) {
          errors.push({
            externalId: String(receipt.receipt_id),
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      await completeSyncJob(syncJobId, {
        status: errors.length > 0 ? 'error' : 'success',
        response_payload: { imported, skipped, errors },
      });

      return { imported, skipped, errors, syncJobId };
    } catch (error) {
      await completeSyncJob(syncJobId, {
        status: 'error',
        error_message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async loadProfiles(): Promise<PlatformProfiles> {
    const accessToken = await this.tokenManager.ensureFreshToken('etsy');
    const apiKey = await getEtsyApiKey();
    const shopId = await this.shopId();
    const response = await etsyApiRequest<EtsyShippingProfilesResponse>({
      method: 'GET',
      path: `/application/shops/${shopId}/shipping-profiles`,
      accessToken,
      apiKey,
    });

    return {
      platform: 'etsy',
      profiles: toPlatformProfiles(response.body.results),
    };
  }

  private async runListingOperation(
    operation: 'push_listing' | 'update_listing' | 'pause_listing' | 'delete_listing',
    listing: ListingWithProduct,
    handler: (syncJobId: string) => Promise<SyncResult>,
  ): Promise<SyncResult> {
    const syncJobId = await createSyncJob({
      platform: 'etsy',
      operation,
      listing_id: listing.listing.id,
      direction: 'push',
    });

    try {
      const result = await handler(syncJobId);
      await completeSyncJob(syncJobId, {
        status: result.success ? 'success' : 'error',
        response_payload: result,
        error_message: result.error ?? null,
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await completeSyncJob(syncJobId, { status: 'error', error_message: message });
      await updateListing(listing.listing.id, {
        sync_status: 'error',
        sync_error_message: message,
      });
      return { success: false, error: message, syncJobId };
    }
  }

  private ensurePushable(listing: ListingWithProduct): void {
    if (listing.listing.status === 'draft') {
      throw new Error("Listing muss mindestens den Status 'online' haben.");
    }
    if (listing.listing.platform !== 'etsy') {
      throw new Error('Dieses Listing ist nicht für Etsy konfiguriert.');
    }
  }

  private requiredExternalId(listing: ListingWithProduct): string {
    const externalId = listingIdFromMetadata(listing.listing);
    if (!externalId) {
      throw new Error('Listing wurde noch nicht zu Etsy synchronisiert.');
    }
    return externalId;
  }

  private async shopId(): Promise<string> {
    const shopId = await getSettingWithDefault('etsy_shop_id', DEFAULTS.etsy_shop_id);
    if (!shopId.trim()) {
      throw new Error('Etsy Shop-ID fehlt. Bitte OAuth-Verbindung herstellen.');
    }
    return shopId;
  }

  private async setRemoteState(listingId: string, state: 'active' | 'inactive'): Promise<void> {
    const accessToken = await this.tokenManager.ensureFreshToken('etsy');
    const apiKey = await getEtsyApiKey();
    const shopId = await this.shopId();
    await etsyApiRequest<EtsyListingResponse>({
      method: 'PUT',
      path: `/application/shops/${shopId}/listings/${listingId}`,
      accessToken,
      apiKey,
      body: { state },
      contentType: 'application/x-www-form-urlencoded',
    });
  }

  private async uploadImages(
    accessToken: string,
    apiKey: string,
    shopId: string,
    listingId: string,
    images: FileLink[],
  ): Promise<number[]> {
    const imageIds: number[] = [];
    const sortedImages = sortEtsyImages(images);

    for (const [index, image] of sortedImages.entries()) {
      const uploaded = await etsyUploadListingImage<EtsyListingImageResponse>({
        path: image.file_path,
        accessToken,
        apiKey,
        shopId,
        listingId,
        rank: index + 1,
      });
      imageIds.push(uploaded.body.listing_image_id);
    }

    return imageIds;
  }

  private async markListingSynced(
    listing: ListingWithProduct,
    externalId: string,
    metadata: Parameters<typeof mergeEtsyMetadata>[1],
  ): Promise<void> {
    await updateListing(listing.listing.id, {
      external_id: externalId,
      sync_status: 'synced',
      sync_error_message: null,
      last_synced_at: now(),
      platform_metadata: mergeEtsyMetadata(listing.platformMetadata, metadata),
    });
  }

}

export const etsyProvider = new EtsyProvider();
