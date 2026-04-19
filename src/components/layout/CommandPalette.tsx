import { useEffect, useMemo } from 'react';
import { Command } from 'cmdk';
import { useRouter } from '@tanstack/react-router';
import { useUIStore, type Command as CommandType } from '@/stores';
import { useTheme } from '@/hooks/useTheme';
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
  Sun,
  Moon,
  Monitor,
  Palette,
  PanelLeftClose,
} from 'lucide-react';

const CATEGORY_LABELS: Record<CommandType['category'], string> = {
  navigation: 'Navigation',
  system: 'System',
  action: 'Aktionen',
  ai: 'KI',
};

/**
 * Command Palette – öffnet sich mit Cmd/Ctrl+K.
 * Nutzt cmdk (pacocoursey/cmdk) mit dem Command Registry aus dem UI Store.
 * Erweiterbar: Jedes Feature-Modul registriert eigene Commands über registerCommands().
 */
export function CommandPalette() {
  const open = useUIStore((s) => s.commandPaletteOpen);
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const commands = useUIStore((s) => s.commands);
  const registerCommands = useUIStore((s) => s.registerCommands);
  const router = useRouter();
  const { changeTheme, changeAccentColor } = useTheme();

  // Foundation-Commands beim ersten Rendern registrieren
  useEffect(() => {
    const navCommands: CommandType[] = [
      {
        id: 'nav-dashboard',
        label: 'Zu Dashboard',
        icon: LayoutDashboard,
        category: 'navigation',
        shortcut: '⌘1',
        action: () => void router.navigate({ to: '/' }),
      },
      {
        id: 'nav-products',
        label: 'Zu Produkte',
        icon: Package,
        category: 'navigation',
        shortcut: '⌘2',
        action: () => void router.navigate({ to: '/products' }),
      },
      {
        id: 'nav-expenses',
        label: 'Zu Ausgaben',
        icon: Receipt,
        category: 'navigation',
        shortcut: '⌘3',
        action: () => void router.navigate({ to: '/expenses' }),
      },
      {
        id: 'nav-orders',
        label: 'Zu Aufträge',
        icon: ShoppingCart,
        category: 'navigation',
        shortcut: '⌘4',
        action: () => void router.navigate({ to: '/orders' }),
      },
      {
        id: 'nav-listings',
        label: 'Zu Listings',
        icon: FileText,
        category: 'navigation',
        shortcut: '⌘5',
        action: () => void router.navigate({ to: '/listings' }),
      },
      {
        id: 'nav-templates',
        label: 'Zu Vorlagen',
        icon: FileStack,
        category: 'navigation',
        shortcut: '⌘6',
        action: () => void router.navigate({ to: '/templates' }),
      },
      {
        id: 'nav-files',
        label: 'Zu Dateien',
        icon: FolderOpen,
        category: 'navigation',
        shortcut: '⌘7',
        action: () => void router.navigate({ to: '/files' }),
      },
      {
        id: 'nav-tasks',
        label: 'Zu Aufgaben',
        icon: CheckSquare,
        category: 'navigation',
        shortcut: '⌘8',
        action: () => void router.navigate({ to: '/tasks' }),
      },
      {
        id: 'nav-analytics',
        label: 'Zu Analysen',
        icon: BarChart3,
        category: 'navigation',
        shortcut: '⌘9',
        action: () => void router.navigate({ to: '/analytics' }),
      },
      {
        id: 'nav-ai',
        label: 'Zu KI-Assistent',
        icon: Sparkles,
        category: 'navigation',
        shortcut: '⌘/',
        action: () => void router.navigate({ to: '/ai' }),
      },
      {
        id: 'nav-settings',
        label: 'Zu Einstellungen',
        icon: Settings,
        category: 'navigation',
        action: () => void router.navigate({ to: '/settings' }),
      },
    ];

    const systemCommands: CommandType[] = [
      {
        id: 'sys-theme-light',
        label: 'Theme: Hell',
        icon: Sun,
        category: 'system',
        action: () => void changeTheme('light'),
      },
      {
        id: 'sys-theme-dark',
        label: 'Theme: Dunkel',
        icon: Moon,
        category: 'system',
        action: () => void changeTheme('dark'),
      },
      {
        id: 'sys-theme-system',
        label: 'Theme: System',
        icon: Monitor,
        category: 'system',
        action: () => void changeTheme('system'),
      },
      {
        id: 'sys-accent-sap_blue',
        label: 'Akzent: SAP-Blau',
        icon: Palette,
        category: 'system',
        action: () => void changeAccentColor('sap_blue'),
      },
      {
        id: 'sys-accent-indigo',
        label: 'Akzent: Indigo',
        icon: Palette,
        category: 'system',
        action: () => void changeAccentColor('indigo'),
      },
      {
        id: 'sys-accent-petrol',
        label: 'Akzent: Petrol',
        icon: Palette,
        category: 'system',
        action: () => void changeAccentColor('petrol'),
      },
      {
        id: 'sys-accent-orange',
        label: 'Akzent: Orange',
        icon: Palette,
        category: 'system',
        action: () => void changeAccentColor('orange'),
      },
      {
        id: 'sys-accent-violet',
        label: 'Akzent: Violett',
        icon: Palette,
        category: 'system',
        action: () => void changeAccentColor('violet'),
      },
      {
        id: 'sys-accent-graphite',
        label: 'Akzent: Graphit',
        icon: Palette,
        category: 'system',
        action: () => void changeAccentColor('graphite'),
      },
      {
        id: 'sys-sidebar-toggle',
        label: 'Sidebar ein-/ausklappen',
        icon: PanelLeftClose,
        category: 'system',
        shortcut: '⌘B',
        action: () => useUIStore.getState().toggleSidebar(),
      },
    ];

    registerCommands([...navCommands, ...systemCommands]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Commands nach Kategorie gruppieren
  const grouped = useMemo(() => {
    const map = new Map<CommandType['category'], CommandType[]>();
    for (const cmd of commands) {
      const list = map.get(cmd.category) ?? [];
      list.push(cmd);
      map.set(cmd.category, list);
    }
    return map;
  }, [commands]);

  function handleSelect(cmd: CommandType) {
    setOpen(false);
    // Kurze Verzögerung, damit das Dialog-Closing nicht mit Navigation kollidiert
    requestAnimationFrame(() => cmd.action());
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command Palette"
      className="fixed inset-0 z-50"
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setOpen(false)} />

      {/* Dialog-Container */}
      <div className="fixed top-[20%] left-1/2 z-50 w-full max-w-lg -translate-x-1/2">
        <div className="mx-4 overflow-hidden rounded-xl border border-border-subtle bg-bg-elevated shadow-lg dark:border-transparent dark:bg-bg-elevated-3">
          {/* Suchfeld */}
          <Command.Input
            placeholder="Befehl suchen…"
            className="w-full border-b border-border-subtle bg-transparent px-4 py-3 text-sm text-text-primary outline-none placeholder:text-text-muted"
          />

          {/* Ergebnisliste */}
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="px-4 py-8 text-center text-sm text-text-muted">
              Kein Ergebnis gefunden.
            </Command.Empty>

            {Array.from(grouped.entries()).map(([category, cmds]) => (
              <Command.Group
                key={category}
                heading={CATEGORY_LABELS[category]}
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-text-muted"
              >
                {cmds.map((cmd) => {
                  const Icon = cmd.icon;
                  return (
                    <Command.Item
                      key={cmd.id}
                      value={cmd.label}
                      onSelect={() => handleSelect(cmd)}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm text-text-secondary data-[selected=true]:bg-bg-hover data-[selected=true]:text-text-primary"
                    >
                      {Icon && <Icon size={16} className="shrink-0 text-text-muted" />}
                      <span className="flex-1">{cmd.label}</span>
                      {cmd.shortcut && (
                        <kbd className="ml-auto text-xs text-text-muted">{cmd.shortcut}</kbd>
                      )}
                    </Command.Item>
                  );
                })}
              </Command.Group>
            ))}
          </Command.List>
        </div>
      </div>
    </Command.Dialog>
  );
}
