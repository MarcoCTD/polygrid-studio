import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
