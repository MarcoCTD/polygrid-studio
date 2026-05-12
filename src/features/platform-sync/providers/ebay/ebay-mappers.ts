import { DEFAULTS, getSettingWithDefault } from '@/services/settings';
import { getDatabase } from '@/services/database';
import { createOrder } from '@/features/orders/services/ordersService';
import type { FileLink } from '@/features/files/types';
import type { Listing, ListingPlatformMetadata } from '@/features/listings/schemas';
import type { ListingWithProduct, RemoteListingData } from '../types';
import type {
  EbayFulfillmentPolicy,
  EbayInventoryItemPayload,
  EbayInventoryItemResponse,
  EbayOfferPayload,
  EbayOrder,
  EbayPaymentPolicy,
  EbayResolvedListing,
  EbayReturnPolicy,
} from './ebay-types';

interface EbayMetadata {
  listing_id?: string;
  offer_id?: string;
  sku?: string;
  image_urls?: string[];
  item_aspects?: Record<string, string[]>;
  last_remote_updated_at?: string;
}

function ebayMetadata(value: ListingPlatformMetadata | null): EbayMetadata {
  const source = value?.ebay;
  return source && typeof source === 'object' && !Array.isArray(source)
    ? (source as EbayMetadata)
    : {};
}

function stringFromSetting(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function requiredString(value: unknown, message: string): string {
  const parsed = stringFromSetting(value);
  if (!parsed) throw new Error(message);
  return parsed;
}

function sanitizeSku(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function firstColorName(input: ListingWithProduct): string | null {
  const first = input.product.color_variants?.[0];
  return first?.name ?? null;
}

function mergeAspects(
  base: Record<string, string[]>,
  overrides: Record<string, string[]> | undefined,
): Record<string, string[]> {
  return Object.entries(overrides ?? {}).reduce<Record<string, string[]>>(
    (result, [key, value]) => {
      const normalized = value.map((item) => item.trim()).filter(Boolean);
      if (key.trim() && normalized.length > 0) {
        result[key.trim()] = normalized;
      }
      return result;
    },
    { ...base },
  );
}

function moneyToNumber(value: { value: string; currency: string } | undefined): number {
  if (!value) return 0;
  const parsed = Number(value.value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function now(): string {
  return new Date().toISOString();
}

export async function resolveEbayListing(
  input: ListingWithProduct,
  imageUrls: string[],
): Promise<EbayResolvedListing> {
  const metadata = ebayMetadata(input.platformMetadata);
  const [
    marketplaceId,
    merchantLocationKey,
    fulfillmentPolicyId,
    paymentPolicyId,
    returnPolicyId,
    categoryId,
    companyName,
  ] = await Promise.all([
    getSettingWithDefault('ebay_marketplace_id', DEFAULTS.ebay_marketplace_id),
    getSettingWithDefault(
      'ebay_inventory_location_key',
      DEFAULTS.ebay_inventory_location_key,
    ),
    getSettingWithDefault(
      'ebay_default_fulfillment_policy_id',
      DEFAULTS.ebay_default_fulfillment_policy_id,
    ),
    getSettingWithDefault(
      'ebay_default_payment_policy_id',
      DEFAULTS.ebay_default_payment_policy_id,
    ),
    getSettingWithDefault(
      'ebay_default_return_policy_id',
      DEFAULTS.ebay_default_return_policy_id,
    ),
    getSettingWithDefault('ebay_default_category_id', DEFAULTS.ebay_default_category_id),
    getSettingWithDefault('company_name', DEFAULTS.company_name),
  ]);

  const price =
    input.listing.base_price || input.product.price_ebay || input.product.target_price || 0;
  if (price <= 0) {
    throw new Error('eBay-Push nicht möglich: Preis fehlt.');
  }

  const description =
    input.listing.master_long_description ??
    input.listing.master_short_description ??
    input.product.description_internal ??
    '';
  if (!description.trim()) {
    throw new Error('eBay-Push nicht möglich: Beschreibung fehlt.');
  }

  if (imageUrls.length === 0) {
    throw new Error('eBay-Push nicht möglich: mindestens ein Bild ist erforderlich.');
  }

  const sku = sanitizeSku(
    metadata.sku ??
      input.listing.sku_base ??
      input.product.short_name ??
      input.product.name ??
      input.listing.id,
  );
  if (!sku) {
    throw new Error('eBay-Push nicht möglich: SKU fehlt.');
  }

  const baseAspects: Record<string, string[]> = {
    Marke: [companyName],
    Material: [input.product.material_type],
  };
  const color = firstColorName(input);
  if (color) baseAspects.Farbe = [color];

  const aspects = mergeAspects(baseAspects, metadata.item_aspects);
  for (const field of ['Marke', 'Material']) {
    if (!aspects[field]?.[0]?.trim()) {
      throw new Error(`eBay-Push nicht möglich: Pflichtfeld "${field}" fehlt.`);
    }
  }

  return {
    sku,
    title: input.listing.master_title,
    description,
    price,
    quantity: input.listing.stock_quantity ?? 1,
    marketplaceId: requiredString(marketplaceId, 'eBay-Push nicht möglich: Marketplace fehlt.'),
    currency: input.listing.currency || 'EUR',
    categoryId: requiredString(categoryId, 'eBay-Push nicht möglich: Kategorie-ID fehlt.'),
    merchantLocationKey: requiredString(
      merchantLocationKey,
      'eBay-Push nicht möglich: Inventory Location fehlt.',
    ),
    fulfillmentPolicyId: requiredString(
      fulfillmentPolicyId,
      'eBay-Push nicht möglich: Fulfillment Policy fehlt.',
    ),
    paymentPolicyId: requiredString(
      paymentPolicyId,
      'eBay-Push nicht möglich: Payment Policy fehlt.',
    ),
    returnPolicyId: requiredString(
      returnPolicyId,
      'eBay-Push nicht möglich: Return Policy fehlt.',
    ),
    aspects,
  };
}

export function toInventoryItemPayload(
  resolved: EbayResolvedListing,
  imageUrls: string[],
): EbayInventoryItemPayload {
  return {
    availability: {
      shipToLocationAvailability: {
        quantity: resolved.quantity,
      },
    },
    condition: 'NEW',
    product: {
      title: resolved.title,
      description: resolved.description,
      imageUrls,
      aspects: resolved.aspects,
    },
  };
}

export function toOfferPayload(resolved: EbayResolvedListing): EbayOfferPayload {
  return {
    sku: resolved.sku,
    marketplaceId: resolved.marketplaceId,
    format: 'FIXED_PRICE',
    listingDescription: resolved.description,
    availableQuantity: resolved.quantity,
    pricingSummary: {
      price: {
        value: resolved.price.toFixed(2),
        currency: resolved.currency,
      },
    },
    listingPolicies: {
      fulfillmentPolicyId: resolved.fulfillmentPolicyId,
      paymentPolicyId: resolved.paymentPolicyId,
      returnPolicyId: resolved.returnPolicyId,
    },
    categoryId: resolved.categoryId,
    merchantLocationKey: resolved.merchantLocationKey,
  };
}

export function mergeEbayMetadata(
  current: ListingPlatformMetadata | null,
  update: EbayMetadata,
): Record<string, unknown> {
  return {
    ...(current ?? {}),
    ebay: {
      ...ebayMetadata(current),
      ...update,
    },
  };
}

export function ebayExternalId(listing: Listing): string | null {
  if (listing.external_id) return listing.external_id;
  const id = ebayMetadata(listing.platform_metadata).listing_id;
  return id ?? null;
}

export function ebayOfferId(listing: Listing): string | null {
  return ebayMetadata(listing.platform_metadata).offer_id ?? null;
}

export function ebaySku(listing: Listing): string | null {
  return ebayMetadata(listing.platform_metadata).sku ?? listing.sku_base ?? null;
}

export function ebayImageUrls(listing: Listing): string[] {
  return ebayMetadata(listing.platform_metadata).image_urls ?? [];
}

export function sortEbayImages(images: FileLink[]): FileLink[] {
  return images
    .filter((image) => image.file_type === 'image' || image.mime_type?.startsWith('image/'))
    .sort((a, b) => a.position - b.position)
    .slice(0, 12);
}

export function toEbayRemoteListingData(item: EbayInventoryItemResponse): RemoteListingData {
  return {
    title: item.product?.title ?? '',
    description: item.product?.description ?? '',
    price: 0,
    quantity: item.availability?.shipToLocationAvailability.quantity ?? 0,
    status: item.condition ?? '',
    images: item.product?.imageUrls ?? [],
    platformSpecific: item as unknown as Record<string, unknown>,
    lastUpdatedAt: now(),
  };
}

export function toEbayPlatformProfiles(
  fulfillmentPolicies: EbayFulfillmentPolicy[],
  paymentPolicies: EbayPaymentPolicy[],
  returnPolicies: EbayReturnPolicy[],
): Array<{ id: string; name: string; type: string }> {
  return [
    ...fulfillmentPolicies.map((policy) => ({
      id: policy.fulfillmentPolicyId,
      name: policy.name,
      type: 'fulfillment_policy',
    })),
    ...paymentPolicies.map((policy) => ({
      id: policy.paymentPolicyId,
      name: policy.name,
      type: 'payment_policy',
    })),
    ...returnPolicies.map((policy) => ({
      id: policy.returnPolicyId,
      name: policy.name,
      type: 'return_policy',
    })),
  ];
}

export async function importEbayOrder(order: EbayOrder): Promise<'imported' | 'skipped'> {
  const externalOrderId = order.orderId;
  const existing = await getDatabase().select<{ id: string }[]>(
    'SELECT id FROM orders WHERE external_order_id = $1 LIMIT 1',
    [externalOrderId],
  );
  if (existing.length > 0) return 'skipped';

  const firstLineItem = order.lineItems?.[0];
  const shipping =
    moneyToNumber(firstLineItem?.deliveryCost?.shippingCost) ||
    moneyToNumber(order.pricingSummary?.deliveryCost);
  const customerName =
    order.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo?.fullName ??
    order.buyer?.taxAddress?.fullName ??
    order.buyer?.username ??
    null;

  await createOrder({
    external_order_id: externalOrderId,
    customer_name: customerName,
    platform: 'ebay',
    product_id: null,
    variant: firstLineItem?.title ?? null,
    quantity: firstLineItem?.quantity ?? 1,
    sale_price: moneyToNumber(order.pricingSummary?.total) || moneyToNumber(firstLineItem?.total),
    shipping_revenue: shipping,
    order_date: (order.creationDate ?? new Date().toISOString()).slice(0, 10),
    notes: [
      `ebay_order_id:${externalOrderId}`,
      firstLineItem?.lineItemId ? `line_item_id:${firstLineItem.lineItemId}` : '',
      firstLineItem?.legacyItemId ? `legacy_item_id:${firstLineItem.legacyItemId}` : '',
      firstLineItem?.sku ? `sku:${firstLineItem.sku}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    status: order.orderFulfillmentStatus === 'FULFILLED' ? 'shipped' : 'paid',
    payment_status: order.orderPaymentStatus === 'PAID' ? 'paid' : 'pending',
    payment_received_date:
      order.orderPaymentStatus === 'PAID'
        ? (order.creationDate ?? new Date().toISOString()).slice(0, 10)
        : null,
    external_synced: true,
  });

  return 'imported';
}
