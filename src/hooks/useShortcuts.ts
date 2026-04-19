import { useEffect } from 'react';
import { useUIStore } from '@/stores';
import { useRouter } from '@tanstack/react-router';

/**
 * Routen-Map fuer Cmd+1-9 Navigation.
 * Reihenfolge entspricht der Sidebar (Abschnitt 3.2 der Spec).
 */
const ROUTE_MAP: Record<string, string> = {
  '1': '/',
  '2': '/products',
  '3': '/expenses',
  '4': '/orders',
  '5': '/listings',
  '6': '/templates',
  '7': '/files',
  '8': '/tasks',
  '9': '/analytics',
};

/**
 * useShortcuts Hook
 *
 * Registriert globale Tastaturkuerzel gemaess Modul 01 Spec Abschnitt 6:
 * - Cmd/Ctrl+K: Command Palette oeffnen
 * - Cmd/Ctrl+B: Sidebar toggle
 * - Cmd/Ctrl+1-9: Navigation zu Modul 1-9
 * - Escape: Modal/Panel schliessen
 *
 * Zusaetzlich: fuehrt registrierte Custom-Shortcuts aus dem Store aus.
 */
export function useShortcuts() {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const setCommandPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const commandPaletteOpen = useUIStore((s) => s.commandPaletteOpen);
  const closeDetailPanel = useUIStore((s) => s.closeDetailPanel);
  const detailPanelOpen = useUIStore((s) => s.detailPanelOpen);
  const shortcuts = useUIStore((s) => s.shortcuts);
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl+K: Command Palette
      if (isMod && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
        return;
      }

      // Cmd/Ctrl+B: Sidebar toggle
      if (isMod && e.key === 'b') {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // Cmd/Ctrl+/: KI-Assistent (Platzhalter – navigiert zu /ai)
      if (isMod && e.key === '/') {
        e.preventDefault();
        void router.navigate({ to: '/ai' });
        return;
      }

      // Cmd/Ctrl+1-9: Navigation
      if (isMod && e.key in ROUTE_MAP) {
        e.preventDefault();
        const route = ROUTE_MAP[e.key];
        void router.navigate({ to: route });
        return;
      }

      // Escape: Panel/Modal schliessen
      if (e.key === 'Escape') {
        if (commandPaletteOpen) {
          setCommandPaletteOpen(false);
          return;
        }
        if (detailPanelOpen) {
          closeDetailPanel();
          return;
        }
      }

      // Custom-Shortcuts aus Registry
      for (const shortcut of shortcuts) {
        const parts = shortcut.keys.toLowerCase().split('+');
        const requiresMod = parts.includes('mod');
        const key = parts[parts.length - 1];

        if (requiresMod && isMod && e.key.toLowerCase() === key) {
          e.preventDefault();
          shortcut.action();
          return;
        }
        if (!requiresMod && e.key.toLowerCase() === key) {
          e.preventDefault();
          shortcut.action();
          return;
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    toggleSidebar,
    setCommandPaletteOpen,
    commandPaletteOpen,
    closeDetailPanel,
    detailPanelOpen,
    shortcuts,
    router,
  ]);
}
