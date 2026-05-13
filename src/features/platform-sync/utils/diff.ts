import type { AIDiffField } from '@/features/ai-assistant/types';
import type { ListingDetail } from '@/features/listings/listingsService';
import type { FileLink } from '@/features/files/types';
import type { Platform, RemoteListingData, SyncDiff } from '../providers/types';

function valueOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

function numberValue(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function imageLabels(images: FileLink[]): string[] {
  return images.map((image) => image.display_name ?? image.file_path);
}

export function toLocalRemoteListingData(
  listing: ListingDetail,
  images: FileLink[],
): RemoteListingData {
  return {
    title: listing.master_title,
    description:
      listing.master_long_description ?? listing.master_short_description ?? '',
    price: listing.base_price,
    quantity: listing.stock_quantity ?? 0,
    status: listing.status,
    images: imageLabels(images),
    platformSpecific: {
      tags: listing.master_tags,
      currency: listing.currency,
      sku: listing.sku_base,
    },
    lastUpdatedAt: listing.updated_at,
  };
}

export function buildSyncDiff(params: {
  listingId: string;
  platform: Platform;
  local: RemoteListingData;
  remote: RemoteListingData | null;
}): SyncDiff {
  const { listingId, platform, local, remote } = params;
  const fields: AIDiffField[] = [
    {
      fieldName: 'title',
      fieldLabel: 'Titel',
      currentValue: valueOrNull(remote?.title),
      suggestedValue: local.title,
    },
    {
      fieldName: 'description',
      fieldLabel: 'Beschreibung',
      currentValue: valueOrNull(remote?.description),
      suggestedValue: local.description,
    },
    {
      fieldName: 'price',
      fieldLabel: 'Preis',
      currentValue: remote ? numberValue(remote.price) : null,
      suggestedValue: numberValue(local.price),
    },
    {
      fieldName: 'quantity',
      fieldLabel: 'Menge',
      currentValue: remote ? numberValue(remote.quantity) : null,
      suggestedValue: numberValue(local.quantity),
    },
    {
      fieldName: 'status',
      fieldLabel: 'Status',
      currentValue: valueOrNull(remote?.status),
      suggestedValue: local.status,
    },
    {
      fieldName: 'images',
      fieldLabel: 'Bilder',
      currentValue: remote?.images ?? null,
      suggestedValue: local.images,
    },
  ];

  return {
    listingId,
    platform,
    local,
    remote,
    fields,
    hasRemote: remote !== null,
  };
}
