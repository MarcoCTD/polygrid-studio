import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Platform, SyncDiff } from '../providers/types';
import type { SyncListingItem } from '../services/sync-ui-service';
import {
  BatchPushDialog,
  ConflictDialog,
  OrderPullDialog,
  SyncDiffDialog,
  SyncLog,
  SyncOverview,
} from '../components';
import { useSyncStore } from '../stores/sync-store';
import { syncService } from '../services/sync-service';

export function SyncPage() {
  const [diffListing, setDiffListing] = useState<SyncListingItem | null>(null);
  const [conflictDiff, setConflictDiff] = useState<SyncDiff | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [pullOpen, setPullOpen] = useState(false);
  const [pullPlatform, setPullPlatform] = useState<Platform | undefined>();
  const loadListings = useSyncStore((state) => state.loadListings);

  async function openConflictDialog(listing: SyncListingItem) {
    try {
      const diff = await syncService.getDiff(listing.id, listing.syncPlatform);
      setConflictDiff(diff);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Konflikt konnte nicht geladen werden');
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Platform Sync</h1>
          <p className="text-sm text-text-secondary">
            Listings synchronisieren und Bestellungen von Etsy und eBay importieren
          </p>
        </div>
        <RefreshCw size={24} className="text-text-muted" />
      </div>

      <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <TabsList variant="line" className="shrink-0">
          <TabsTrigger value="overview">Sync-Übersicht</TabsTrigger>
          <TabsTrigger value="log">Sync-Log</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="min-h-0 flex-1">
          <SyncOverview
            onShowDiff={setDiffListing}
            onShowConflict={(listing) => void openConflictDialog(listing)}
            onOpenBatchPush={() => setBatchOpen(true)}
            onOpenOrderPull={(platform) => {
              setPullPlatform(platform);
              setPullOpen(true);
            }}
          />
        </TabsContent>
        <TabsContent value="log" className="min-h-0 flex-1">
          <SyncLog />
        </TabsContent>
      </Tabs>

      <SyncDiffDialog
        listing={diffListing}
        open={diffListing !== null}
        onOpenChange={(open) => !open && setDiffListing(null)}
        onSynced={() => void loadListings()}
      />
      <ConflictDialog
        diff={conflictDiff}
        open={conflictDiff !== null}
        onOpenChange={(open) => !open && setConflictDiff(null)}
        onResolved={() => void loadListings()}
      />
      <BatchPushDialog open={batchOpen} onOpenChange={setBatchOpen} />
      <OrderPullDialog open={pullOpen} platform={pullPlatform} onOpenChange={setPullOpen} />
    </div>
  );
}
