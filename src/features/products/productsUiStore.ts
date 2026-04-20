import { create } from 'zustand';
import type { Status, Platform, LicenseRisk } from './schema';

export interface ProductsFilterState {
  search: string;
  status: Status[];
  category: string[];
  platforms: Platform[];
  licenseRisk: LicenseRisk[];
  marginMin: number | undefined;
  marginMax: number | undefined;
  includeDeleted: boolean;
}

const INITIAL_FILTERS: ProductsFilterState = {
  search: '',
  status: [],
  category: [],
  platforms: [],
  licenseRisk: [],
  marginMin: undefined,
  marginMax: undefined,
  includeDeleted: false,
};

interface ProductsUIState {
  // Filter
  filters: ProductsFilterState;
  setSearch: (search: string) => void;
  setStatus: (status: Status[]) => void;
  setCategory: (category: string[]) => void;
  setPlatforms: (platforms: Platform[]) => void;
  setLicenseRisk: (licenseRisk: LicenseRisk[]) => void;
  setMarginMin: (min: number | undefined) => void;
  setMarginMax: (max: number | undefined) => void;
  setIncludeDeleted: (include: boolean) => void;
  resetFilters: () => void;
  hasActiveFilters: () => boolean;
}

export const useProductsUIStore = create<ProductsUIState>((set, get) => ({
  filters: { ...INITIAL_FILTERS },

  setSearch: (search) => set((state) => ({ filters: { ...state.filters, search } })),
  setStatus: (status) => set((state) => ({ filters: { ...state.filters, status } })),
  setCategory: (category) => set((state) => ({ filters: { ...state.filters, category } })),
  setPlatforms: (platforms) => set((state) => ({ filters: { ...state.filters, platforms } })),
  setLicenseRisk: (licenseRisk) => set((state) => ({ filters: { ...state.filters, licenseRisk } })),
  setMarginMin: (marginMin) => set((state) => ({ filters: { ...state.filters, marginMin } })),
  setMarginMax: (marginMax) => set((state) => ({ filters: { ...state.filters, marginMax } })),
  setIncludeDeleted: (includeDeleted) =>
    set((state) => ({ filters: { ...state.filters, includeDeleted } })),
  resetFilters: () => set({ filters: { ...INITIAL_FILTERS } }),
  hasActiveFilters: () => {
    const f = get().filters;
    return (
      f.search !== '' ||
      f.status.length > 0 ||
      f.category.length > 0 ||
      f.platforms.length > 0 ||
      f.licenseRisk.length > 0 ||
      f.marginMin !== undefined ||
      f.marginMax !== undefined ||
      f.includeDeleted
    );
  },
}));
