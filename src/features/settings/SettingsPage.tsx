import {
  useCallback,
  useEffect,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useNavigate, useParams } from '@tanstack/react-router';
import {
  Check,
  Edit2,
  Monitor,
  Moon,
  Package,
  Palette,
  Plus,
  Settings,
  Shield,
  Sparkles,
  Sun,
  Trash2,
  Zap,
} from 'lucide-react';
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
import { AutomationSettingsTab } from '@/features/playbooks/components';
import { AiSettingsTab } from './components/AiSettingsTab';
import { BrandSettingsTab } from './components/BrandSettingsTab';
import { DataSecuritySettingsTab } from './components/DataSecuritySettingsTab';
import { InvoiceSettingsSection } from './components/InvoiceSettingsSection';
import { NumberField } from './components/NumberField';
import { useAutoSave } from './hooks/useAutoSave';

type SettingsTab = 'general' | 'materials' | 'ai' | 'automation' | 'brand' | 'data';
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

interface MaterialPrice {
  id: string;
  name: string;
  pricePerKg: number;
}

interface ShippingClassSetting {
  id: string;
  name: string;
  price: number;
}

interface ColorVariantSetting {
  id: string;
  name: string;
  hex: string;
}

type PlatformKey = 'etsy' | 'ebay' | 'kleinanzeigen' | 'website';

interface PlatformFeeSetting {
  percentFee: number;
  fixedFee: number;
}

type PlatformFeesSetting = Record<PlatformKey, PlatformFeeSetting>;

interface MaterialsSettingsState {
  materials: MaterialPrice[];
  shippingClasses: ShippingClassSetting[];
  colorVariants: ColorVariantSetting[];
  printerPowerWatts: number;
  electricityPricePerKwh: number;
  shippingPaidByBuyer: boolean;
  platformFees: PlatformFeesSetting;
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
  { id: 'automation', label: 'Automatisierung', icon: Zap },
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

const EMPTY_MATERIALS_SETTINGS: MaterialsSettingsState = {
  materials: DEFAULTS.filament_prices.map((material) => ({
    id: crypto.randomUUID(),
    ...material,
  })),
  shippingClasses: DEFAULTS.shipping_classes.map((shippingClass) => ({
    id: crypto.randomUUID(),
    ...shippingClass,
  })),
  colorVariants: [],
  printerPowerWatts: DEFAULTS.printer_power_watts,
  electricityPricePerKwh: DEFAULTS.electricity_price_per_kwh,
  shippingPaidByBuyer: DEFAULTS.shipping_paid_by_buyer,
  platformFees: DEFAULTS.platform_fees,
};

const PLATFORM_LABELS: Record<PlatformKey, string> = {
  etsy: 'Etsy',
  ebay: 'eBay',
  kleinanzeigen: 'Kleinanzeigen',
  website: 'Website',
};

function isSettingsTab(value: string | undefined): value is SettingsTab {
  return value !== undefined && VALID_TABS.has(value as SettingsTab);
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeHex(value: string): string {
  const nextValue = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(nextValue)) return nextValue.toUpperCase();
  if (/^[0-9a-fA-F]{6}$/.test(nextValue)) return `#${nextValue.toUpperCase()}`;
  return '#000000';
}

function normalizeMaterials(value: unknown): MaterialPrice[] {
  if (Array.isArray(value)) {
    return value.map((item) => {
      const record = item as Record<string, unknown>;
      return {
        id: crypto.randomUUID(),
        name: String(record.name ?? ''),
        pricePerKg: numberValue(record.pricePerKg),
      };
    });
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).map(([name, price]) => ({
      id: crypto.randomUUID(),
      name,
      pricePerKg: numberValue(price),
    }));
  }

  return EMPTY_MATERIALS_SETTINGS.materials;
}

function normalizeShippingClasses(value: unknown): ShippingClassSetting[] {
  if (!Array.isArray(value)) return EMPTY_MATERIALS_SETTINGS.shippingClasses;
  return value.map((item) => {
    const record = item as Record<string, unknown>;
    return {
      id: crypto.randomUUID(),
      name: String(record.name ?? ''),
      price: numberValue(record.price),
    };
  });
}

function normalizeColorVariants(value: unknown): ColorVariantSetting[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const record = item as Record<string, unknown>;
    return {
      id: crypto.randomUUID(),
      name: String(record.name ?? ''),
      hex: normalizeHex(String(record.hex ?? '#000000')),
    };
  });
}

function normalizePlatformFees(value: unknown): PlatformFeesSetting {
  const defaults = DEFAULTS.platform_fees;
  if (!value || typeof value !== 'object') return defaults;

  const record = value as Record<string, Record<string, unknown>>;
  return (Object.keys(defaults) as PlatformKey[]).reduce<PlatformFeesSetting>(
    (result, platform) => {
      const fees = record[platform] ?? {};
      result[platform] = {
        percentFee: numberValue(fees.percentFee ?? fees.percent, defaults[platform].percentFee),
        fixedFee: numberValue(fees.fixedFee ?? fees.fixed, defaults[platform].fixedFee),
      };
      return result;
    },
    { ...defaults },
  );
}

function materialPayload(materials: MaterialPrice[]) {
  return materials
    .filter((material) => material.name.trim().length > 0)
    .map((material) => ({
      name: material.name.trim(),
      pricePerKg: numberValue(material.pricePerKg),
    }));
}

function shippingPayload(shippingClasses: ShippingClassSetting[]) {
  return shippingClasses
    .filter((shippingClass) => shippingClass.name.trim().length > 0)
    .map((shippingClass) => ({
      name: shippingClass.name.trim(),
      price: numberValue(shippingClass.price),
    }));
}

function colorPayload(colorVariants: ColorVariantSetting[]) {
  return colorVariants
    .filter((color) => color.name.trim().length > 0)
    .map((color) => ({
      name: color.name.trim(),
      hex: normalizeHex(color.hex),
    }));
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

export function SettingsPage() {
  const params = useParams({ strict: false }) as { tab?: string };
  const navigate = useNavigate();
  const activeTab: SettingsTab = isSettingsTab(params.tab) ? params.tab : 'general';
  const { theme, accentColor, changeTheme, changeAccentColor } = useTheme();
  const { scheduleSave } = useAutoSave();
  const [settings, setSettings] = useState<GeneralSettingsState>(EMPTY_GENERAL_SETTINGS);
  const [materialsSettings, setMaterialsSettings] =
    useState<MaterialsSettingsState>(EMPTY_MATERIALS_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [pathExists, setPathExists] = useState<boolean | null>(null);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [editingShippingClassId, setEditingShippingClassId] = useState<string | null>(null);
  const [editingColorId, setEditingColorId] = useState<string | null>(null);

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
          filamentPrices,
          printerPowerWatts,
          electricityPricePerKwh,
          shippingPaidByBuyer,
          shippingPaidByCustomerDefault,
          platformFees,
          shippingClasses,
          colorVariants,
        ] = await Promise.all([
          getSettingWithDefault('company_name'),
          getSettingWithDefault('language'),
          getSettingWithDefault('date_format'),
          getSettingWithDefault('onedrive_root_path'),
          getSettingWithDefault('onedrive_base_path'),
          getSettingWithDefault('dashboard_auto_snapshot'),
          getSettingWithDefault('margin_warning_threshold'),
          getSettingWithDefault('filament_prices'),
          getSettingWithDefault('printer_power_watts'),
          getSettingWithDefault('electricity_price_per_kwh'),
          getSettingWithDefault('shipping_paid_by_buyer'),
          getSettingWithDefault('shipping_paid_by_customer_default'),
          getSettingWithDefault('platform_fees'),
          getSettingWithDefault('shipping_classes'),
          getSettingWithDefault('color_variants_library'),
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
        setMaterialsSettings({
          materials: normalizeMaterials(filamentPrices),
          printerPowerWatts,
          electricityPricePerKwh,
          shippingPaidByBuyer: shippingPaidByBuyer ?? shippingPaidByCustomerDefault,
          platformFees: normalizePlatformFees(platformFees),
          shippingClasses: normalizeShippingClasses(shippingClasses),
          colorVariants: normalizeColorVariants(colorVariants),
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

  const updateMaterialsSetting = useCallback(
    <K extends keyof MaterialsSettingsState>(
      key: K,
      value: MaterialsSettingsState[K],
      settingKey: string,
      persistedValue: unknown = value,
      aliases: string[] = [],
    ) => {
      setMaterialsSettings((current) => ({ ...current, [key]: value }));
      scheduleSave(settingKey, persistedValue, { aliases });
    },
    [scheduleSave],
  );

  function commitMaterials(nextMaterials: MaterialPrice[]) {
    updateMaterialsSetting(
      'materials',
      nextMaterials,
      'filament_prices',
      materialPayload(nextMaterials),
    );
  }

  function commitShippingClasses(nextShippingClasses: ShippingClassSetting[]) {
    updateMaterialsSetting(
      'shippingClasses',
      nextShippingClasses,
      'shipping_classes',
      shippingPayload(nextShippingClasses),
    );
  }

  function commitColorVariants(nextColorVariants: ColorVariantSetting[]) {
    updateMaterialsSetting(
      'colorVariants',
      nextColorVariants,
      'color_variants_library',
      colorPayload(nextColorVariants),
    );
  }

  function updateMaterial(id: string, patch: Partial<MaterialPrice>) {
    setMaterialsSettings((current) => ({
      ...current,
      materials: current.materials.map((material) =>
        material.id === id ? { ...material, ...patch } : material,
      ),
    }));
  }

  function updateShippingClass(id: string, patch: Partial<ShippingClassSetting>) {
    setMaterialsSettings((current) => ({
      ...current,
      shippingClasses: current.shippingClasses.map((shippingClass) =>
        shippingClass.id === id ? { ...shippingClass, ...patch } : shippingClass,
      ),
    }));
  }

  function updateColorVariant(id: string, patch: Partial<ColorVariantSetting>) {
    setMaterialsSettings((current) => ({
      ...current,
      colorVariants: current.colorVariants.map((color) =>
        color.id === id ? { ...color, ...patch } : color,
      ),
    }));
  }

  function addMaterial() {
    const id = crypto.randomUUID();
    const nextMaterials = [...materialsSettings.materials, { id, name: '', pricePerKg: 0 }];
    setMaterialsSettings((current) => ({ ...current, materials: nextMaterials }));
    setEditingMaterialId(id);
  }

  function addShippingClass() {
    const id = crypto.randomUUID();
    const nextShippingClasses = [...materialsSettings.shippingClasses, { id, name: '', price: 0 }];
    setMaterialsSettings((current) => ({ ...current, shippingClasses: nextShippingClasses }));
    setEditingShippingClassId(id);
  }

  function addColorVariant() {
    const id = crypto.randomUUID();
    const nextColorVariants = [
      ...materialsSettings.colorVariants,
      { id, name: '', hex: '#000000' },
    ];
    setMaterialsSettings((current) => ({ ...current, colorVariants: nextColorVariants }));
    setEditingColorId(id);
  }

  function deleteMaterial(id: string) {
    if (!window.confirm('Material wirklich löschen?')) return;
    const nextMaterials = materialsSettings.materials.filter((material) => material.id !== id);
    commitMaterials(nextMaterials);
  }

  function deleteShippingClass(id: string) {
    if (!window.confirm('Versandklasse wirklich löschen?')) return;
    const nextShippingClasses = materialsSettings.shippingClasses.filter(
      (shippingClass) => shippingClass.id !== id,
    );
    commitShippingClasses(nextShippingClasses);
  }

  function deleteColorVariant(id: string) {
    if (!window.confirm('Farbvariante wirklich löschen?')) return;
    const nextColorVariants = materialsSettings.colorVariants.filter((color) => color.id !== id);
    commitColorVariants(nextColorVariants);
  }

  function commitCurrentMaterials() {
    commitMaterials(materialsSettings.materials);
    setEditingMaterialId(null);
  }

  function commitCurrentShippingClasses() {
    commitShippingClasses(materialsSettings.shippingClasses);
    setEditingShippingClassId(null);
  }

  function commitCurrentColorVariants() {
    commitColorVariants(materialsSettings.colorVariants);
    setEditingColorId(null);
  }

  function updatePlatformFee(platform: PlatformKey, patch: Partial<PlatformFeeSetting>) {
    const nextPlatformFees: PlatformFeesSetting = {
      ...materialsSettings.platformFees,
      [platform]: { ...materialsSettings.platformFees[platform], ...patch },
    };
    updateMaterialsSetting('platformFees', nextPlatformFees, 'platform_fees', nextPlatformFees);
  }

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
              items={{ de: 'Deutsch', en: 'English' }}
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
              items={{ 'DD.MM.YYYY': 'TT.MM.JJJJ', 'YYYY-MM-DD': 'JJJJ-MM-TT' }}
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
            <NumberField
              value={settings.marginWarningThreshold}
              min={0}
              max={100}
              step={1}
              unit="%"
              aria-label="Schwache-Marge-Schwellwert"
              className="max-w-40"
              inputClassName="pr-8"
              onValueChange={(value) =>
                updateSetting('marginWarningThreshold', value, 'margin_warning_threshold', [
                  'dashboard_low_margin_threshold',
                ])
              }
            />
          </FieldRow>
        </SettingsSection>

        {/* Rechnungsstellung (Modul 17): Stammdaten, Zahlungsziel, Logo, Layout.
            Bewusst NACH dem Dashboard-Abschnitt: bestehende Tests und Nutzer
            erwarten den Marge-Schwellwert als erstes Zahlenfeld des Tabs. */}
        <InvoiceSettingsSection companyName={settings.companyName} />
      </div>
    );
  }

  function renderMaterialsTab() {
    if (isLoading) {
      return <div className="text-sm text-text-secondary">Einstellungen werden geladen...</div>;
    }

    return (
      <div className="space-y-5">
        <SettingsSection title="Materialien">
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-bg-secondary text-left text-xs uppercase tracking-wide text-text-secondary">
                <tr>
                  <th className="px-3 py-2 font-medium">Material</th>
                  <th className="px-3 py-2 font-medium">Preis pro kg</th>
                  <th className="w-28 px-3 py-2 text-right font-medium">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {materialsSettings.materials.map((material) => {
                  const isEditing = editingMaterialId === material.id;
                  return (
                    <tr key={material.id} onDoubleClick={() => setEditingMaterialId(material.id)}>
                      <td className="px-3 py-2">
                        <Input
                          value={material.name}
                          disabled={!isEditing}
                          onChange={(event) =>
                            updateMaterial(material.id, { name: event.target.value })
                          }
                          onBlur={() => commitMaterials(materialsSettings.materials)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') commitCurrentMaterials();
                          }}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <NumberField
                          value={material.pricePerKg}
                          min={0}
                          step={0.01}
                          unit="EUR"
                          disabled={!isEditing}
                          aria-label={`Preis pro kg ${material.name}`.trim()}
                          inputClassName="pr-12"
                          onValueChange={(pricePerKg) =>
                            updateMaterial(material.id, { pricePerKg })
                          }
                          onCommit={() => commitMaterials(materialsSettings.materials)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title={isEditing ? 'Speichern' : 'Bearbeiten'}
                            onClick={() =>
                              isEditing
                                ? commitCurrentMaterials()
                                : setEditingMaterialId(material.id)
                            }
                          >
                            {isEditing ? (
                              <Check className="size-4" />
                            ) : (
                              <Edit2 className="size-4" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Löschen"
                            onClick={() => deleteMaterial(material.id)}
                          >
                            <Trash2 className="size-4 text-danger" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Button type="button" variant="outline" className="gap-2" onClick={addMaterial}>
            <Plus className="size-4" />
            Material hinzufügen
          </Button>
        </SettingsSection>

        <SettingsSection title="Drucker-Setup">
          <FieldRow label="Druckerleistung">
            <NumberField
              value={materialsSettings.printerPowerWatts}
              min={0}
              max={5000}
              step={10}
              unit="Watt"
              aria-label="Druckerleistung"
              className="max-w-48"
              inputClassName="pr-14"
              onValueChange={(value) =>
                updateMaterialsSetting('printerPowerWatts', value, 'printer_power_watts')
              }
            />
          </FieldRow>
          <FieldRow label="Strompreis">
            <NumberField
              value={materialsSettings.electricityPricePerKwh}
              min={0}
              max={5}
              step={0.01}
              unit="EUR/kWh"
              aria-label="Strompreis"
              className="max-w-52"
              inputClassName="pr-20"
              onValueChange={(value) =>
                updateMaterialsSetting('electricityPricePerKwh', value, 'electricity_price_per_kwh')
              }
            />
          </FieldRow>
          <FieldRow label="Versand-Default">
            <SwitchControl
              checked={materialsSettings.shippingPaidByBuyer}
              label="Versand wird standardmäßig vom Käufer bezahlt"
              onCheckedChange={(checked) =>
                updateMaterialsSetting(
                  'shippingPaidByBuyer',
                  checked,
                  'shipping_paid_by_buyer',
                  checked,
                  ['shipping_paid_by_customer_default'],
                )
              }
            />
          </FieldRow>
        </SettingsSection>

        <SettingsSection title="Plattformgebühren">
          <div className="grid gap-3 lg:grid-cols-3">
            {(Object.keys(PLATFORM_LABELS) as PlatformKey[]).map((platform) => (
              <div key={platform} className="rounded-lg border border-border bg-bg-primary p-4">
                <h3 className="mb-4 text-sm font-semibold text-text-primary">
                  {PLATFORM_LABELS[platform]}
                </h3>
                <div className="space-y-3">
                  <Label className="space-y-1">
                    <span className="text-xs text-text-secondary">Gebühr</span>
                    <NumberField
                      value={materialsSettings.platformFees[platform].percentFee}
                      min={0}
                      max={100}
                      step={0.1}
                      unit="%"
                      aria-label={`${PLATFORM_LABELS[platform]} Gebühr`}
                      inputClassName="pr-8"
                      onValueChange={(percentFee) => updatePlatformFee(platform, { percentFee })}
                    />
                  </Label>
                  <Label className="space-y-1">
                    <span className="text-xs text-text-secondary">Fixbetrag</span>
                    <NumberField
                      value={materialsSettings.platformFees[platform].fixedFee}
                      min={0}
                      step={0.01}
                      unit="EUR"
                      aria-label={`${PLATFORM_LABELS[platform]} Fixbetrag`}
                      inputClassName="pr-12"
                      onValueChange={(fixedFee) => updatePlatformFee(platform, { fixedFee })}
                    />
                  </Label>
                </div>
              </div>
            ))}
          </div>
        </SettingsSection>

        <SettingsSection title="Versandklassen">
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-bg-secondary text-left text-xs uppercase tracking-wide text-text-secondary">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Preis</th>
                  <th className="w-28 px-3 py-2 text-right font-medium">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {materialsSettings.shippingClasses.map((shippingClass) => {
                  const isEditing = editingShippingClassId === shippingClass.id;
                  return (
                    <tr
                      key={shippingClass.id}
                      onDoubleClick={() => setEditingShippingClassId(shippingClass.id)}
                    >
                      <td className="px-3 py-2">
                        <Input
                          value={shippingClass.name}
                          disabled={!isEditing}
                          onChange={(event) =>
                            updateShippingClass(shippingClass.id, { name: event.target.value })
                          }
                          onBlur={() => commitShippingClasses(materialsSettings.shippingClasses)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') commitCurrentShippingClasses();
                          }}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <NumberField
                          value={shippingClass.price}
                          min={0}
                          step={0.01}
                          unit="EUR"
                          disabled={!isEditing}
                          aria-label={`Preis ${shippingClass.name}`.trim()}
                          inputClassName="pr-12"
                          onValueChange={(price) =>
                            updateShippingClass(shippingClass.id, { price })
                          }
                          onCommit={() => commitShippingClasses(materialsSettings.shippingClasses)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title={isEditing ? 'Speichern' : 'Bearbeiten'}
                            onClick={() =>
                              isEditing
                                ? commitCurrentShippingClasses()
                                : setEditingShippingClassId(shippingClass.id)
                            }
                          >
                            {isEditing ? (
                              <Check className="size-4" />
                            ) : (
                              <Edit2 className="size-4" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Löschen"
                            onClick={() => deleteShippingClass(shippingClass.id)}
                          >
                            <Trash2 className="size-4 text-danger" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Button type="button" variant="outline" className="gap-2" onClick={addShippingClass}>
            <Plus className="size-4" />
            Versandklasse hinzufügen
          </Button>
        </SettingsSection>

        <SettingsSection title="Farbvarianten-Bibliothek">
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-bg-secondary text-left text-xs uppercase tracking-wide text-text-secondary">
                <tr>
                  <th className="w-16 px-3 py-2 font-medium">Farbe</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Hex-Code</th>
                  <th className="w-28 px-3 py-2 text-right font-medium">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {materialsSettings.colorVariants.map((color) => {
                  const isEditing = editingColorId === color.id;
                  return (
                    <tr key={color.id} onDoubleClick={() => setEditingColorId(color.id)}>
                      <td className="px-3 py-2">
                        <span
                          className="block size-5 rounded-full border border-border"
                          style={{ backgroundColor: normalizeHex(color.hex) }}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={color.name}
                          disabled={!isEditing}
                          onChange={(event) =>
                            updateColorVariant(color.id, { name: event.target.value })
                          }
                          onBlur={() => commitColorVariants(materialsSettings.colorVariants)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') commitCurrentColorVariants();
                          }}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Input
                            value={color.hex}
                            disabled={!isEditing}
                            onChange={(event) =>
                              updateColorVariant(color.id, { hex: event.target.value })
                            }
                            onBlur={() => commitColorVariants(materialsSettings.colorVariants)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') commitCurrentColorVariants();
                            }}
                          />
                          <input
                            type="color"
                            value={normalizeHex(color.hex)}
                            disabled={!isEditing}
                            onChange={(event) =>
                              updateColorVariant(color.id, { hex: event.target.value })
                            }
                            onBlur={() => commitColorVariants(materialsSettings.colorVariants)}
                            className="h-8 w-10 rounded border border-border bg-transparent"
                            aria-label="Farbe wählen"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title={isEditing ? 'Speichern' : 'Bearbeiten'}
                            onClick={() =>
                              isEditing ? commitCurrentColorVariants() : setEditingColorId(color.id)
                            }
                          >
                            {isEditing ? (
                              <Check className="size-4" />
                            ) : (
                              <Edit2 className="size-4" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Löschen"
                            onClick={() => deleteColorVariant(color.id)}
                          >
                            <Trash2 className="size-4 text-danger" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Button type="button" variant="outline" className="gap-2" onClick={addColorVariant}>
            <Plus className="size-4" />
            Farbe hinzufügen
          </Button>
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
          {activeTab === 'general' && renderGeneralTab()}
          {activeTab === 'materials' && renderMaterialsTab()}
          {activeTab === 'ai' && <AiSettingsTab />}
          {activeTab === 'automation' && <AutomationSettingsTab />}
          {activeTab === 'brand' && <BrandSettingsTab />}
          {activeTab === 'data' && <DataSecuritySettingsTab />}
        </div>
      </main>
    </div>
  );
}
