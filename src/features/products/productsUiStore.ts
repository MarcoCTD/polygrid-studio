import { create } from 'zustand';
import type { Status, Platform, LicenseRisk } from './schema';

// ============================================================
// Filter State
// ============================================================

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

// ============================================================
// Column Config
// ============================================================

export interface ColumnConfig {
  id: string;
  visible: boolean;
  order: number;
}

export const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'select', visible: true, order: 0 },
  { id: 'status', visible: true, order: 1 },
  { id: 'name', visible: true, order: 2 },
  { id: 'category', visible: true, order: 3 },
  { id: 'material_type', visible: true, order: 4 },
  { id: 'target_price', visible: true, order: 5 },
  { id: 'estimated_margin', visible: true, order: 6 },
  { id: 'platforms', visible: true, order: 7 },
  { id: 'updated_at', visible: true, order: 8 },
  { id: 'collection', visible: false, order: 9 },
  { id: 'print_time_minutes', visible: false, order: 10 },
  { id: 'material_grams', visible: false, order: 11 },
  { id: 'license_risk', visible: false, order: 12 },
  { id: 'created_at', visible: false, order: 13 },
];

// ============================================================
// Saved Filters
// ============================================================

export interface SavedFilter {
  id: string;
  name: string;
  filters: ProductsFilterState;
  createdAt: string;
}

// ============================================================
// Store Interface
// ============================================================

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
  applyFilterState: (filterState: ProductsFilterState) => void;

  // Bulk Selection
  selectedIds: Set<string>;
  toggleSelected: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;
  toggleRange: (ids: string[], fromIndex: number, toIndex: number) => void;

  // Active Row (keyboard nav)
  activeRowIndex: number;
  setActiveRowIndex: (index: number) => void;

  // Column Config
  columnConfig: ColumnConfig[];
  setColumnConfig: (config: ColumnConfig[]) => void;
  toggleColumnVisible: (columnId: string) => void;
  reorderColumns: (fromIndex: number, toIndex: number) => void;

  // Saved Filters
  savedFilters: SavedFilter[];
  setSavedFilters: (filters: SavedFilter[]) => void;
  addSavedFilter: (filter: SavedFilter) => void;
  updateSavedFilter: (id: string, updates: Partial<Pick<SavedFilter, 'name' | 'filters'>>) => void;
  deleteSavedFilter: (id: string) => void;
}

export const useProductsUIStore = create<ProductsUIState>((set, get) => ({
  // ── Filter ──────────────────────────────────────────────
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
  applyFilterState: (filterState) => set({ filters: { ...filterState } }),

  // ── Bulk Selection ──────────────────────────────────────
  selectedIds: new Set<string>(),

  toggleSelected: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { selectedIds: next };
    }),

  selectAll: (ids) => set({ selectedIds: new Set(ids) }),

  clearSelection: () => set({ selectedIds: new Set<string>() }),

  isSelected: (id) => get().selectedIds.has(id),

  toggleRange: (ids, fromIndex, toIndex) =>
    set((state) => {
      const start = Math.min(fromIndex, toIndex);
      const end = Math.max(fromIndex, toIndex);
      const next = new Set(state.selectedIds);
      for (let i = start; i <= end; i++) {
        if (ids[i]) next.add(ids[i]);
      }
      return { selectedIds: next };
    }),

  // ── Active Row ──────────────────────────────────────────
  activeRowIndex: -1,
  setActiveRowIndex: (index) => set({ activeRowIndex: index }),

  // ── Column Config ───────────────────────────────────────
  columnConfig: [...DEFAULT_COLUMNS],

  setColumnConfig: (config) => set({ columnConfig: config }),

  toggleColumnVisible: (columnId) =>
    set((state) => ({
      columnConfig: state.columnConfig.map((col) =>
        col.id === columnId ? { ...col, visible: !col.visible } : col,
      ),
    })),

  reorderColumns: (fromIndex, toIndex) =>
    set((state) => {
      const sorted = [...state.columnConfig].sort((a, b) => a.order - b.order);
      const [moved] = sorted.splice(fromIndex, 1);
      sorted.splice(toIndex, 0, moved);
      return {
        columnConfig: sorted.map((col, i) => ({ ...col, order: i })),
      };
    }),

  // ── Saved Filters ──────────────────────────────────────
  savedFilters: [],

  setSavedFilters: (filters) => set({ savedFilters: filters }),

  addSavedFilter: (filter) => set((state) => ({ savedFilters: [...state.savedFilters, filter] })),

  updateSavedFilter: (id, updates) =>
    set((state) => ({
      savedFilters: state.savedFilters.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    })),

  deleteSavedFilter: (id) =>
    set((state) => ({
      savedFilters: state.savedFilters.filter((f) => f.id !== id),
    })),
}));
