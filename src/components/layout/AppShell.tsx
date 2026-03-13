import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "./Sidebar";
import { CommandPalette } from "./CommandPalette";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProductsPage } from "@/features/products/components/ProductsPage";
import { ExpensesPage } from "@/features/expenses/components/ExpensesPage";
import { OrdersPage } from "@/features/orders/components/OrdersPage";
import { TasksPage } from "@/features/tasks/components/TasksPage";
import { ListingsPage } from "@/features/listings/components/ListingsPage";
import { TemplatesPage } from "@/features/templates/components/TemplatesPage";
import { DashboardPage } from "@/features/dashboard/components/DashboardPage";
import { AnalyticsPage } from "@/features/analytics/components/AnalyticsPage";
import { SettingsPage } from "@/features/settings/components/SettingsPage";
import { FilesPage } from "@/features/files/components/FilesPage";
import { AiAssistantPage } from "@/features/ai-assistant/components/AiAssistantPage";
import de from "@/i18n/de.json";

// ── Route → page component mapping ───────────────────────────────────────────

function renderPage(route: string) {
  switch (route) {
    case "/":
      return <DashboardPage />;
    case "/products":
      return <ProductsPage />;
    case "/expenses":
      return <ExpensesPage />;
    case "/orders":
      return <OrdersPage />;
    case "/tasks":
      return <TasksPage />;
    case "/listings":
      return <ListingsPage />;
    case "/templates":
      return <TemplatesPage />;
    case "/files":
      return <FilesPage />;
    case "/analytics":
      return <AnalyticsPage />;
    case "/ai-assistant":
      return <AiAssistantPage />;
    case "/settings":
      return <SettingsPage />;
    default:
      return <DashboardPage />;
  }
}

// ── AppShell ──────────────────────────────────────────────────────────────────

export function AppShell() {
  const [activeRoute, setActiveRoute] = useState("/");
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);

  // Global keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Cmd+K / Ctrl+K — Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdPaletteOpen((prev) => !prev);
        return;
      }

      // Cmd+/ — open AI Assistant
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setActiveRoute("/ai-assistant");
        return;
      }

      // Cmd+1-9 — module navigation
      if ((e.metaKey || e.ctrlKey) && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const routes = [
          "/",
          "/products",
          "/expenses",
          "/orders",
          "/listings",
          "/templates",
          "/files",
          "/tasks",
          "/analytics",
        ];
        const idx = parseInt(e.key) - 1;
        if (idx < routes.length) {
          setActiveRoute(routes[idx]);
        }
        return;
      }
    },
    []
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <TooltipProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-[--background] text-[--foreground]">
        <Sidebar activeRoute={activeRoute} onNavigate={setActiveRoute} />

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar onOpenCommandPalette={() => setCmdPaletteOpen(true)} />
          <main className="flex-1 overflow-hidden">
            {renderPage(activeRoute)}
          </main>
        </div>

        {/* Command Palette */}
        <CommandPalette
          open={cmdPaletteOpen}
          onOpenChange={setCmdPaletteOpen}
          onNavigate={setActiveRoute}
        />
      </div>
    </TooltipProvider>
  );
}

// ── Top bar ───────────────────────────────────────────────────────────────────

function TopBar({ onOpenCommandPalette }: { onOpenCommandPalette: () => void }) {
  return (
    <header
      className="flex h-10 shrink-0 items-center justify-end border-b border-[--border] bg-[--background] px-6"
      data-tauri-drag-region
    >
      <button
        onClick={onOpenCommandPalette}
        className="flex items-center gap-1.5 rounded-md border border-[--border] bg-[--muted] px-2 py-0.5 text-[10px] text-[--muted-foreground] transition-colors hover:bg-[--muted]/80"
      >
        <span className="font-mono">{de.shortcuts.commandPalette}</span>
      </button>
    </header>
  );
}
