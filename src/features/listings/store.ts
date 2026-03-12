import { create } from "zustand";
import type { Listing, CreateListingInput } from "./types";
import {
  listListings,
  createListing,
  updateListing,
  softDeleteListing,
} from "@/services/database/queries/listings";

interface ListingState {
  listings: Listing[];
  isLoading: boolean;
  error: string | null;
  selectedListingId: string | null;

  fetchListings: () => Promise<void>;
  createListing: (input: CreateListingInput) => Promise<Listing>;
  updateListing: (id: string, patch: Partial<CreateListingInput> & { bullet_points?: string[]; tags?: string[]; variants?: string[] }) => Promise<void>;
  deleteListing: (id: string) => Promise<void>;
  selectListing: (id: string | null) => void;
}

export const useListingStore = create<ListingState>((set) => ({
  listings: [],
  isLoading: false,
  error: null,
  selectedListingId: null,

  fetchListings: async () => {
    set({ isLoading: true, error: null });
    try {
      const listings = await listListings();
      set({ listings, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  createListing: async (input) => {
    const listing = await createListing(input);
    set((s) => ({ listings: [listing, ...s.listings] }));
    return listing;
  },

  updateListing: async (id, patch) => {
    const updated = await updateListing(id, patch);
    set((s) => ({
      listings: s.listings.map((l) => (l.id === id ? updated : l)),
    }));
  },

  deleteListing: async (id) => {
    await softDeleteListing(id);
    set((s) => ({
      listings: s.listings.filter((l) => l.id !== id),
      selectedListingId: s.selectedListingId === id ? null : s.selectedListingId,
    }));
  },

  selectListing: (id) => set({ selectedListingId: id }),
}));

export function useSelectedListing() {
  const { listings, selectedListingId } = useListingStore();
  return listings.find((l) => l.id === selectedListingId) ?? null;
}
