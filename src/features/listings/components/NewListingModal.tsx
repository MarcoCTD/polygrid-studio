import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PLATFORMS, PLATFORM_LABELS } from '../constants';
import {
  createListing,
  getProductsWithoutListing,
  type ListingDetail,
  type ProductWithoutListingOption,
} from '../listingsService';
import type { InventoryMode, Platform } from '../schemas';

interface NewListingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (listing: ListingDetail) => void;
}

export function NewListingModal({ open, onOpenChange, onCreated }: NewListingModalProps) {
  const [products, setProducts] = useState<ProductWithoutListingOption[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [language, setLanguage] = useState<'de' | 'en'>('de');
  const [inventoryMode, setInventoryMode] = useState<InventoryMode>('made_to_order');
  const [platforms, setPlatforms] = useState<Platform[]>([...PLATFORMS]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    queueMicrotask(() => {
      setIsLoading(true);
      getProductsWithoutListing()
        .then((items) => {
          if (cancelled) return;
          setProducts(items);
          setSelectedProductId(items[0]?.id ?? '');
          setLanguage('de');
          setInventoryMode('made_to_order');
          setPlatforms([...PLATFORMS]);
        })
        .catch((err) => {
          if (!cancelled) {
            toast.error(
              err instanceof Error ? err.message : 'Produkte konnten nicht geladen werden',
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

  function togglePlatform(platform: Platform) {
    setPlatforms((current) =>
      current.includes(platform)
        ? current.filter((item) => item !== platform)
        : [...current, platform],
    );
  }

  async function handleCreate() {
    if (!selectedProduct) return;

    setIsCreating(true);
    try {
      const listing = await createListing({
        product_id: selectedProduct.id,
        master_title: selectedProduct.name,
        master_tags: [],
        base_price: selectedProduct.target_price ?? 0,
        inventory_mode: inventoryMode,
        stock_quantity: inventoryMode === 'stock' ? 0 : null,
        language,
        platforms,
      });
      toast.success('Listing erstellt');
      onOpenChange(false);
      onCreated(listing);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Listing konnte nicht erstellt werden');
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Neues Listing</DialogTitle>
          <DialogDescription>
            Erstelle ein Master-Listing für ein Produkt ohne vorhandenes Listing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Produkt</label>
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

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                Sprache
              </label>
              <div className="flex rounded-lg border border-input p-1">
                {(['de', 'en'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setLanguage(value)}
                    className={`flex-1 rounded-md px-3 py-1.5 text-sm ${
                      language === value
                        ? 'bg-bg-secondary text-text-primary'
                        : 'text-text-secondary'
                    }`}
                  >
                    {value.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                Inventory
              </label>
              <Select
                value={inventoryMode}
                onValueChange={(value) => setInventoryMode(value as InventoryMode)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="made_to_order">Auf Bestellung</SelectItem>
                  <SelectItem value="stock">Lagerbestand</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-text-secondary">
              Plattformen vorbereiten
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {PLATFORMS.map((platform) => (
                <label key={platform} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={platforms.includes(platform)}
                    onCheckedChange={() => togglePlatform(platform)}
                  />
                  <span>{PLATFORM_LABELS[platform]}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={() => void handleCreate()}
            disabled={!selectedProduct || isCreating || platforms.length === 0}
          >
            {isCreating ? 'Erstellt...' : 'Erstellen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
