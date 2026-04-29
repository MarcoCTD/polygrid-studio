import type { ListingImageWithFile } from '../../listingsService';
import type { Platform } from '../../schemas';

export function isImageForPlatform(image: ListingImageWithFile, platform: Platform): boolean {
  return image.platforms === null || image.platforms.includes(platform);
}

export function truncateText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength).trim()}...` : value;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
}
