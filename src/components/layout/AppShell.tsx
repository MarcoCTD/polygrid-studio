import { useEffect, type ReactNode } from 'react';
import { useLocation } from '@tanstack/react-router';
import { Sidebar } from './Sidebar';
import { DetailPanel } from './DetailPanel';
import { CommandPalette } from './CommandPalette';
import { useTheme } from '@/hooks/useTheme';
import { useShortcuts } from '@/hooks/useShortcuts';
import { useUIStore } from '@/stores';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  // Hooks aktivieren auf Root-Ebene
  useTheme();
  useShortcuts();

  // Detail-Panel gehoert inhaltlich immer zum aktiven Modul:
  // bei Routenwechsel schliessen und Inhalt zuruecksetzen.
  const pathname = useLocation({ select: (location) => location.pathname });
  const closeDetailPanel = useUIStore((s) => s.closeDetailPanel);
  useEffect(() => {
    closeDetailPanel();
  }, [pathname, closeDetailPanel]);

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl p-6">{children}</div>
      </main>
      <DetailPanel />
      <CommandPalette />
    </div>
  );
}
