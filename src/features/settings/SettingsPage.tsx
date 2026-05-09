import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useNavigate, useParams } from '@tanstack/react-router';
import { Monitor, Moon, Package, Palette, Settings, Shield, Sparkles, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import { DEFAULTS, getSettingWithDefault } from '@/services/settings';
import type { AccentColor, Theme } from '@/types';
import { ACCENT_PRESETS, type AccentPresetKey } from '@/utils/colors';
import { useAutoSave } from './hooks/useAutoSave';

type SettingsTab = 'general' | 'materials' | 'ai' | 'brand' | 'data';
type Language = 'de' | 'en';
type DateFormat = 'DD.MM.YYYY' | 'YYYY-MM-DD';

interface GeneralSettingsState {
  companyName: string;
  language: Language;
  dateFormat: DateFormat;
  oneDrivePath: string;
  autoSnapshot: boolean;
  marginWarningThreshold: number;
}

interface TabConfig {
  id: SettingsTab;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
}

const TABS: TabConfig[] = [
  { id: 'general', label: 'Allgemein', icon: Settings },
  { id: 'materials', label: 'Material & Plattformen', icon: Package },
  { id: 'ai', label: 'KI-Konfiguration', icon: Sparkles },
  { id: 'brand', label: 'Markenstil', icon: Palette },
  { id: 'data', label: 'Daten & Sicherheit', icon: Shield },
];

const VALID_TABS = new Set<SettingsTab>(TABS.map((tab) => tab.id));

const THEME_OPTIONS: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Hell', icon: Sun },
  { value: 'dark', label: 'Dunkel', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

const EMPTY_GENERAL_SETTINGS: GeneralSettingsState = {
  companyName: DEFAULTS.company_name,
  language: DEFAULTS.language,
  dateFormat: DEFAULTS.date_format,
  oneDrivePath: DEFAULTS.onedrive_root_path,
  autoSnapshot: DEFAULTS.dashboard_auto_snapshot,
  marginWarningThreshold: DEFAULTS.margin_warning_threshold,
};

function isSettingsTab(value: string | undefined): value is SettingsTab {
  return value !== undefined && VALID_TABS.has(value as SettingsTab);
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-bg-elevated p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-text-primary">{title}</h2>
        {description ? <p className="mt-1 text-sm text-text-secondary">{description}</p> : null}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[220px_1fr] sm:items-start">
      <div className="space-y-1 pt-1">
        <Label className="text-sm font-medium text-text-primary">{label}</Label>
        {hint ? <p className="text-xs leading-5 text-text-secondary">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

function SwitchControl({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className="flex w-fit items-center gap-3 rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary transition-colors hover:bg-bg-hover"
    >
      <span
        className={cn(
          'relative h-5 w-9 rounded-full transition-colors',
          checked ? 'bg-pg-accent' : 'bg-bg-hover',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0.5',
          )}
        />
      </span>
      {label}
    </button>
  );
}

function PlaceholderTab({ tab }: { tab: TabConfig }) {
  const Icon = tab.icon;
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-bg-elevated p-8 text-center">
      <Icon size={28} className="mb-3 text-pg-accent" />
      <h2 className="text-lg font-semibold text-text-primary">{tab.label}</h2>
      <p className="mt-2 text-sm text-text-secondary">
        Wird in einer späteren Session implementiert
      </p>
    </div>
  );
}

export function SettingsPage() {
  const params = useParams({ strict: false }) as { tab?: string };
  const navigate = useNavigate();
  const activeTab: SettingsTab = isSettingsTab(params.tab) ? params.tab : 'general';
  const { theme, accentColor, changeTheme, changeAccentColor } = useTheme();
  const { scheduleSave } = useAutoSave();
  const [settings, setSettings] = useState<GeneralSettingsState>(EMPTY_GENERAL_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [pathExists, setPathExists] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isSettingsTab(params.tab)) {
      void navigate({ to: '/settings/$tab', params: { tab: 'general' }, replace: true });
    }
  }, [navigate, params.tab]);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      setIsLoading(true);
      try {
        const [
          companyName,
          language,
          dateFormat,
          oneDriveRootPath,
          oneDriveBasePath,
          autoSnapshot,
          marginWarningThreshold,
        ] = await Promise.all([
          getSettingWithDefault('company_name'),
          getSettingWithDefault('language'),
          getSettingWithDefault('date_format'),
          getSettingWithDefault('onedrive_root_path'),
          getSettingWithDefault('onedrive_base_path'),
          getSettingWithDefault('dashboard_auto_snapshot'),
          getSettingWithDefault('margin_warning_threshold'),
        ]);

        if (cancelled) return;
        setSettings({
          companyName,
          language,
          dateFormat,
          oneDrivePath: oneDriveRootPath || oneDriveBasePath,
          autoSnapshot,
          marginWarningThreshold,
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Einstellungen konnten nicht geladen werden',
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkOneDrivePath(path: string) {
      if (!path.trim()) {
        setPathExists(null);
        return;
      }

      try {
        const exists = await invoke<boolean>('check_path_exists', { path, basePath: null });
        if (!cancelled) setPathExists(exists);
      } catch {
        if (!cancelled) setPathExists(false);
      }
    }

    void checkOneDrivePath(settings.oneDrivePath);
    return () => {
      cancelled = true;
    };
  }, [settings.oneDrivePath]);

  const activeTabConfig = useMemo(
    () => TABS.find((tab) => tab.id === activeTab) ?? TABS[0],
    [activeTab],
  );

  const updateSetting = useCallback(
    <K extends keyof GeneralSettingsState>(
      key: K,
      value: GeneralSettingsState[K],
      settingKey: string,
      aliases: string[] = [],
    ) => {
      setSettings((current) => ({ ...current, [key]: value }));
      scheduleSave(settingKey, value, { aliases });
    },
    [scheduleSave],
  );

  async function handleFolderChange() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'OneDrive-Ordner auswählen',
      });
      if (!selected || Array.isArray(selected)) return;

      updateSetting('oneDrivePath', selected, 'onedrive_root_path', ['onedrive_base_path']);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ordnerauswahl konnte nicht öffnen');
    }
  }

  async function handleThemeChange(nextTheme: Theme) {
    await changeTheme(nextTheme);
    scheduleSave('theme', nextTheme);
  }

  async function handleAccentChange(nextAccentColor: AccentColor) {
    await changeAccentColor(nextAccentColor);
    scheduleSave('accent_color', nextAccentColor);
  }

  function renderGeneralTab() {
    if (isLoading) {
      return <div className="text-sm text-text-secondary">Einstellungen werden geladen...</div>;
    }

    return (
      <div className="space-y-5">
        <SettingsSection title="Grundeinstellungen">
          <FieldRow label="Firmenname / Shopname">
            <Input
              value={settings.companyName}
              onChange={(event) => updateSetting('companyName', event.target.value, 'company_name')}
            />
          </FieldRow>

          <FieldRow label="Sprache" hint="Ändert die App-Sprache (Neustart erforderlich)">
            <Select
              value={settings.language}
              onValueChange={(value) => updateSetting('language', value as Language, 'language')}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="de">Deutsch</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>

          <FieldRow label="Datumsformat">
            <Select
              value={settings.dateFormat}
              onValueChange={(value) =>
                updateSetting('dateFormat', value as DateFormat, 'date_format')
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DD.MM.YYYY">TT.MM.JJJJ</SelectItem>
                <SelectItem value="YYYY-MM-DD">JJJJ-MM-TT</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
        </SettingsSection>

        <SettingsSection title="Erscheinungsbild">
          <FieldRow label="Theme">
            <div className="flex flex-wrap gap-2">
              {THEME_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isActive = theme === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => void handleThemeChange(option.value)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'border-pg-accent bg-pg-accent-subtle text-text-primary'
                        : 'border-border bg-bg-primary text-text-secondary hover:bg-bg-hover',
                    )}
                  >
                    <Icon size={16} />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </FieldRow>

          <FieldRow label="Akzentfarbe">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(
                Object.entries(ACCENT_PRESETS) as [
                  AccentPresetKey,
                  (typeof ACCENT_PRESETS)[AccentPresetKey],
                ][]
              ).map(([key, preset]) => {
                const isActive = accentColor === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => void handleAccentChange(key as AccentColor)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border bg-bg-primary px-3 py-2 text-sm text-text-primary transition-colors hover:bg-bg-hover',
                      isActive
                        ? 'border-pg-accent ring-2 ring-offset-2 ring-offset-bg-elevated'
                        : 'border-border',
                    )}
                    style={
                      isActive ? ({ '--tw-ring-color': preset.light } as CSSProperties) : undefined
                    }
                  >
                    <span
                      className="size-4 rounded-full border border-border"
                      style={{ backgroundColor: preset.light }}
                    />
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </FieldRow>
        </SettingsSection>

        <SettingsSection title="OneDrive-Ordner">
          <FieldRow label="Aktueller Pfad">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input value={settings.oneDrivePath} readOnly placeholder="Kein Ordner ausgewählt" />
              <Button type="button" variant="outline" onClick={() => void handleFolderChange()}>
                Ordner ändern
              </Button>
            </div>
          </FieldRow>

          <FieldRow label="Status">
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <span
                className={cn(
                  'size-2.5 rounded-full',
                  pathExists === true && 'bg-success',
                  pathExists === false && 'bg-danger',
                  pathExists === null && 'bg-text-muted',
                )}
              />
              {pathExists === true && 'Ordner erreichbar'}
              {pathExists === false && 'Ordner nicht erreichbar'}
              {pathExists === null && 'Kein Ordner konfiguriert'}
            </div>
          </FieldRow>
        </SettingsSection>

        <SettingsSection title="Dashboard">
          <FieldRow label="Auto-Snapshot">
            <SwitchControl
              checked={settings.autoSnapshot}
              label={settings.autoSnapshot ? 'Aktiv' : 'Inaktiv'}
              onCheckedChange={(checked) =>
                updateSetting('autoSnapshot', checked, 'dashboard_auto_snapshot', [
                  'dashboard_kpi_snapshot_auto',
                ])
              }
            />
          </FieldRow>

          <FieldRow label="Schwache-Marge-Schwellwert">
            <div className="relative max-w-40">
              <Input
                type="number"
                min={0}
                max={100}
                value={settings.marginWarningThreshold}
                className="pr-8"
                onChange={(event) =>
                  updateSetting(
                    'marginWarningThreshold',
                    Number(event.target.value),
                    'margin_warning_threshold',
                    ['dashboard_low_margin_threshold'],
                  )
                }
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-secondary">
                %
              </span>
            </div>
          </FieldRow>
        </SettingsSection>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-bg-primary">
      <aside className="w-[200px] shrink-0 border-r border-border-subtle bg-bg-secondary p-3">
        <div className="mb-4 px-2 py-2">
          <h1 className="text-lg font-semibold text-text-primary">Einstellungen</h1>
          <p className="mt-1 text-xs text-text-secondary">Konfiguration und Systemverhalten</p>
        </div>
        <nav className="space-y-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => void navigate({ to: '/settings/$tab', params: { tab: tab.id } })}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                  isActive
                    ? 'bg-pg-accent-subtle font-medium text-text-primary'
                    : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
                )}
              >
                <Icon size={16} className={isActive ? 'text-pg-accent' : undefined} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-[800px]">
          {activeTab === 'general' ? renderGeneralTab() : <PlaceholderTab tab={activeTabConfig} />}
        </div>
      </main>
    </div>
  );
}
