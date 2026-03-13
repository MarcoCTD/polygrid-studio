import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  LayoutDashboard,
  Package,
  Receipt,
  ShoppingCart,
  FileText,
  FileStack,
  FolderOpen,
  CheckSquare,
  BarChart3,
  Sparkles,
  Settings,
  Search,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import de from "@/i18n/de.json";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  action: () => void;
  group: string;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (route: string) => void;
}

export function CommandPalette({ open, onOpenChange, onNavigate }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const nav = useCallback(
    (route: string) => {
      onNavigate(route);
      onOpenChange(false);
    },
    [onNavigate, onOpenChange]
  );

  const commands: CommandItem[] = [
    // Navigation
    { id: "nav-dashboard", label: de.nav.dashboard, icon: LayoutDashboard, action: () => nav("/"), group: "Navigation" },
    { id: "nav-products", label: de.nav.products, icon: Package, action: () => nav("/products"), group: "Navigation" },
    { id: "nav-expenses", label: de.nav.expenses, icon: Receipt, action: () => nav("/expenses"), group: "Navigation" },
    { id: "nav-orders", label: de.nav.orders, icon: ShoppingCart, action: () => nav("/orders"), group: "Navigation" },
    { id: "nav-listings", label: de.nav.listings, icon: FileText, action: () => nav("/listings"), group: "Navigation" },
    { id: "nav-templates", label: de.nav.templates, icon: FileStack, action: () => nav("/templates"), group: "Navigation" },
    { id: "nav-files", label: de.nav.files, icon: FolderOpen, action: () => nav("/files"), group: "Navigation" },
    { id: "nav-tasks", label: de.nav.tasks, icon: CheckSquare, action: () => nav("/tasks"), group: "Navigation" },
    { id: "nav-analytics", label: de.nav.analytics, icon: BarChart3, action: () => nav("/analytics"), group: "Navigation" },
    { id: "nav-ai", label: de.nav.aiAssistant, icon: Sparkles, action: () => nav("/ai-assistant"), group: "Navigation" },
    { id: "nav-settings", label: de.nav.settings, icon: Settings, action: () => nav("/settings"), group: "Navigation" },
    // Quick actions
    { id: "new-product", label: "Neues Produkt", description: "Produkt erstellen", icon: Plus, action: () => nav("/products"), group: "Aktionen" },
    { id: "new-order", label: "Neuer Auftrag", description: "Auftrag erfassen", icon: Plus, action: () => nav("/orders"), group: "Aktionen" },
    { id: "new-expense", label: "Neue Ausgabe", description: "Ausgabe erfassen", icon: Plus, action: () => nav("/expenses"), group: "Aktionen" },
    { id: "new-task", label: "Neue Aufgabe", description: "Aufgabe erstellen", icon: Plus, action: () => nav("/tasks"), group: "Aktionen" },
    { id: "new-listing", label: "Neues Listing", description: "Listing erstellen", icon: Plus, action: () => nav("/listings"), group: "Aktionen" },
  ];

  const filtered = query.trim()
    ? commands.filter(
        (c) =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          (c.description?.toLowerCase().includes(query.toLowerCase()) ?? false)
      )
    : commands;

  // Group by category
  const groups = filtered.reduce<Record<string, CommandItem[]>>((acc, cmd) => {
    if (!acc[cmd.group]) acc[cmd.group] = [];
    acc[cmd.group].push(cmd);
    return acc;
  }, {});

  const flatItems = Object.values(groups).flat();

  // Reset selection on query change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selected = listRef.current.querySelector('[data-selected="true"]');
      selected?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (flatItems[selectedIndex]) {
          flatItems[selectedIndex].action();
        }
        break;
      case "Escape":
        onOpenChange(false);
        break;
    }
  }

  let itemIndex = -1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px] gap-0 overflow-hidden p-0" hideCloseButton>
        {/* Search input */}
        <div className="flex items-center gap-2 border-b border-[--border] px-3">
          <Search className="size-4 shrink-0 text-[--muted-foreground]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Suchen oder Befehl eingeben..."
            className="h-11 flex-1 bg-transparent text-sm text-[--foreground] outline-none placeholder:text-[--muted-foreground]"
          />
          <kbd className="rounded border border-[--border] bg-[--muted] px-1.5 py-0.5 font-mono text-[10px] text-[--muted-foreground]">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[320px] overflow-y-auto py-1">
          {flatItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[--muted-foreground]">
              Keine Ergebnisse gefunden.
            </div>
          ) : (
            Object.entries(groups).map(([group, items]) => (
              <div key={group}>
                <div className="px-3 py-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[--muted-foreground]">
                    {group}
                  </span>
                </div>
                {items.map((item) => {
                  itemIndex++;
                  const isSelected = itemIndex === selectedIndex;
                  const Icon = item.icon;
                  const idx = itemIndex; // capture for closure
                  return (
                    <button
                      key={item.id}
                      data-selected={isSelected}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors",
                        isSelected
                          ? "bg-[--accent-primary-subtle] text-[--foreground]"
                          : "text-[--foreground] hover:bg-[--muted]"
                      )}
                      onClick={() => item.action()}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <Icon className="size-4 shrink-0 text-[--muted-foreground]" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.description && (
                        <span className="text-xs text-[--muted-foreground]">
                          {item.description}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
