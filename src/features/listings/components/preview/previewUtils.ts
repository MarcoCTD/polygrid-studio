import { PLATFORM_LIMITS } from '../../constants';
import type {
  CompletenessStatus,
  ListingDetail,
  ListingImageWithFile,
} from '../../listingsService';
import type { Platform } from '../../schemas';
import { resolveListingForPlatform } from '../../utils';

export function getCompletenessHints(
  listing: ListingDetail,
  platform: Platform,
  completeness: CompletenessStatus,
): string[] {
  const override = listing.overrides.find((entry) => entry.platform === platform) ?? null;
  const resolved = resolveListingForPlatform(listing, override, platform);
  const hints: string[] = [];

  if (!resolved.title.trim()) hints.push('Titel fehlt.');
  if (resolved.title.length > PLATFORM_LIMITS[platform].maxTitleLength) {
    hints.push('Titel überschreitet das Plattformlimit.');
  }
  if (!resolved.description.trim()) hints.push('Beschreibung fehlt.');
  if (listing.images.length === 0) hints.push('Mindestens ein Bild fehlt.');
  if (!override?.platform_category_id) hints.push('Plattform-Kategorie fehlt.');
  if (platform === 'etsy' && resolved.tags.length < 5) {
    hints.push('Etsy empfiehlt mindestens 5 Tags.');
  }

  if (hints.length === 0 && completeness === 'green') {
    return ['Alle Pflichtfelder sind für diese Vorschau plausibel gefüllt.'];
  }

  return hints;
}

export function isImageForPlatform(image: ListingImageWithFile, platform: Platform): boolean {
  return image.platforms === null || image.platforms.includes(platform);
}

export function truncateText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength).trim()}...` : value;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
}
