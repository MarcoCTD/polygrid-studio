import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import de from "@/i18n/de.json";

// Route → page title / subtitle mapping
const routeMeta: Record<string, { title: string; subtitle: string }> = {
  "/": { title: de.dashboard.title, subtitle: de.dashboard.subtitle },
  "/products": { title: de.products.title, subtitle: de.products.subtitle },
  "/expenses": { title: de.expenses.title, subtitle: de.expenses.subtitle },
  "/orders": { title: de.orders.title, subtitle: de.orders.subtitle },
  "/listings": { title: de.listings.title, subtitle: de.listings.subtitle },
  "/templates": { title: de.templates.title, subtitle: de.templates.subtitle },
  "/files": { title: de.files.title, subtitle: de.files.subtitle },
  "/tasks": { title: de.tasks.title, subtitle: de.tasks.subtitle },
  "/analytics": { title: de.analytics.title, subtitle: de.analytics.subtitle },
  "/ai-assistant": { title: de.aiAssistant.title, subtitle: de.aiAssistant.subtitle },
  "/settings": { title: de.settings.title, subtitle: de.settings.subtitle },
};

interface AppShellProps {
  children?: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [activeRoute, setActiveRoute] = useState("/");
  const meta = routeMeta[activeRoute] ?? { title: "", subtitle: "" };

  return (
    <TooltipProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-[--background] text-[--foreground]">
        {/* Sidebar */}
        <Sidebar activeRoute={activeRoute} onNavigate={setActiveRoute} />

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top bar */}
          <header
            className={cn(
              "flex h-12 shrink-0 items-center justify-between border-b border-[--border] px-6",
              "bg-[--background]"
            )}
            data-tauri-drag-region
          >
            <div className="flex flex-col justify-center" data-tauri-drag-region>
              <h1 className="text-sm font-semibold leading-none text-[--foreground]">
                {meta.title}
              </h1>
              {meta.subtitle && (
                <p className="mt-0.5 text-xs text-[--muted-foreground]">
                  {meta.subtitle}
                </p>
              )}
            </div>

            {/* Right side actions placeholder */}
            <div className="flex items-center gap-2">
              <kbd className="hidden rounded border border-[--border] bg-[--muted] px-1.5 py-0.5 font-mono text-[10px] text-[--muted-foreground] sm:inline-block">
                {de.shortcuts.commandPalette}
              </kbd>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-6">
            {children ?? (
              <PagePlaceholder route={activeRoute} meta={meta} />
            )}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}

// Temporary placeholder until real feature modules exist
function PagePlaceholder({
  route,
  meta,
}: {
  route: string;
  meta: { title: string; subtitle: string };
}) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div className="mb-4 inline-flex size-12 items-center justify-center rounded-xl border border-[--border] bg-[--card]">
          <span className="font-mono text-xs text-[--muted-foreground]">
            {route}
          </span>
        </div>
        <h2 className="text-base font-semibold text-[--foreground]">{meta.title}</h2>
        <p className="mt-1 text-sm text-[--muted-foreground]">{meta.subtitle}</p>
        <p className="mt-4 rounded-md border border-[--border] bg-[--card] px-4 py-2 font-mono text-xs text-[--muted-foreground]">
          Modul in Entwicklung
        </p>
      </div>
    </div>
  );
}
