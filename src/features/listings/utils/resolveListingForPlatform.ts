import type { ListingDetail } from '../listingsService';
import type { ListingPlatformOverride, Platform } from '../schemas';

export interface ResolvedListingForPlatform {
  platform: Platform;
  title: string;
  shortDescription: string | null;
  longDescription: string | null;
  description: string;
  tags: string[];
  price: number;
}

export function resolveListingForPlatform(
  listing: ListingDetail,
  override: ListingPlatformOverride | null,
  platform: Platform,
): ResolvedListingForPlatform {
  const shortDescription = override?.short_description_override ?? listing.master_short_description;
  const longDescription = override?.long_description_override ?? listing.master_long_description;

  return {
    platform,
    title: override?.title_override ?? listing.master_title,
    shortDescription,
    longDescription,
    description: longDescription ?? shortDescription ?? '',
    tags: override?.tags_override ?? listing.master_tags,
    price: override?.price_override ?? listing.base_price,
  };
}
