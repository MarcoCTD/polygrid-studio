import { create } from 'zustand';
import type { Platform, SyncResult } from '../providers/types';
import {
  getSyncErrorCount,
  getSyncListings,
  type SyncListingFilters,
  type SyncListingItem,
} from '../services/sync-ui-service';
import { syncService } from '../services/sync-service';

interface BatchState {
  running: boolean;
  total: number;
  current: number;
  succeeded: number;
  failed: number;
  cancelled: boolean;
}

interface SyncStoreState {
  listings: SyncListingItem[];
  filters: SyncListingFilters;
  isLoading: boolean;
  error: string | null;
  syncErrorCount: number;
  batch: BatchState;
  cancelRequested: boolean;
  loadListings: () => Promise<void>;
  loadSyncErrorCount: () => Promise<void>;
  setFilter: <K extends keyof SyncListingFilters>(key: K, value: SyncListingFilters[K]) => void;
  pushListing: (listingId: string) => Promise<SyncResult>;
  runBatchPush: (platform?: Platform) => Promise<void>;
  requestCancel: () => void;
}

const initialBatch: BatchState = {
  running: false,
  total: 0,
  current: 0,
  succeeded: 0,
  failed: 0,
  cancelled: false,
};

export const useSyncStore = create<SyncStoreState>((set, get) => ({
  listings: [],
  filters: { platform: 'all', status: 'all' },
  isLoading: false,
  error: null,
  syncErrorCount: 0,
  batch: initialBatch,
  cancelRequested: false,

  loadListings: async () => {
    set({ isLoading: true, error: null });
    try {
      const listings = await getSyncListings(get().filters);
      set({ listings, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Sync-Listings konnten nicht geladen werden',
        isLoading: false,
      });
    }
  },

  loadSyncErrorCount: async () => {
    try {
      set({ syncErrorCount: await getSyncErrorCount() });
    } catch {
      set({ syncErrorCount: 0 });
    }
  },

  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    })),

  pushListing: async (listingId) => {
    const result = await syncService.pushListingById(listingId);
    await get().loadListings();
    await get().loadSyncErrorCount();
    return result;
  },

  runBatchPush: async (platform) => {
    set({ batch: { ...initialBatch, running: true }, cancelRequested: false });
    try {
      await syncService.pushAllPending(platform, {
        shouldCancel: () => get().cancelRequested,
        onProgress: (current, total, result) => {
          set((state) => ({
            batch: {
              ...state.batch,
              total,
              current,
              succeeded: state.batch.succeeded + (result.success ? 1 : 0),
              failed: state.batch.failed + (result.success ? 0 : 1),
            },
          }));
        },
      });
      set((state) => ({
        batch: {
          ...state.batch,
          running: false,
          cancelled: state.cancelRequested,
        },
      }));
      await get().loadListings();
      await get().loadSyncErrorCount();
    } catch (error) {
      set((state) => ({
        error: error instanceof Error ? error.message : 'Batch-Push fehlgeschlagen',
        batch: { ...state.batch, running: false },
      }));
    }
  },

  requestCancel: () => set({ cancelRequested: true }),
}));
