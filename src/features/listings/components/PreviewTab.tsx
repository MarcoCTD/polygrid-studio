import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PLATFORM_LABELS, PLATFORMS } from '../constants';
import {
  getListingImages,
  type ListingDetail,
  type ListingImageWithFile,
} from '../listingsService';
import { EbayPreview, EtsyPreview, KleinanzeigenPreview } from './preview';

interface PreviewTabProps {
  listing: ListingDetail;
}

export function PreviewTab({ listing }: PreviewTabProps) {
  const [images, setImages] = useState<ListingImageWithFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const activePlatforms = PLATFORMS.filter((platform) => {
    const override = listing.overrides.find((entry) => entry.platform === platform);
    return override?.is_active ?? false;
  });

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      setIsLoading(true);
      getListingImages(listing.id)
        .then((items) => {
          if (!cancelled) setImages(items);
        })
        .catch((err) => {
          if (!cancelled) {
            toast.error(
              err instanceof Error ? err.message : 'Vorschaubilder konnten nicht geladen werden',
            );
          }
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [listing.id]);

  return (
    <Tabs defaultValue="etsy" className="space-y-5">
      {activePlatforms.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Alle Plattformen sind aktuell deaktiviert. Die Vorschau zeigt weiterhin die aufgelösten
          Master-Daten, damit Inhalte vor dem Aktivieren geprüft werden können.
        </div>
      )}
      {activePlatforms.length > 0 && activePlatforms.length < PLATFORMS.length && (
        <div className="rounded-lg border border-border-subtle bg-bg-secondary px-4 py-3 text-sm text-text-secondary">
          Aktive Plattformen:{' '}
          {activePlatforms.map((platform) => PLATFORM_LABELS[platform]).join(', ')}
        </div>
      )}

      <TabsList>
        <TabsTrigger value="etsy">Etsy-Vorschau</TabsTrigger>
        <TabsTrigger value="ebay">eBay-Vorschau</TabsTrigger>
        <TabsTrigger value="kleinanzeigen">Kleinanzeigen-Vorschau</TabsTrigger>
      </TabsList>

      <TabsContent value="etsy">
        <EtsyPreview listing={listing} images={images} isLoadingImages={isLoading} />
      </TabsContent>
      <TabsContent value="ebay">
        <EbayPreview listing={listing} />
      </TabsContent>
      <TabsContent value="kleinanzeigen">
        <KleinanzeigenPreview listing={listing} />
      </TabsContent>
    </Tabs>
  );
}
