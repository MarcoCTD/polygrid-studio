import { useRouter, useMatches } from '@tanstack/react-router';
import { useUIStore } from '@/stores';
import { cn } from '@/lib/utils';
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
  Wallet,
  Sparkles,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  label: string;
  icon: LucideIcon;
  route: string;
  badge?: number;
  badgeTone?: 'default' | 'danger';
}

const mainNavItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, route: '/' },
  { label: 'Produkte', icon: Package, route: '/products' },
  { label: 'Ausgaben', icon: Receipt, route: '/expenses' },
  { label: 'Aufträge', icon: ShoppingCart, route: '/orders' },
  { label: 'Listings', icon: FileText, route: '/listings' },
  { label: 'Vorlagen', icon: FileStack, route: '/templates' },
  { label: 'Dateien', icon: FolderOpen, route: '/files' },
  { label: 'Aufgaben', icon: CheckSquare, route: '/tasks' },
  { label: 'Analysen', icon: BarChart3, route: '/analytics' },
  { label: 'Finanzen', icon: Wallet, route: '/finance' },
];

const bottomNavItems: NavItem[] = [
  { label: 'KI-Assistent', icon: Sparkles, route: '/ai' },
  { label: 'Einstellungen', icon: Settings, route: '/settings' },
];

function NavButton({
  item,
  isActive,
  collapsed,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
}) {
  const router = useRouter();
  const Icon = item.icon;

  return (
    <button
      onClick={() => void router.navigate({ to: item.route })}
      className={cn(
        'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
        collapsed && 'justify-center px-0',
        isActive
          ? 'bg-pg-accent-subtle text-text-primary font-medium'
          : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
      )}
    >
      {/* Aktiv-Indikator: 3px linker Strich */}
      {isActive && (
        <div className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-pg-accent" />
      )}

      <Icon
        size={20}
        className={cn(
          'shrink-0',
          isActive ? 'text-pg-accent' : 'text-text-secondary group-hover:text-text-primary',
        )}
      />

      {!collapsed && (
        <>
          <span className="truncate">{item.label}</span>
          {item.badge !== undefined && item.badge > 0 && (
            <span
              className={cn(
                'ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium text-white',
                item.badgeTone === 'danger' ? 'bg-danger' : 'bg-pg-accent',
              )}
            >
              {item.badge}
            </span>
          )}
        </>
      )}

      {collapsed && item.badge !== undefined && item.badge > 0 && (
        <span
          className={cn(
            'absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white',
            item.badgeTone === 'danger' ? 'bg-danger' : 'bg-pg-accent',
          )}
        >
          {item.badge > 9 ? '9+' : item.badge}
        </span>
      )}
    </button>
  );
}

export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const openOrdersCount = useUIStore((s) => s.openOrdersCount);
  const overdueTasksCount = useUIStore((s) => s.overdueTasksCount);
  const matches = useMatches();
  const currentPath = matches[matches.length - 1]?.fullPath ?? '/';
  const navItems = mainNavItems.map((item) => {
    if (item.route === '/orders') return { ...item, badge: openOrdersCount };
    if (item.route === '/tasks') {
      return { ...item, badge: overdueTasksCount, badgeTone: 'danger' as const };
    }
    return item;
  });

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-border-subtle bg-bg-secondary transition-all duration-200 ease-in-out',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Logo / App-Name */}
      <div
        className={cn(
          'flex h-14 items-center border-b border-border-subtle px-4',
          collapsed && 'justify-center px-0',
        )}
      >
        {!collapsed && <span className="text-base font-semibold text-text-primary">PolyGrid</span>}
        {collapsed && <span className="text-base font-semibold text-pg-accent">P</span>}
      </div>

      {/* Hauptnavigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => (
          <NavButton
            key={item.route}
            item={item}
            isActive={currentPath === item.route}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* Unterer Bereich */}
      <div className="space-y-1 border-t border-border-subtle p-3">
        {bottomNavItems.map((item) => (
          <NavButton
            key={item.route}
            item={item}
            isActive={currentPath === item.route}
            collapsed={collapsed}
          />
        ))}

        {/* Sidebar Toggle */}
        <button
          onClick={toggleSidebar}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary',
            collapsed && 'justify-center px-0',
          )}
        >
          {collapsed ? (
            <PanelLeftOpen size={20} className="shrink-0" />
          ) : (
            <PanelLeftClose size={20} className="shrink-0" />
          )}
          {!collapsed && <span>Einklappen</span>}
        </button>
      </div>
    </aside>
  );
}
