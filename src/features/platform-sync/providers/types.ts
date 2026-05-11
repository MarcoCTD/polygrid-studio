import type { FileLink } from '@/features/files/types';
import type { Product } from '@/features/products/schema';
import type { Listing, ListingPlatformMetadata } from '@/features/listings/schemas';

export type Platform = 'etsy' | 'ebay';
export type SyncDirection = 'push' | 'pull';
export type SyncJobStatus = 'pending' | 'running' | 'success' | 'error' | 'retrying';
export type SyncOperation =
  | 'push_listing'
  | 'update_listing'
  | 'pause_listing'
  | 'delete_listing'
  | 'upload_image'
  | 'pull_orders'
  | 'load_policies'
  | 'token_refresh';

export interface OAuthResult {
  success: boolean;
  error?: string;
  shopName?: string;
  shopId?: string;
}

export interface TokenResult {
  success: boolean;
  error?: string;
  expiresAt?: string;
}

export interface ConnectionInfo {
  platform: Platform;
  connected: boolean;
  shopName: string;
  connectedSince: string;
  tokenExpiresAt: string;
}

export interface SyncResult {
  success: boolean;
  externalId?: string;
  error?: string;
  syncJobId: string;
}

export interface RemoteListingData {
  title: string;
  description: string;
  price: number;
  quantity: number;
  status: string;
  images: string[];
  platformSpecific: Record<string, unknown>;
  lastUpdatedAt: string;
}

export interface PullOrdersResult {
  imported: number;
  skipped: number;
  errors: Array<{ externalId: string; error: string }>;
  syncJobId: string;
}

export interface PlatformProfiles {
  platform: Platform;
  profiles: Array<{ id: string; name: string; type: string }>;
}

export interface ListingWithProduct {
  listing: Listing;
  product: Product;
  overrides: Record<string, unknown>;
  platformMetadata: ListingPlatformMetadata | null;
}

export interface PlatformResponse<T> {
  data: T;
  status: number;
  headers: Headers;
  syncJobId: string;
}

export interface PlatformSyncProvider {
  readonly platform: Platform;

  startOAuthFlow(): Promise<OAuthResult>;
  refreshToken(): Promise<TokenResult>;
  disconnect(): Promise<void>;
  isConnected(): Promise<boolean>;
  getConnectionInfo(): Promise<ConnectionInfo | null>;

  pushListing(listing: ListingWithProduct, images: FileLink[]): Promise<SyncResult>;
  updateListing(listing: ListingWithProduct, images: FileLink[]): Promise<SyncResult>;
  pauseListing(listing: ListingWithProduct): Promise<SyncResult>;
  deleteListing(listing: ListingWithProduct): Promise<SyncResult>;

  fetchRemoteListing(externalId: string): Promise<RemoteListingData | null>;
  pullOrders(since?: Date): Promise<PullOrdersResult>;
  loadProfiles(): Promise<PlatformProfiles>;
}
