import { useEffect, useMemo, useState } from 'react';
import { CopyPlus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  duplicateListing,
  getListings,
  getProductsWithoutListing,
  type ListingDetail,
  type ListingListItem,
  type ProductWithoutListingOption,
} from '../listingsService';
import { PlatformStatusBadges } from './PlatformStatusBadges';

interface DuplicateListingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (listing: ListingDetail) => void;
}

export function DuplicateListingModal({
  open,
  onOpenChange,
  onCreated,
}: DuplicateListingModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [listings, setListings] = useState<ListingListItem[]>([]);
  const [products, setProducts] = useState<ProductWithoutListingOption[]>([]);
  const [search, setSearch] = useState('');
  const [selectedListingId, setSelectedListingId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const filteredListings = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return listings;
    return listings.filter(
      (listing) =>
        listing.master_title.toLowerCase().includes(query) ||
        (listing.product_name ?? '').toLowerCase().includes(query),
    );
  }, [listings, search]);
  const selectedListing = listings.find((listing) => listing.id === selectedListingId) ?? null;
  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? null;

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    queueMicrotask(() => {
      setIsLoading(true);
      setStep(1);
      setSearch('');
      Promise.all([getListings({ showDeleted: false }), getProductsWithoutListing()])
        .then(([listingItems, productItems]) => {
          if (cancelled) return;
          setListings(listingItems);
          setProducts(productItems);
          setSelectedListingId(listingItems[0]?.id ?? '');
          setSelectedProductId(productItems[0]?.id ?? '');
        })
        .catch((err) => {
          if (!cancelled) {
            toast.error(
              err instanceof Error ? err.message : 'Vorlagen konnten nicht geladen werden',
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
  }, [open]);

  async function handleDuplicate() {
    if (!selectedListing || !selectedProduct) return;

    setIsCreating(true);
    try {
      const listing = await duplicateListing(selectedListing.id, selectedProduct.id);
      toast.success('Listing aus Vorlage erstellt');
      onOpenChange(false);
      onCreated(listing);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Listing konnte nicht dupliziert werden');
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Aus Vorlage erstellen</DialogTitle>
          <DialogDescription>
            Kopiert Master-Daten, Plattform-Overrides und Varianten. Bilder werden nicht kopiert.
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Vorlagen suchen..."
                className="pl-8"
              />
            </div>

            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {isLoading ? (
                <div className="rounded-lg border border-border-subtle p-6 text-center text-sm text-text-muted">
                  Vorlagen werden geladen...
                </div>
              ) : filteredListings.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border-subtle p-6 text-center text-sm text-text-muted">
                  Keine Vorlage gefunden.
                </div>
              ) : (
                filteredListings.map((listing) => (
                  <button
                    key={listing.id}
                    type="button"
                    onClick={() => setSelectedListingId(listing.id)}
                    className={cn(
                      'flex w-full items-center justify-between gap-4 rounded-lg border p-3 text-left transition-colors',
                      selectedListingId === listing.id
                        ? 'border-pg-accent bg-accent-subtle'
                        : 'border-border-subtle bg-bg-elevated hover:bg-bg-hover',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-text-primary">
                        {listing.master_title}
                      </span>
                      <span className="block truncate text-xs text-text-secondary">
                        {listing.product_name ?? 'Produkt unbekannt'}
                      </span>
                    </span>
                    <PlatformStatusBadges
                      overrides={listing.overrides}
                      masterStatus={listing.status}
                      completeness={listing.completeness}
                    />
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                Zielprodukt
              </label>
              <Select
                value={selectedProductId}
                onValueChange={(value) => {
                  if (value) setSelectedProductId(value);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={isLoading ? 'Produkte werden geladen...' : 'Produkt wählen'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!isLoading && products.length === 0 && (
                <p className="mt-2 text-xs text-text-muted">
                  Alle Produkte haben bereits ein Listing.
                </p>
              )}
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Bilder werden nicht kopiert und müssen neu verknüpft werden.
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          {step === 2 && (
            <Button variant="ghost" onClick={() => setStep(1)}>
              Zurück
            </Button>
          )}
          {step === 1 ? (
            <Button onClick={() => setStep(2)} disabled={!selectedListing || isLoading}>
              Weiter
            </Button>
          ) : (
            <Button
              onClick={() => void handleDuplicate()}
              disabled={!selectedListing || !selectedProduct || isCreating}
              className="gap-1.5"
            >
              <CopyPlus size={14} />
              {isCreating ? 'Erstellt...' : 'Erstellen'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
