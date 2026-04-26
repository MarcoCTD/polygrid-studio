import { create } from 'zustand';

interface FilesState {
  selectedPath: string | null;
  setSelectedPath: (path: string | null) => void;
  expandedFolders: Set<string>;
  toggleFolder: (path: string) => void;
  refreshCounter: number;
  refreshCurrentFolder: () => void;
  error: string | null;
  setError: (message: string) => void;
  clearError: () => void;
}

export const useFilesStore = create<FilesState>((set) => ({
  selectedPath: null,
  setSelectedPath: (path) => set({ selectedPath: path }),
  expandedFolders: new Set<string>(),
  toggleFolder: (path) =>
    set((state) => {
      const expandedFolders = new Set(state.expandedFolders);
      if (expandedFolders.has(path)) {
        expandedFolders.delete(path);
      } else {
        expandedFolders.add(path);
      }
      return { expandedFolders };
    }),
  refreshCounter: 0,
  refreshCurrentFolder: () => set((state) => ({ refreshCounter: state.refreshCounter + 1 })),
  error: null,
  setError: (message) => set({ error: message }),
  clearError: () => set({ error: null }),
}));
