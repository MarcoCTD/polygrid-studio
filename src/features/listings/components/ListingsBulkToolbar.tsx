import { useMemo, useState } from 'react';
import { Archive, Pause, Play, Trash2, X } from 'lucide-react';
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
import { formatEUR } from '@/features/products/utils';
import type { ListingListItem } from '../listingsService';

type PriceDirection = 'increase' | 'decrease';

interface ListingsBulkToolbarProps {
  selectedListings: ListingListItem[];
  onPause: () => void;
  onActivate: () => void;
  onDelete: () => void;
  onClearSelection: () => void;
  onPriceChange: (changePercent: number) => void;
}

export function ListingsBulkToolbar({
  selectedListings,
  onPause,
  onActivate,
  onDelete,
  onClearSelection,
  onPriceChange,
}: ListingsBulkToolbarProps) {
  const [isPriceDialogOpen, setIsPriceDialogOpen] = useState(false);
  const [direction, setDirection] = useState<PriceDirection>('increase');
  const [percent, setPercent] = useState('10');
  const selectedCount = selectedListings.length;
  const numericPercent = Number(percent);
  const isValidPercent =
    Number.isFinite(numericPercent) && numericPercent >= 1 && numericPercent <= 50;
  const previewPercent = isValidPercent ? numericPercent : 0;
  const signedPercent = direction === 'increase' ? previewPercent : -previewPercent;
  const averagePrice = useMemo(() => {
    if (selectedListings.length === 0) return 0;
    return (
      selectedListings.reduce((sum, listing) => sum + listing.base_price, 0) /
      selectedListings.length
    );
  }, [selectedListings]);
  const previewPrice = Math.round(averagePrice * (1 + signedPercent / 100) * 100) / 100;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-bg-secondary px-3 py-2 shadow-sm animate-in slide-in-from-top-2">
        <span className="mr-2 text-sm font-medium text-text-primary">
          {selectedCount} {selectedCount === 1 ? 'Listing' : 'Listings'} ausgewählt
        </span>

        <Button variant="ghost" size="sm" onClick={onPause} className="gap-1.5">
          <Pause size={14} />
          <span>Pausieren</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={onActivate} className="gap-1.5">
          <Play size={14} />
          <span>Aktivieren</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsPriceDialogOpen(true)}
          className="gap-1.5"
        >
          <Archive size={14} />
          <span>Preis ändern</span>
        </Button>
        <Button variant="destructive" size="sm" onClick={onDelete} className="gap-1.5">
          <Trash2 size={14} />
          <span>Löschen</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="ml-auto gap-1.5 text-text-secondary"
        >
          <X size={14} />
          <span>Auswahl aufheben</span>
        </Button>
      </div>

      <Dialog open={isPriceDialogOpen} onOpenChange={setIsPriceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Preise ändern</DialogTitle>
            <DialogDescription>
              Ändert den Basispreis aller ausgewählten Master-Listings prozentual.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={direction === 'increase' ? 'default' : 'outline'}
                onClick={() => setDirection('increase')}
              >
                Erhöhen
              </Button>
              <Button
                type="button"
                variant={direction === 'decrease' ? 'default' : 'outline'}
                onClick={() => setDirection('decrease')}
              >
                Senken
              </Button>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-text-secondary">
                Prozent (1-50)
              </span>
              <Input
                type="number"
                min="1"
                max="50"
                value={percent}
                onChange={(event) => setPercent(event.target.value)}
              />
            </label>

            <div className="rounded-lg border border-border-subtle bg-bg-secondary p-3 text-sm text-text-secondary">
              {selectedCount} {selectedCount === 1 ? 'Listing' : 'Listings'}:{' '}
              <span className="font-medium text-text-primary">{formatEUR(averagePrice)}</span> Ø
              {' → '}
              <span className="font-medium text-text-primary">{formatEUR(previewPrice)}</span> Ø (
              {signedPercent > 0 ? '+' : ''}
              {signedPercent}%)
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsPriceDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={() => {
                onPriceChange(signedPercent);
                setIsPriceDialogOpen(false);
              }}
              disabled={!isValidPercent}
            >
              Bestätigen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
