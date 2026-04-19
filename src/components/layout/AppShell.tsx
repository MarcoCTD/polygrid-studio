import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { DetailPanel } from "./DetailPanel";
import { useTheme } from "@/hooks/useTheme";
import { useShortcuts } from "@/hooks/useShortcuts";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  // Hooks aktivieren auf Root-Ebene
  useTheme();
  useShortcuts();

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl p-6">{children}</div>
      </main>
      <DetailPanel />
    </div>
  );
}
