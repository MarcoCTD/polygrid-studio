import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProductsPage } from "@/features/products/components/ProductsPage";
import { ExpensesPage } from "@/features/expenses/components/ExpensesPage";
import { OrdersPage } from "@/features/orders/components/OrdersPage";
import { TasksPage } from "@/features/tasks/components/TasksPage";
import { ListingsPage } from "@/features/listings/components/ListingsPage";
import { TemplatesPage } from "@/features/templates/components/TemplatesPage";
import de from "@/i18n/de.json";

// ── Route → page component mapping ───────────────────────────────────────────

function renderPage(route: string) {
  switch (route) {
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
    default:
      return <PlaceholderPage route={route} />;
  }
}

// ── AppShell ──────────────────────────────────────────────────────────────────

export function AppShell() {
  const [activeRoute, setActiveRoute] = useState("/products");

  return (
    <TooltipProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-[--background] text-[--foreground]">
        <Sidebar activeRoute={activeRoute} onNavigate={setActiveRoute} />

        {/* Main content — no padding for pages that manage their own layout */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-hidden">
            {renderPage(activeRoute)}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}

// ── Top bar ───────────────────────────────────────────────────────────────────

function TopBar() {
  return (
    <header
      className="flex h-10 shrink-0 items-center justify-end border-b border-[--border] bg-[--background] px-6"
      data-tauri-drag-region
    >
      <kbd className="rounded border border-[--border] bg-[--muted] px-1.5 py-0.5 font-mono text-[10px] text-[--muted-foreground]">
        {de.shortcuts.commandPalette}
      </kbd>
    </header>
  );
}

// ── Placeholder for unbuilt modules ──────────────────────────────────────────

const MODULE_META: Record<string, { title: string; subtitle: string }> = {
  "/": { title: de.dashboard.title, subtitle: de.dashboard.subtitle },
  "/files": { title: de.files.title, subtitle: de.files.subtitle },
  "/analytics": { title: de.analytics.title, subtitle: de.analytics.subtitle },
  "/ai-assistant": { title: de.aiAssistant.title, subtitle: de.aiAssistant.subtitle },
  "/settings": { title: de.settings.title, subtitle: de.settings.subtitle },
};

function PlaceholderPage({ route }: { route: string }) {
  const meta = MODULE_META[route] ?? { title: route, subtitle: "" };
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <h2 className="text-base font-semibold text-[--foreground]">{meta.title}</h2>
        <p className="mt-1 text-sm text-[--muted-foreground]">{meta.subtitle}</p>
        <p className="mt-4 rounded-md border border-[--border] bg-[--card] px-4 py-2 font-mono text-xs text-[--muted-foreground]">
          Modul in Entwicklung
        </p>
      </div>
    </div>
  );
}
