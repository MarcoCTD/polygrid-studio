import { DEFAULTS, getSettingWithDefault } from '@/services/settings';
import { getDatabase } from '@/services/database';
import type { FileLink } from '@/features/files/types';
import { createOrder } from '@/features/orders/services/ordersService';
import type { Listing, ListingPlatformMetadata } from '@/features/listings/schemas';
import type { ListingWithProduct, RemoteListingData } from '../types';
import type {
  EtsyCreateListingPayload,
  EtsyListingResponse,
  EtsyReceipt,
  EtsyShippingProfile,
  EtsyUpdateListingPayload,
} from './etsy-types';

interface EtsyMetadata {
  listing_id?: number;
  state?: string;
  shop_section_id?: number | null;
  shipping_profile_id?: number | string | null;
  return_policy_id?: number | string | null;
  taxonomy_id?: number | string | null;
  image_ids?: number[];
  who_made?: string;
  when_made?: string;
  last_remote_updated_at?: string;
}

export interface EtsyResolvedListing {
  title: string;
  description: string;
  price: number;
  quantity: number;
  tags: string[];
  taxonomyId: number;
  shippingProfileId: number;
  returnPolicyId: number | null;
  whoMade: string;
  whenMade: string;
}

function etsyMetadata(value: ListingPlatformMetadata | null): EtsyMetadata {
  const source = value?.etsy;
  return source && typeof source === 'object' && !Array.isArray(source)
    ? (source as EtsyMetadata)
    : {};
}

function numberFromSetting(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function requiredNumber(value: unknown, message: string): number {
  const parsed = numberFromSetting(value);
  if (parsed === null) throw new Error(message);
  return parsed;
}

function moneyFromEtsy(value: { amount: number; divisor: number } | undefined): number {
  if (!value || value.divisor === 0) return 0;
  return Number((value.amount / value.divisor).toFixed(2));
}

function unixToIso(timestamp: number | undefined): string {
  if (!timestamp) return new Date().toISOString();
  return new Date(timestamp * 1000).toISOString();
}

export async function resolveEtsyListing(input: ListingWithProduct): Promise<EtsyResolvedListing> {
  const metadata = etsyMetadata(input.platformMetadata);
  const [
    defaultTaxonomyId,
    defaultShippingProfileId,
    defaultReturnPolicyId,
    whoMade,
    whenMade,
  ] = await Promise.all([
    getSettingWithDefault('etsy_default_taxonomy_id', DEFAULTS.etsy_default_taxonomy_id),
    getSettingWithDefault(
      'etsy_default_shipping_profile_id',
      DEFAULTS.etsy_default_shipping_profile_id,
    ),
    getSettingWithDefault('etsy_default_return_policy_id', DEFAULTS.etsy_default_return_policy_id),
    getSettingWithDefault('etsy_who_made', DEFAULTS.etsy_who_made),
    getSettingWithDefault('etsy_when_made', DEFAULTS.etsy_when_made),
  ]);

  const price = input.listing.base_price || input.product.price_etsy || input.product.target_price;
  if (!price || price <= 0) {
    throw new Error('Etsy-Push nicht möglich: Preis fehlt.');
  }

  const description =
    input.listing.master_long_description ??
    input.listing.master_short_description ??
    input.product.description_internal ??
    '';
  if (!description.trim()) {
    throw new Error('Etsy-Push nicht möglich: Beschreibung fehlt.');
  }

  return {
    title: input.listing.master_title,
    description,
    price,
    quantity: input.listing.stock_quantity ?? 999,
    tags: input.listing.master_tags.slice(0, 13),
    taxonomyId: requiredNumber(
      metadata.taxonomy_id ?? defaultTaxonomyId,
      'Etsy-Push nicht möglich: Taxonomy-ID fehlt.',
    ),
    shippingProfileId: requiredNumber(
      metadata.shipping_profile_id ?? defaultShippingProfileId,
      'Etsy-Push nicht möglich: Shipping Profile fehlt.',
    ),
    returnPolicyId: numberFromSetting(metadata.return_policy_id ?? defaultReturnPolicyId),
    whoMade: metadata.who_made ?? whoMade,
    whenMade: metadata.when_made ?? whenMade,
  };
}

export function toCreateListingPayload(resolved: EtsyResolvedListing): EtsyCreateListingPayload {
  return {
    title: resolved.title,
    description: resolved.description,
    price: resolved.price.toFixed(2),
    quantity: resolved.quantity,
    taxonomy_id: resolved.taxonomyId,
    who_made: resolved.whoMade,
    when_made: resolved.whenMade,
    is_supply: false,
    shipping_profile_id: resolved.shippingProfileId,
    ...(resolved.returnPolicyId ? { return_policy_id: resolved.returnPolicyId } : {}),
    tags: resolved.tags,
  };
}

export function toUpdateListingPayload(
  resolved: EtsyResolvedListing,
  state?: 'active' | 'inactive',
): EtsyUpdateListingPayload {
  return {
    ...toCreateListingPayload(resolved),
    ...(state ? { state } : {}),
  };
}

export function mergeEtsyMetadata(
  current: ListingPlatformMetadata | null,
  update: EtsyMetadata,
): Record<string, unknown> {
  return {
    ...(current ?? {}),
    etsy: {
      ...etsyMetadata(current),
      ...update,
    },
  };
}

export function listingIdFromMetadata(listing: Listing): string | null {
  if (listing.external_id) return listing.external_id;
  const id = etsyMetadata(listing.platform_metadata).listing_id;
  return id === undefined ? null : String(id);
}

export function sortEtsyImages(images: FileLink[]): FileLink[] {
  return images
    .filter((image) => image.file_type === 'image' || image.mime_type?.startsWith('image/'))
    .sort((a, b) => a.position - b.position)
    .slice(0, 10);
}

export function toRemoteListingData(listing: EtsyListingResponse): RemoteListingData {
  return {
    title: listing.title ?? '',
    description: listing.description ?? '',
    price: moneyFromEtsy(listing.price),
    quantity: listing.quantity ?? 0,
    status: listing.state,
    images: [],
    platformSpecific: listing as unknown as Record<string, unknown>,
    lastUpdatedAt: unixToIso(listing.updated_timestamp),
  };
}

export function toPlatformProfiles(profiles: EtsyShippingProfile[]): Array<{
  id: string;
  name: string;
  type: string;
}> {
  return profiles.map((profile) => ({
    id: String(profile.shipping_profile_id),
    name: profile.title,
    type: 'shipping_profile',
  }));
}

export async function importEtsyReceipt(receipt: EtsyReceipt): Promise<'imported' | 'skipped'> {
  const externalOrderId = String(receipt.receipt_id);
  const existing = await getDatabase().select<{ id: string }[]>(
    'SELECT id FROM orders WHERE external_order_id = $1 LIMIT 1',
    [externalOrderId],
  );
  if (existing.length > 0) return 'skipped';

  const firstTransaction = receipt.transactions?.[0];

  await createOrder({
    external_order_id: externalOrderId,
    customer_name: receipt.name ?? null,
    platform: 'etsy',
    product_id: null,
    variant: firstTransaction?.title ?? null,
    quantity: firstTransaction?.quantity ?? 1,
    sale_price: moneyFromEtsy(receipt.grandtotal),
    shipping_revenue: moneyFromEtsy(firstTransaction?.shipping_cost),
    order_date: unixToIso(receipt.create_timestamp).slice(0, 10),
    notes: [
      `receipt_id:${externalOrderId}`,
      receipt.buyer_email ? `buyer_email:${receipt.buyer_email}` : '',
      receipt.formatted_address ? `shipping_address:${receipt.formatted_address}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    status: receipt.status === 'completed' ? 'shipped' : 'paid',
    payment_status: 'paid',
    payment_received_date: unixToIso(receipt.create_timestamp).slice(0, 10),
    external_synced: true,
  });

  return 'imported';
}
