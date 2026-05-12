import { updateListing } from '@/features/listings/listingsService';
import { DEFAULTS, getSettingWithDefault } from '@/services/settings';
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
  ebayRefreshHandler,
  getEbayClientId,
  getEbayClientSecret,
  startEbayOAuthFlow,
} from './ebay-auth';
import { ebayApiRequest, ebayUploadSiteHostedPicture } from './ebay-client';
import {
  ebayExternalId,
  ebayImageUrls,
  ebayOfferId,
  toEbayPlatformProfiles,
  toEbayRemoteListingData,
  ebaySku,
  importEbayOrder,
  mergeEbayMetadata,
  resolveEbayListing,
  sortEbayImages,
  toInventoryItemPayload,
  toOfferPayload,
} from './ebay-mappers';
import type {
  EbayFulfillmentPolicy,
  EbayInventoryItemResponse,
  EbayOfferResponse,
  EbayOrdersResponse,
  EbayPaymentPolicy,
  EbayPolicyResponse,
  EbayPublishOfferResponse,
  EbayReturnPolicy,
} from './ebay-types';

function now(): string {
  return new Date().toISOString();
}

function fulfillmentFilter(since?: Date): string {
  const start = (since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).toISOString();
  return `creationdate:[${start}..] AND orderfulfillmentstatus:{NOT_STARTED|IN_PROGRESS}`;
}

export class EbayProvider implements PlatformSyncProvider {
  readonly platform = 'ebay' as const;

  private readonly tokenManager = new TokenManager(ebayRefreshHandler);

  async startOAuthFlow(): Promise<OAuthResult> {
    return startEbayOAuthFlow();
  }

  async refreshToken(): Promise<TokenResult> {
    try {
      await this.tokenManager.refreshToken('ebay');
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async disconnect(): Promise<void> {
    await this.tokenManager.clearTokens('ebay');
  }

  async isConnected(): Promise<boolean> {
    return this.tokenManager.hasValidToken('ebay');
  }

  async getConnectionInfo(): Promise<ConnectionInfo | null> {
    if (!(await this.isConnected())) return null;
    return {
      platform: 'ebay',
      connected: true,
      shopName: 'eBay',
      connectedSince: '',
      tokenExpiresAt: '',
    };
  }

  async pushListing(listing: ListingWithProduct, images: FileLink[]): Promise<SyncResult> {
    return this.runListingOperation('push_listing', listing, async (syncJobId) => {
      this.ensurePushable(listing);
      const accessToken = await this.tokenManager.ensureFreshToken('ebay');
      const imageUrls = await this.uploadImages(accessToken, listing, images);
      const resolved = await resolveEbayListing(listing, imageUrls);

      await ebayApiRequest<EbayInventoryItemResponse>({
        method: 'PUT',
        path: `/sell/inventory/v1/inventory_item/${encodeURIComponent(resolved.sku)}`,
        accessToken,
        body: toInventoryItemPayload(resolved, imageUrls),
      });

      const offer = await ebayApiRequest<EbayOfferResponse>({
        method: 'POST',
        path: '/sell/inventory/v1/offer',
        accessToken,
        body: toOfferPayload(resolved),
      });

      const published = await ebayApiRequest<EbayPublishOfferResponse>({
        method: 'POST',
        path: `/sell/inventory/v1/offer/${offer.body.offerId}/publish`,
        accessToken,
      });

      await this.markListingSynced(listing, published.body.listingId, {
        listing_id: published.body.listingId,
        offer_id: offer.body.offerId,
        sku: resolved.sku,
        image_urls: imageUrls,
        item_aspects: resolved.aspects,
        last_remote_updated_at: now(),
      });

      return { success: true, externalId: published.body.listingId, syncJobId };
    });
  }

  async updateListing(listing: ListingWithProduct, images: FileLink[]): Promise<SyncResult> {
    return this.runListingOperation('update_listing', listing, async (syncJobId) => {
      const offerId = this.requiredOfferId(listing);
      const accessToken = await this.tokenManager.ensureFreshToken('ebay');
      const imageUrls = await this.uploadImages(accessToken, listing, images);
      const resolved = await resolveEbayListing(listing, imageUrls);

      await ebayApiRequest<EbayInventoryItemResponse>({
        method: 'PUT',
        path: `/sell/inventory/v1/inventory_item/${encodeURIComponent(resolved.sku)}`,
        accessToken,
        body: toInventoryItemPayload(resolved, imageUrls),
      });

      await ebayApiRequest<EbayOfferResponse>({
        method: 'PUT',
        path: `/sell/inventory/v1/offer/${offerId}`,
        accessToken,
        body: toOfferPayload(resolved),
      });

      await this.markListingSynced(listing, this.requiredExternalId(listing), {
        offer_id: offerId,
        sku: resolved.sku,
        image_urls: imageUrls,
        item_aspects: resolved.aspects,
        last_remote_updated_at: now(),
      });

      return { success: true, externalId: this.requiredExternalId(listing), syncJobId };
    });
  }

  async pauseListing(listing: ListingWithProduct): Promise<SyncResult> {
    return this.runListingOperation('pause_listing', listing, async (syncJobId) => {
      const offerId = this.requiredOfferId(listing);
      const accessToken = await this.tokenManager.ensureFreshToken('ebay');
      await ebayApiRequest<null>({
        method: 'POST',
        path: `/sell/inventory/v1/offer/${offerId}/withdraw`,
        accessToken,
      });
      await this.markListingSynced(listing, this.requiredExternalId(listing), {
        offer_id: offerId,
        last_remote_updated_at: now(),
      });
      return { success: true, externalId: this.requiredExternalId(listing), syncJobId };
    });
  }

  async deleteListing(listing: ListingWithProduct): Promise<SyncResult> {
    return this.runListingOperation('delete_listing', listing, async (syncJobId) => {
      const offerId = this.requiredOfferId(listing);
      const sku = this.requiredSku(listing);
      const externalId = this.requiredExternalId(listing);
      const accessToken = await this.tokenManager.ensureFreshToken('ebay');

      await ebayApiRequest<null>({
        method: 'DELETE',
        path: `/sell/inventory/v1/offer/${offerId}`,
        accessToken,
      });
      await ebayApiRequest<null>({
        method: 'DELETE',
        path: `/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`,
        accessToken,
      });

      await updateListing(listing.listing.id, {
        sync_status: 'not_synced',
        sync_error_message: null,
        last_synced_at: null,
        external_id: null,
        platform_metadata: mergeEbayMetadata(listing.platformMetadata, {
          listing_id: externalId,
          offer_id: offerId,
          sku,
          last_remote_updated_at: now(),
        }),
      });
      return { success: true, externalId, syncJobId };
    });
  }

  async fetchRemoteListing(externalId: string): Promise<RemoteListingData | null> {
    const accessToken = await this.tokenManager.ensureFreshToken('ebay');
    const response = await ebayApiRequest<EbayInventoryItemResponse>({
      method: 'GET',
      path: `/sell/inventory/v1/inventory_item/${encodeURIComponent(externalId)}`,
      accessToken,
    });
    return toEbayRemoteListingData(response.body);
  }

  async pullOrders(since?: Date): Promise<PullOrdersResult> {
    const syncJobId = await createSyncJob({
      platform: 'ebay',
      operation: 'pull_orders',
      direction: 'pull',
    });

    try {
      const accessToken = await this.tokenManager.ensureFreshToken('ebay');
      const response = await ebayApiRequest<EbayOrdersResponse>({
        method: 'GET',
        path: '/sell/fulfillment/v1/order',
        accessToken,
        query: {
          filter: fulfillmentFilter(since),
          limit: 50,
          offset: 0,
        },
      });

      let imported = 0;
      let skipped = 0;
      const errors: Array<{ externalId: string; error: string }> = [];

      for (const order of response.body.orders) {
        try {
          const result = await importEbayOrder(order);
          if (result === 'imported') imported++;
          else skipped++;
        } catch (error) {
          errors.push({
            externalId: order.orderId,
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
    const accessToken = await this.tokenManager.ensureFreshToken('ebay');
    const marketplaceId = await getSettingWithDefault(
      'ebay_marketplace_id',
      DEFAULTS.ebay_marketplace_id,
    );
    const [fulfillment, payment, returns] = await Promise.all([
      ebayApiRequest<EbayPolicyResponse<EbayFulfillmentPolicy>>({
        method: 'GET',
        path: '/sell/account/v1/fulfillment_policy',
        accessToken,
        query: { marketplace_id: marketplaceId },
      }),
      ebayApiRequest<EbayPolicyResponse<EbayPaymentPolicy>>({
        method: 'GET',
        path: '/sell/account/v1/payment_policy',
        accessToken,
        query: { marketplace_id: marketplaceId },
      }),
      ebayApiRequest<EbayPolicyResponse<EbayReturnPolicy>>({
        method: 'GET',
        path: '/sell/account/v1/return_policy',
        accessToken,
        query: { marketplace_id: marketplaceId },
      }),
    ]);

    return {
      platform: 'ebay',
      profiles: toEbayPlatformProfiles(
        fulfillment.body.fulfillmentPolicies ?? [],
        payment.body.paymentPolicies ?? [],
        returns.body.returnPolicies ?? [],
      ),
    };
  }

  private async runListingOperation(
    operation: 'push_listing' | 'update_listing' | 'pause_listing' | 'delete_listing',
    listing: ListingWithProduct,
    handler: (syncJobId: string) => Promise<SyncResult>,
  ): Promise<SyncResult> {
    const syncJobId = await createSyncJob({
      platform: 'ebay',
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
    if (listing.listing.platform !== 'ebay') {
      throw new Error('Dieses Listing ist nicht für eBay konfiguriert.');
    }
  }

  private requiredExternalId(listing: ListingWithProduct): string {
    const externalId = ebayExternalId(listing.listing);
    if (!externalId) {
      throw new Error('Listing wurde noch nicht zu eBay synchronisiert.');
    }
    return externalId;
  }

  private requiredOfferId(listing: ListingWithProduct): string {
    const offerId = ebayOfferId(listing.listing);
    if (!offerId) {
      throw new Error('eBay Offer-ID fehlt. Listing wurde noch nicht vollständig synchronisiert.');
    }
    return offerId;
  }

  private requiredSku(listing: ListingWithProduct): string {
    const sku = ebaySku(listing.listing);
    if (!sku) {
      throw new Error('eBay SKU fehlt. Listing wurde noch nicht vollständig synchronisiert.');
    }
    return sku;
  }

  private async uploadImages(
    accessToken: string,
    listing: ListingWithProduct,
    images: FileLink[],
  ): Promise<string[]> {
    const sortedImages = sortEbayImages(images);
    if (sortedImages.length === 0) {
      const existing = ebayImageUrls(listing.listing);
      if (existing.length > 0) return existing;
    }

    const [clientId, clientSecret] = await Promise.all([
      getEbayClientId(),
      getEbayClientSecret(),
    ]);
    const imageUrls: string[] = [];

    for (const [index, image] of sortedImages.entries()) {
      const uploaded = await ebayUploadSiteHostedPicture({
        path: image.file_path,
        accessToken,
        clientId,
        clientSecret,
        pictureName: `${listing.listing.master_title}-${index + 1}`,
      });
      imageUrls.push(uploaded.body.fullUrl);
    }

    return imageUrls;
  }

  private async markListingSynced(
    listing: ListingWithProduct,
    externalId: string,
    metadata: Parameters<typeof mergeEbayMetadata>[1],
  ): Promise<void> {
    await updateListing(listing.listing.id, {
      external_id: externalId,
      sync_status: 'synced',
      sync_error_message: null,
      last_synced_at: now(),
      platform_metadata: mergeEbayMetadata(listing.platformMetadata, metadata),
    });
  }
}

export const ebayProvider = new EbayProvider();
