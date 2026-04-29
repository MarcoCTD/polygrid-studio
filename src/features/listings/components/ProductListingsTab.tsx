import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ExternalLink, FileText, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { Product } from '@/features/products/schema';
import {
  getListingsForProduct,
  type ListingDetail,
  type ListingListItem,
} from '../listingsService';
import { DuplicateListingModal } from './DuplicateListingModal';
import { ListingStatusBadge } from './ListingStatusBadge';
import { NewListingModal } from './NewListingModal';
import { PlatformStatusBadges } from './PlatformStatusBadges';

interface ProductListingsTabProps {
  product: Product;
}

export function ProductListingsTab({ product }: ProductListingsTabProps) {
  const navigate = useNavigate();
  const [listings, setListings] = useState<ListingListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isNewListingOpen, setIsNewListingOpen] = useState(false);
  const [isDuplicateListingOpen, setIsDuplicateListingOpen] = useState(false);

  function reloadListings() {
    setIsLoading(true);
    getListingsForProduct(product.id)
      .then(setListings)
      .catch((err) => {
        toast.error(
          err instanceof Error ? err.message : 'Produkt-Listings konnten nicht geladen werden',
        );
      })
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      setIsLoading(true);
      getListingsForProduct(product.id)
        .then((items) => {
          if (!cancelled) setListings(items);
        })
        .catch((err) => {
          if (!cancelled) {
            toast.error(
              err instanceof Error ? err.message : 'Produkt-Listings konnten nicht geladen werden',
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
  }, [product.id]);

  function openListing(listingId: string) {
    void navigate({ to: '/listings/$listingId', params: { listingId } });
  }

  function handleCreated(listing: ListingDetail) {
    reloadListings();
    openListing(listing.id);
  }

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-border-subtle bg-bg-elevated text-sm text-text-muted dark:border-transparent">
        Listings werden geladen...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {listings.length === 0 ? (
        <div className="flex h-52 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border-subtle bg-bg-elevated text-center dark:border-transparent">
          <div className="flex size-11 items-center justify-center rounded-full bg-bg-secondary text-text-muted">
            <FileText size={22} />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">
              Noch kein Listing für dieses Produkt.
            </p>
            <p className="text-sm text-text-secondary">
              Erstelle ein Master-Listing, um Plattformdaten vorzubereiten.
            </p>
          </div>
          <Button onClick={() => setIsNewListingOpen(true)} className="gap-1.5">
            <Plus size={14} />
            Listing anlegen
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map((listing) => (
            <div
              key={listing.id}
              className="rounded-lg border border-border-subtle bg-bg-elevated p-4 dark:border-transparent"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text-primary">
                    {listing.master_title}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <ListingStatusBadge status={listing.status} />
                    <PlatformStatusBadges
                      overrides={listing.overrides}
                      masterStatus={listing.status}
                      completeness={listing.completeness}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openListing(listing.id)}
                    className="gap-1.5"
                  >
                    <ExternalLink size={14} />
                    Im Editor öffnen
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsDuplicateListingOpen(true)}
                    className="gap-1.5"
                  >
                    <FileText size={14} />
                    Aus Vorlage erstellen
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <NewListingModal
        open={isNewListingOpen}
        onOpenChange={setIsNewListingOpen}
        initialProductId={product.id}
        onCreated={handleCreated}
      />
      <DuplicateListingModal
        open={isDuplicateListingOpen}
        onOpenChange={setIsDuplicateListingOpen}
        onCreated={handleCreated}
      />
    </div>
  );
}
