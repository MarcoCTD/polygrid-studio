import { AlertTriangle } from 'lucide-react';
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
import { updateListing } from '@/features/listings/listingsService';
import type { SyncDiff } from '../providers/types';
import { syncService } from '../services/sync-service';

interface ConflictDialogProps {
  diff: SyncDiff | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolved?: () => void;
}

export function ConflictDialog({ diff, open, onOpenChange, onResolved }: ConflictDialogProps) {
  if (!diff) return null;

  async function acceptRemote() {
    if (!diff?.remote) return;
    try {
      await updateListing(diff.listingId, {
        master_title: diff.remote.title,
        master_long_description: diff.remote.description,
        base_price: diff.remote.price,
        stock_quantity: diff.remote.quantity,
        sync_status: 'synced',
      });
      toast.success('Direkt mappbare Plattform-Felder übernommen');
      onResolved?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Konflikt konnte nicht gelöst werden');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-orange-500" />
            Sync-Konflikt
          </DialogTitle>
          <DialogDescription>
            Nicht alle Plattform-Felder können übernommen werden. Übernommen werden nur Titel,
            Beschreibung, Preis und Menge.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button variant="outline" onClick={() => void acceptRemote()} disabled={!diff.remote}>
            Plattform-Version übernehmen
          </Button>
          <Button
            onClick={() =>
              void syncService.pushListingById(diff.listingId).then(() => {
                toast.success('Meine Version gepusht');
                onResolved?.();
                onOpenChange(false);
              })
            }
          >
            Meine Version pushen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
