import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUIStore } from "@/stores/ui.store";
import de from "@/i18n/de.json";
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
  PanelLeftClose,
  PanelLeftOpen,
  Hexagon,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  key: string;
  label: string;
  icon: React.ElementType;
  href: string;
}

type Theme = "light" | "dark" | "system";

// ─── Navigation config ────────────────────────────────────────────────────────

const primaryNav: NavItem[] = [
  { key: "dashboard", label: de.nav.dashboard, icon: LayoutDashboard, href: "/" },
  { key: "products", label: de.nav.products, icon: Package, href: "/products" },
  { key: "expenses", label: de.nav.expenses, icon: Receipt, href: "/expenses" },
  { key: "orders", label: de.nav.orders, icon: ShoppingCart, href: "/orders" },
  { key: "listings", label: de.nav.listings, icon: FileText, href: "/listings" },
  { key: "templates", label: de.nav.templates, icon: FileStack, href: "/templates" },
  { key: "files", label: de.nav.files, icon: FolderOpen, href: "/files" },
  { key: "tasks", label: de.nav.tasks, icon: CheckSquare, href: "/tasks" },
  { key: "analytics", label: de.nav.analytics, icon: BarChart3, href: "/analytics" },
];

const secondaryNav: NavItem[] = [
  { key: "aiAssistant", label: de.nav.aiAssistant, icon: Sparkles, href: "/ai-assistant" },
  { key: "settings", label: de.nav.settings, icon: Settings, href: "/settings" },
];

const themeOptions: { value: Theme; icon: React.ElementType; label: string }[] = [
  { value: "light", icon: Sun, label: de.theme.light },
  { value: "system", icon: Monitor, label: de.theme.system },
  { value: "dark", icon: Moon, label: de.theme.dark },
];

// ─── SidebarNavItem ───────────────────────────────────────────────────────────

interface SidebarNavItemProps {
  item: NavItem;
  collapsed: boolean;
  active?: boolean;
  onClick?: () => void;
}

function SidebarNavItem({ item, collapsed, active = false, onClick }: SidebarNavItemProps) {
  const Icon = item.icon;

  const itemContent = (
    <button
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 rounded-md px-2 py-[7px] text-sm font-medium transition-colors duration-100 no-select",
        active
          ? "bg-[--sidebar-active-bg] text-[--sidebar-active-fg]"
          : "text-[--sidebar-fg-muted] hover:bg-[--sidebar-hover-bg] hover:text-[--sidebar-fg]",
        collapsed && "justify-center px-0"
      )}
    >
      <Icon
        className={cn(
          "shrink-0 transition-colors",
          active
            ? "text-[--sidebar-active-fg]"
            : "text-[--sidebar-fg-muted] group-hover:text-[--sidebar-fg]",
          collapsed ? "size-[18px]" : "size-4"
        )}
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </button>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>{itemContent}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  }

  return itemContent;
}

// ─── ThemeSwitcher ────────────────────────────────────────────────────────────

function ThemeSwitcher({ collapsed }: { collapsed: boolean }) {
  const { theme, setTheme } = useUIStore();

  // Collapsed: single cycling button
  if (collapsed) {
    const current = themeOptions.find((o) => o.value === theme) ?? themeOptions[1];
    const Icon = current.icon;
    const nextTheme = themeOptions[(themeOptions.indexOf(current) + 1) % themeOptions.length].value;

    return (
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <button
            onClick={() => setTheme(nextTheme)}
            className="flex w-full justify-center rounded-md py-2 text-[--sidebar-fg-muted] transition-colors hover:bg-[--sidebar-hover-bg] hover:text-[--sidebar-fg] no-select"
            aria-label={de.theme.label}
          >
            <Icon className="size-[18px]" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          {de.theme.label}: {current.label}
        </TooltipContent>
      </Tooltip>
    );
  }

  // Expanded: segmented 3-button row
  return (
    <div className="flex items-center gap-1 rounded-md bg-[--sidebar-hover-bg] p-1">
      {themeOptions.map(({ value, icon: Icon, label }) => (
        <Tooltip key={value} delayDuration={400}>
          <TooltipTrigger asChild>
            <button
              onClick={() => setTheme(value)}
              aria-label={label}
              className={cn(
                "flex flex-1 items-center justify-center rounded py-1.5 transition-colors no-select",
                theme === value
                  ? "bg-[--sidebar-active-bg] text-[--sidebar-active-fg]"
                  : "text-[--sidebar-fg-muted] hover:text-[--sidebar-fg]"
              )}
            >
              <Icon className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

// ─── Sidebar divider ──────────────────────────────────────────────────────────

function SidebarDivider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-[--sidebar-border]", className)} />;
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

interface SidebarProps {
  activeRoute?: string;
  onNavigate?: (href: string) => void;
}

export function Sidebar({ activeRoute = "/", onNavigate }: SidebarProps) {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  return (
    <aside
      className={cn(
        "relative flex h-full shrink-0 flex-col bg-[--sidebar-bg] transition-[width] duration-200 ease-in-out",
        // Right border using sidebar-border color
        "border-r border-[--sidebar-border]",
        sidebarCollapsed ? "w-16" : "w-60"
      )}
    >
      {/* ── Logo / Wordmark ─────────────────────────────────────────────── */}
      <div
        className={cn(
          "flex h-12 shrink-0 items-center border-b border-[--sidebar-border] no-select",
          sidebarCollapsed ? "justify-center" : "gap-2.5 px-4"
        )}
        data-tauri-drag-region
      >
        <Hexagon
          className="size-5 shrink-0 text-[--sidebar-logo-fg]"
          strokeWidth={1.5}
        />
        {!sidebarCollapsed && (
          <span className="text-sm font-semibold tracking-tight text-[--sidebar-logo-fg]">
            PolyGrid Studio
          </span>
        )}
      </div>

      {/* ── Primary navigation ──────────────────────────────────────────── */}
      <nav
        className={cn(
          "sidebar-scroll flex-1 overflow-y-auto py-3",
          sidebarCollapsed ? "px-2" : "px-3"
        )}
      >
        <ul className="space-y-0.5">
          {primaryNav.map((item) => (
            <li key={item.key}>
              <SidebarNavItem
                item={item}
                collapsed={sidebarCollapsed}
                active={activeRoute === item.href}
                onClick={() => onNavigate?.(item.href)}
              />
            </li>
          ))}
        </ul>
      </nav>

      {/* ── Secondary navigation ────────────────────────────────────────── */}
      <div className={cn(sidebarCollapsed ? "px-2" : "px-3")}>
        <SidebarDivider />
      </div>
      <nav className={cn("py-3", sidebarCollapsed ? "px-2" : "px-3")}>
        <ul className="space-y-0.5">
          {secondaryNav.map((item) => (
            <li key={item.key}>
              <SidebarNavItem
                item={item}
                collapsed={sidebarCollapsed}
                active={activeRoute === item.href}
                onClick={() => onNavigate?.(item.href)}
              />
            </li>
          ))}
        </ul>
      </nav>

      {/* ── Theme switcher ──────────────────────────────────────────────── */}
      <div className={cn(sidebarCollapsed ? "px-2" : "px-3")}>
        <SidebarDivider />
      </div>
      <div className={cn("py-2.5", sidebarCollapsed ? "px-2" : "px-3")}>
        <ThemeSwitcher collapsed={sidebarCollapsed} />
      </div>

      {/* ── Collapse toggle ─────────────────────────────────────────────── */}
      <div className={cn(sidebarCollapsed ? "px-2" : "px-3")}>
        <SidebarDivider />
      </div>
      <div className={cn("py-2", sidebarCollapsed ? "px-2" : "px-3")}>
        <button
          onClick={toggleSidebar}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-2 text-xs text-[--sidebar-fg-muted] transition-colors hover:bg-[--sidebar-hover-bg] hover:text-[--sidebar-fg] no-select",
            sidebarCollapsed && "justify-center"
          )}
          title={sidebarCollapsed ? "Sidebar erweitern" : "Sidebar einklappen"}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <>
              <PanelLeftClose className="size-4 shrink-0" />
              <span>Einklappen</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
