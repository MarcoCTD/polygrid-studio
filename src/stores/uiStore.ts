import { create } from 'zustand';
import type { ComponentType } from 'react';
import type { Theme, AccentColor } from '@/types';

// ============================================================
// Command Registry (erweiterbar durch spaetere Module)
// ============================================================
export interface Command {
  id: string;
  label: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
  category: 'navigation' | 'system' | 'action' | 'ai';
  shortcut?: string;
  action: () => void;
}

// ============================================================
// Shortcut Registry (erweiterbar durch spaetere Module)
// ============================================================
export interface Shortcut {
  id: string;
  keys: string;
  description: string;
  action: () => void;
}

// ============================================================
// UI Store
// ============================================================
interface UIState {
  // Sidebar
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;

  // Theme (Default: system, bis DB geladen)
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  setResolvedTheme: (resolved: 'light' | 'dark') => void;

  // Akzentfarbe (Default: sap_blue, bis DB geladen)
  accentColor: AccentColor;
  setAccentColor: (color: AccentColor) => void;

  // Detail Panel
  detailPanelOpen: boolean;
  detailPanelContent: React.ReactNode | null;
  openDetailPanel: (content: React.ReactNode) => void;
  closeDetailPanel: () => void;

  // Command Palette
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  commands: Command[];
  registerCommands: (commands: Command[]) => void;
  unregisterCommands: (ids: string[]) => void;

  // Shortcut Registry
  shortcuts: Shortcut[];
  registerShortcuts: (shortcuts: Shortcut[]) => void;
  unregisterShortcuts: (ids: string[]) => void;

  // DB-Init Status
  dbReady: boolean;
  dbError: string | null;
  setDbReady: (ready: boolean) => void;
  setDbError: (error: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Sidebar
  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  // Theme
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: (theme) => set({ theme }),
  setResolvedTheme: (resolved) => set({ resolvedTheme: resolved }),

  // Akzentfarbe
  accentColor: 'sap_blue',
  setAccentColor: (color) => set({ accentColor: color }),

  // Detail Panel
  detailPanelOpen: false,
  detailPanelContent: null,
  openDetailPanel: (content) => set({ detailPanelOpen: true, detailPanelContent: content }),
  closeDetailPanel: () => set({ detailPanelOpen: false, detailPanelContent: null }),

  // Command Palette
  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  commands: [],
  registerCommands: (newCommands) =>
    set((state) => {
      const existingIds = new Set(state.commands.map((c) => c.id));
      const unique = newCommands.filter((c) => !existingIds.has(c.id));
      return { commands: [...state.commands, ...unique] };
    }),
  unregisterCommands: (ids) =>
    set((state) => ({
      commands: state.commands.filter((c) => !ids.includes(c.id)),
    })),

  // Shortcut Registry
  shortcuts: [],
  registerShortcuts: (newShortcuts) =>
    set((state) => {
      const existingIds = new Set(state.shortcuts.map((s) => s.id));
      const unique = newShortcuts.filter((s) => !existingIds.has(s.id));
      return { shortcuts: [...state.shortcuts, ...unique] };
    }),
  unregisterShortcuts: (ids) =>
    set((state) => ({
      shortcuts: state.shortcuts.filter((s) => !ids.includes(s.id)),
    })),

  // DB-Init Status
  dbReady: false,
  dbError: null,
  setDbReady: (ready) => set({ dbReady: ready }),
  setDbError: (error) => set({ dbError: error }),
}));
