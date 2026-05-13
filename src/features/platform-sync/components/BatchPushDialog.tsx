import { useEffect } from 'react';
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
import { useSyncStore } from '../stores/sync-store';

interface BatchPushDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BatchPushDialog({ open, onOpenChange }: BatchPushDialogProps) {
  const { listings, batch, runBatchPush, requestCancel } = useSyncStore();
  const candidates = listings.filter((listing) =>
    ['not_synced', 'pending', 'error', 'conflict'].includes(listing.sync_status),
  );

  useEffect(() => {
    if (!batch.running && batch.total > 0) {
      toast.success(`${batch.succeeded} synchronisiert, ${batch.failed} Fehler`);
    }
  }, [batch.failed, batch.running, batch.succeeded, batch.total]);

  const progress = batch.total > 0 ? Math.round((batch.current / batch.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={(next) => !batch.running && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alle Änderungen pushen</DialogTitle>
          <DialogDescription>
            {candidates.length} Listings werden ohne Einzel-Diff sequenziell synchronisiert.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="h-2 overflow-hidden rounded-full bg-bg-secondary">
            <div className="h-full bg-pg-accent" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-sm text-text-secondary">
            {batch.running
              ? `${batch.current}/${batch.total} verarbeitet`
              : `${batch.succeeded} erfolgreich, ${batch.failed} Fehler`}
          </p>
        </div>

        <DialogFooter>
          {batch.running ? (
            <Button variant="outline" onClick={requestCancel}>
              Nach aktuellem Listing abbrechen
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Schließen
            </Button>
          )}
          <Button
            disabled={batch.running || candidates.length === 0}
            onClick={() => void runBatchPush()}
          >
            Push starten
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
