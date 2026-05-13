import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Platform } from '../providers/types';
import type { SyncListingItem } from '../services/sync-ui-service';
import {
  BatchPushDialog,
  OrderPullDialog,
  SyncDiffDialog,
  SyncLog,
  SyncOverview,
} from '../components';
import { useSyncStore } from '../stores/sync-store';

export function SyncPage() {
  const [diffListing, setDiffListing] = useState<SyncListingItem | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [pullOpen, setPullOpen] = useState(false);
  const [pullPlatform, setPullPlatform] = useState<Platform | undefined>();
  const loadListings = useSyncStore((state) => state.loadListings);

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
      <BatchPushDialog open={batchOpen} onOpenChange={setBatchOpen} />
      <OrderPullDialog open={pullOpen} platform={pullPlatform} onOpenChange={setPullOpen} />
    </div>
  );
}
