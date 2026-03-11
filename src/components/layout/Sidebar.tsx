import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";

interface NavItem {
  key: string;
  label: string;
  icon: React.ElementType;
  href: string;
}

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
        "group flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors duration-150 no-select",
        "hover:bg-[--border] hover:text-[--foreground]",
        active
          ? "bg-[--border] text-[--foreground]"
          : "text-[--muted-foreground]",
        collapsed && "justify-center px-0"
      )}
    >
      <Icon
        className={cn(
          "shrink-0 transition-colors",
          active ? "text-[--foreground]" : "text-[--muted-foreground] group-hover:text-[--foreground]",
          collapsed ? "size-5" : "size-4"
        )}
      />
      {!collapsed && (
        <span className="truncate">{item.label}</span>
      )}
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

interface SidebarProps {
  activeRoute?: string;
  onNavigate?: (href: string) => void;
}

export function Sidebar({ activeRoute = "/", onNavigate }: SidebarProps) {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  return (
    <aside
      className={cn(
        "relative flex h-full flex-col border-r border-[--border] bg-[--sidebar-background] transition-[width] duration-200 ease-in-out shrink-0",
        sidebarCollapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo / Wordmark */}
      <div
        className={cn(
          "flex h-12 items-center border-b border-[--border] no-select",
          sidebarCollapsed ? "justify-center px-0" : "gap-2.5 px-4"
        )}
        data-tauri-drag-region
      >
        <Hexagon className="size-5 shrink-0 text-[--foreground]" strokeWidth={1.5} />
        {!sidebarCollapsed && (
          <span className="text-sm font-semibold tracking-tight text-[--foreground]">
            PolyGrid Studio
          </span>
        )}
      </div>

      {/* Primary navigation */}
      <nav className={cn("flex-1 overflow-y-auto py-3", sidebarCollapsed ? "px-2" : "px-3")}>
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

      {/* Separator */}
      <div className={cn("px-3", sidebarCollapsed && "px-2")}>
        <Separator />
      </div>

      {/* Secondary navigation */}
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

      {/* Collapse toggle */}
      <div className={cn("border-t border-[--border] p-2", sidebarCollapsed ? "flex justify-center" : "")}>
        <button
          onClick={toggleSidebar}
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-2 text-xs text-[--muted-foreground] transition-colors hover:bg-[--border] hover:text-[--foreground] no-select",
            sidebarCollapsed ? "justify-center w-full" : "w-full"
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
