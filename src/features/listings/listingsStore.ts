import { create } from 'zustand';
import {
  getListings,
  type CompletenessStatus,
  type ListingFilters,
  type ListingListItem,
  type PlatformStatusFilter,
} from './listingsService';
import type { InventoryMode, ListingStatus } from './schemas';

export interface ListingsFilterState {
  search: string;
  status: ListingStatus[];
  platform_status: PlatformStatusFilter[];
  inventory_mode: InventoryMode[];
  completeness: CompletenessStatus[];
  language: Array<'de' | 'en'>;
  showDeleted: boolean;
}

export const INITIAL_LISTING_FILTERS: ListingsFilterState = {
  search: '',
  status: [],
  platform_status: [],
  inventory_mode: [],
  completeness: [],
  language: [],
  showDeleted: false,
};

interface ListingsState {
  listings: ListingListItem[];
  isLoading: boolean;
  error: string | null;
  activeFilters: ListingsFilterState;
  selectedIds: Set<string>;
  loadListings: () => Promise<void>;
  setFilter: <K extends keyof ListingsFilterState>(key: K, value: ListingsFilterState[K]) => void;
  toggleSelected: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  resetFilters: () => void;
}

function toServiceFilters(filters: ListingsFilterState): ListingFilters {
  return {
    search: filters.search.trim() || undefined,
    status: filters.status.length > 0 ? filters.status : undefined,
    platform_status: filters.platform_status.length > 0 ? filters.platform_status : undefined,
    inventory_mode: filters.inventory_mode.length > 0 ? filters.inventory_mode : undefined,
    completeness: filters.completeness.length > 0 ? filters.completeness : undefined,
    language: filters.language.length > 0 ? filters.language : undefined,
    showDeleted: filters.showDeleted,
  };
}

export const useListingsStore = create<ListingsState>((set, get) => ({
  listings: [],
  isLoading: false,
  error: null,
  activeFilters: { ...INITIAL_LISTING_FILTERS },
  selectedIds: new Set<string>(),

  loadListings: async () => {
    set({ isLoading: true, error: null });

    try {
      const listings = await getListings(toServiceFilters(get().activeFilters));
      const visibleIds = new Set(listings.map((listing) => listing.id));
      const selectedIds = new Set(Array.from(get().selectedIds).filter((id) => visibleIds.has(id)));
      set({ listings, selectedIds, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Listings konnten nicht geladen werden',
        isLoading: false,
      });
    }
  },

  setFilter: (key, value) =>
    set((state) => ({
      activeFilters: { ...state.activeFilters, [key]: value },
      selectedIds: new Set<string>(),
    })),

  toggleSelected: (id) =>
    set((state) => {
      const selectedIds = new Set(state.selectedIds);
      if (selectedIds.has(id)) {
        selectedIds.delete(id);
      } else {
        selectedIds.add(id);
      }
      return { selectedIds };
    }),

  selectAll: (ids) => set({ selectedIds: new Set(ids) }),

  clearSelection: () => set({ selectedIds: new Set<string>() }),

  resetFilters: () => set({ activeFilters: { ...INITIAL_LISTING_FILTERS } }),
}));
