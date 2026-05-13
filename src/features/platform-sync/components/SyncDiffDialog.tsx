import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { DiffView } from '@/components/shared/DiffView';
import { syncService } from '../services/sync-service';
import type { SyncDiff } from '../providers/types';

export interface SyncDialogListing {
  id: string;
  master_title: string;
  syncPlatform: 'etsy' | 'ebay';
}

interface SyncDiffDialogProps {
  listing: SyncDialogListing | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSynced?: () => void;
}

export function SyncDiffDialog({
  listing,
  open,
  onOpenChange,
  onSynced,
}: SyncDiffDialogProps) {
  const [diff, setDiff] = useState<SyncDiff | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open || !listing) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setIsLoading(true);
    });
    syncService
      .getDiff(listing.id, listing.syncPlatform)
      .then((nextDiff) => {
        if (!cancelled) setDiff(nextDiff);
      })
      .catch((error) =>
        toast.error(error instanceof Error ? error.message : 'Diff konnte nicht geladen werden'),
      )
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [listing, open]);

  if (!listing) return null;

  return (
    <DiffView
      title={isLoading ? 'Diff wird geladen...' : `Sync-Diff: ${listing.master_title}`}
      agent="Platform Sync"
      provider={listing.syncPlatform}
      fields={diff?.fields ?? []}
      isOpen={open}
      currentLabel="Plattform"
      suggestedLabel="Lokal (PolyGrid)"
      acceptLabel="Push bestätigen"
      rejectLabel="Abbrechen"
      onClose={() => onOpenChange(false)}
      onReject={() => onOpenChange(false)}
      onAccept={() => {
        void syncService.pushListingById(listing.id).then((result) => {
          if (result.success) {
            toast.success('Listing synchronisiert');
            onSynced?.();
          } else {
            toast.error(result.error ?? 'Push fehlgeschlagen');
          }
        });
      }}
    />
  );
}
