import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Loader2, RefreshCw, ShieldCheck, Unplug } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  getPlatformConnectionStatus,
  loadPlatformProfiles,
  PLATFORM_CREDENTIAL_KEYS,
  disconnectPlatform,
  startPlatformOAuth,
  type PlatformConnectionStatus,
} from '@/features/platform-sync/services/platform-settings-service';
import type { Platform, PlatformProfiles } from '@/features/platform-sync/providers/types';
import { DEFAULTS, getSettingWithDefault } from '@/services/settings';
import { cn } from '@/lib/utils';
import { useAutoSave } from '../hooks/useAutoSave';
import { PlatformCredentialField } from './PlatformCredentialField';

type WhoMade = 'i_did' | 'someone_else' | 'collective';
type WhenMade = 'made_to_order' | '2020_2026' | '2010_2019' | '2006_2009' | 'before_2006';
type MarketplaceId = 'EBAY_DE' | 'EBAY_AT' | 'EBAY_CH';

interface PlatformSettingsState {
  etsyShippingProfileId: string;
  etsyReturnPolicyId: string;
  etsyTaxonomyId: string;
  etsyWhoMade: WhoMade;
  etsyWhenMade: WhenMade;
  ebayMarketplaceId: MarketplaceId;
  ebayRuName: string;
  ebayInventoryLocationKey: string;
  ebayFulfillmentPolicyId: string;
  ebayPaymentPolicyId: string;
  ebayReturnPolicyId: string;
  ebayCategoryId: string;
  syncIntervalMinutes: number;
  syncAutoEnabled: boolean;
  syncPullOrdersEnabled: boolean;
}

const DEFAULT_STATE: PlatformSettingsState = {
  etsyShippingProfileId: DEFAULTS.etsy_default_shipping_profile_id,
  etsyReturnPolicyId: DEFAULTS.etsy_default_return_policy_id,
  etsyTaxonomyId: '',
  etsyWhoMade: DEFAULTS.etsy_who_made,
  etsyWhenMade: DEFAULTS.etsy_when_made,
  ebayMarketplaceId: DEFAULTS.ebay_marketplace_id,
  ebayRuName: DEFAULTS.ebay_ru_name,
  ebayInventoryLocationKey: DEFAULTS.ebay_inventory_location_key,
  ebayFulfillmentPolicyId: DEFAULTS.ebay_default_fulfillment_policy_id,
  ebayPaymentPolicyId: DEFAULTS.ebay_default_payment_policy_id,
  ebayReturnPolicyId: DEFAULTS.ebay_default_return_policy_id,
  ebayCategoryId: DEFAULTS.ebay_default_category_id,
  syncIntervalMinutes: DEFAULTS.sync_interval_minutes,
  syncAutoEnabled: DEFAULTS.sync_auto_enabled,
  syncPullOrdersEnabled: DEFAULTS.sync_pull_orders_enabled,
};

const WHO_MADE_OPTIONS: Array<{ value: WhoMade; label: string }> = [
  { value: 'i_did', label: 'Ich habe es hergestellt' },
  { value: 'someone_else', label: 'Jemand anderes hat es hergestellt' },
  { value: 'collective', label: 'Kollektiv/Team' },
];

const WHEN_MADE_OPTIONS: Array<{ value: WhenMade; label: string }> = [
  { value: 'made_to_order', label: 'Auf Bestellung gefertigt' },
  { value: '2020_2026', label: '2020-2026' },
  { value: '2010_2019', label: '2010-2019' },
  { value: '2006_2009', label: '2006-2009' },
  { value: 'before_2006', label: 'Vor 2006' },
];

const MARKETPLACE_OPTIONS: Array<{ value: MarketplaceId; label: string }> = [
  { value: 'EBAY_DE', label: 'Deutschland' },
  { value: 'EBAY_AT', label: 'Österreich' },
  { value: 'EBAY_CH', label: 'Schweiz' },
];

function Section({
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
      <div>{children}</div>
    </div>
  );
}

function NativeSelect<T extends string>({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: T | '';
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm text-text-primary outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function SwitchControl({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 rounded-full border border-border transition-colors',
        checked ? 'bg-accent-primary' : 'bg-bg-subtle',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

function ConnectionBadge({ status }: { status: PlatformConnectionStatus | null }) {
  if (!status) {
    return <Badge variant="outline">Wird geladen</Badge>;
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        status.connected
          ? 'border-accent-success text-accent-success'
          : 'border-text-muted text-text-secondary',
      )}
    >
      {status.label}
    </Badge>
  );
}

function profilesByType(profiles: PlatformProfiles | null, type: string) {
  return profiles?.profiles.filter((profile) => profile.type === type) ?? [];
}

function toProfileOptions(profiles: PlatformProfiles | null, type: string) {
  return profilesByType(profiles, type).map((profile) => ({
    value: profile.id,
    label: profile.name,
  }));
}

export function PlatformSyncSettingsTab() {
  const { scheduleSave } = useAutoSave();
  const [settings, setSettings] = useState<PlatformSettingsState>(DEFAULT_STATE);
  const [etsyStatus, setEtsyStatus] = useState<PlatformConnectionStatus | null>(null);
  const [ebayStatus, setEbayStatus] = useState<PlatformConnectionStatus | null>(null);
  const [etsyProfiles, setEtsyProfiles] = useState<PlatformProfiles | null>(null);
  const [ebayProfiles, setEbayProfiles] = useState<PlatformProfiles | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const etsyShippingOptions = useMemo(
    () => toProfileOptions(etsyProfiles, 'shipping_profile'),
    [etsyProfiles],
  );
  const ebayFulfillmentOptions = useMemo(
    () => toProfileOptions(ebayProfiles, 'fulfillment_policy'),
    [ebayProfiles],
  );
  const ebayPaymentOptions = useMemo(
    () => toProfileOptions(ebayProfiles, 'payment_policy'),
    [ebayProfiles],
  );
  const ebayReturnOptions = useMemo(
    () => toProfileOptions(ebayProfiles, 'return_policy'),
    [ebayProfiles],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [
          etsyShippingProfileId,
          etsyReturnPolicyId,
          etsyTaxonomyId,
          etsyWhoMade,
          etsyWhenMade,
          ebayMarketplaceId,
          ebayRuName,
          ebayInventoryLocationKey,
          ebayFulfillmentPolicyId,
          ebayPaymentPolicyId,
          ebayReturnPolicyId,
          ebayCategoryId,
          syncIntervalMinutes,
          syncAutoEnabled,
          syncPullOrdersEnabled,
        ] = await Promise.all([
          getSettingWithDefault('etsy_default_shipping_profile_id', DEFAULTS.etsy_default_shipping_profile_id),
          getSettingWithDefault('etsy_default_return_policy_id', DEFAULTS.etsy_default_return_policy_id),
          getSettingWithDefault('etsy_default_taxonomy_id', DEFAULTS.etsy_default_taxonomy_id),
          getSettingWithDefault('etsy_who_made', DEFAULTS.etsy_who_made),
          getSettingWithDefault('etsy_when_made', DEFAULTS.etsy_when_made),
          getSettingWithDefault('ebay_marketplace_id', DEFAULTS.ebay_marketplace_id),
          getSettingWithDefault('ebay_ru_name', DEFAULTS.ebay_ru_name),
          getSettingWithDefault('ebay_inventory_location_key', DEFAULTS.ebay_inventory_location_key),
          getSettingWithDefault('ebay_default_fulfillment_policy_id', DEFAULTS.ebay_default_fulfillment_policy_id),
          getSettingWithDefault('ebay_default_payment_policy_id', DEFAULTS.ebay_default_payment_policy_id),
          getSettingWithDefault('ebay_default_return_policy_id', DEFAULTS.ebay_default_return_policy_id),
          getSettingWithDefault('ebay_default_category_id', DEFAULTS.ebay_default_category_id),
          getSettingWithDefault('sync_interval_minutes', DEFAULTS.sync_interval_minutes),
          getSettingWithDefault('sync_auto_enabled', DEFAULTS.sync_auto_enabled),
          getSettingWithDefault('sync_pull_orders_enabled', DEFAULTS.sync_pull_orders_enabled),
        ]);

        if (!cancelled) {
          setSettings({
            etsyShippingProfileId,
            etsyReturnPolicyId,
            etsyTaxonomyId: etsyTaxonomyId === null ? '' : String(etsyTaxonomyId),
            etsyWhoMade: etsyWhoMade as WhoMade,
            etsyWhenMade: etsyWhenMade as WhenMade,
            ebayMarketplaceId: ebayMarketplaceId as MarketplaceId,
            ebayRuName,
            ebayInventoryLocationKey,
            ebayFulfillmentPolicyId,
            ebayPaymentPolicyId,
            ebayReturnPolicyId,
            ebayCategoryId,
            syncIntervalMinutes,
            syncAutoEnabled,
            syncPullOrdersEnabled,
          });
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : 'Plattform-Settings konnten nicht geladen werden');
        }
      }
    }

    void load();
    void refreshConnectionStatuses();

    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshConnectionStatuses() {
    try {
      const [etsy, ebay] = await Promise.all([
        getPlatformConnectionStatus('etsy'),
        getPlatformConnectionStatus('ebay'),
      ]);
      setEtsyStatus(etsy);
      setEbayStatus(ebay);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Verbindungsstatus konnte nicht geladen werden');
    }
  }

  function updateSetting<K extends keyof PlatformSettingsState>(
    key: K,
    value: PlatformSettingsState[K],
    settingKey: string,
    saveValue: unknown = value,
  ) {
    setSettings((current) => ({ ...current, [key]: value }));
    scheduleSave(settingKey, saveValue);
  }

  async function handleOAuth(platform: Platform) {
    setLoadingAction(`${platform}-oauth`);
    try {
      await startPlatformOAuth(platform);
      await refreshConnectionStatuses();
      toast.success(`${platform === 'etsy' ? 'Etsy' : 'eBay'} verbunden`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'OAuth-Verbindung fehlgeschlagen');
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleDisconnect(platform: Platform) {
    const confirmed = window.confirm(
      `${platform === 'etsy' ? 'Etsy' : 'eBay'} wirklich trennen? Credentials bleiben gespeichert, OAuth-Tokens werden gelöscht.`,
    );
    if (!confirmed) return;

    setLoadingAction(`${platform}-disconnect`);
    try {
      await disconnectPlatform(platform);
      await refreshConnectionStatuses();
      toast.success(`${platform === 'etsy' ? 'Etsy' : 'eBay'} getrennt`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Verbindung konnte nicht getrennt werden');
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleLoadProfiles(platform: Platform) {
    setLoadingAction(`${platform}-profiles`);
    try {
      const profiles = await loadPlatformProfiles(platform);
      if (platform === 'etsy') setEtsyProfiles(profiles);
      else setEbayProfiles(profiles);
      toast.success('Profile geladen');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Profile konnten nicht geladen werden');
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className="space-y-6">
      <Section
        title="Etsy"
        description="API-Credentials, OAuth-Verbindung und Standardwerte für Etsy-Sync."
      >
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-bg-subtle p-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-text-secondary" />
            <ConnectionBadge status={etsyStatus} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleOAuth('etsy')}
              disabled={loadingAction === 'etsy-oauth'}
            >
              {loadingAction === 'etsy-oauth' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Mit Etsy verbinden
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void handleDisconnect('etsy')}
              disabled={loadingAction === 'etsy-disconnect'}
            >
              <Unplug className="mr-2 h-4 w-4" />
              Trennen
            </Button>
          </div>
        </div>

        <FieldRow label="API Key">
          <PlatformCredentialField
            label="Etsy API Key"
            credentialKey={PLATFORM_CREDENTIAL_KEYS.etsyApiKey}
            placeholder="Etsy API Key"
            onChanged={() => void refreshConnectionStatuses()}
          />
        </FieldRow>
        <FieldRow label="Shared Secret">
          <PlatformCredentialField
            label="Etsy Shared Secret"
            credentialKey={PLATFORM_CREDENTIAL_KEYS.etsySharedSecret}
            placeholder="Etsy Shared Secret"
            onChanged={() => void refreshConnectionStatuses()}
          />
        </FieldRow>
        <FieldRow label="Versandprofil" hint="Profile werden über die Etsy-API geladen.">
          <div className="flex flex-wrap gap-2">
            <NativeSelect
              value={settings.etsyShippingProfileId}
              onChange={(value) => updateSetting('etsyShippingProfileId', value, 'etsy_default_shipping_profile_id')}
              options={etsyShippingOptions}
              placeholder="Profil auswählen"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleLoadProfiles('etsy')}
              disabled={loadingAction === 'etsy-profiles'}
            >
              {loadingAction === 'etsy-profiles' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Profile laden
            </Button>
          </div>
        </FieldRow>
        <FieldRow label="Return Policy ID" hint="Etsy Return Policies werden als ID gespeichert.">
          <Input
            value={settings.etsyReturnPolicyId}
            onChange={(event) => updateSetting('etsyReturnPolicyId', event.target.value, 'etsy_default_return_policy_id')}
            placeholder="z.B. 123456789"
          />
        </FieldRow>
        <FieldRow label="Taxonomy ID">
          <Input
            type="number"
            value={settings.etsyTaxonomyId}
            onChange={(event) => updateSetting('etsyTaxonomyId', event.target.value, 'etsy_default_taxonomy_id', event.target.value ? Number(event.target.value) : null)}
            placeholder="z.B. 68887474"
          />
        </FieldRow>
        <FieldRow label="Hersteller">
          <NativeSelect
            value={settings.etsyWhoMade}
            onChange={(value) => updateSetting('etsyWhoMade', value, 'etsy_who_made')}
            options={WHO_MADE_OPTIONS}
          />
        </FieldRow>
        <FieldRow label="Herstellungszeitraum">
          <NativeSelect
            value={settings.etsyWhenMade}
            onChange={(value) => updateSetting('etsyWhenMade', value, 'etsy_when_made')}
            options={WHEN_MADE_OPTIONS}
          />
        </FieldRow>
      </Section>

      <Section
        title="eBay"
        description="OAuth läuft über den festen lokalen Callback-Port 58432 und die RuName aus den eBay Developer Settings."
      >
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-bg-subtle p-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-text-secondary" />
            <ConnectionBadge status={ebayStatus} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleOAuth('ebay')}
              disabled={loadingAction === 'ebay-oauth'}
            >
              {loadingAction === 'ebay-oauth' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Mit eBay verbinden
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void handleDisconnect('ebay')}
              disabled={loadingAction === 'ebay-disconnect'}
            >
              <Unplug className="mr-2 h-4 w-4" />
              Trennen
            </Button>
          </div>
        </div>

        <FieldRow label="Client ID">
          <PlatformCredentialField
            label="eBay Client ID"
            credentialKey={PLATFORM_CREDENTIAL_KEYS.ebayClientId}
            placeholder="eBay Client ID"
            onChanged={() => void refreshConnectionStatuses()}
          />
        </FieldRow>
        <FieldRow label="Client Secret">
          <PlatformCredentialField
            label="eBay Client Secret"
            credentialKey={PLATFORM_CREDENTIAL_KEYS.ebayClientSecret}
            placeholder="eBay Client Secret"
            onChanged={() => void refreshConnectionStatuses()}
          />
        </FieldRow>
        <FieldRow label="RuName" hint="Accept-URL im eBay Developer Portal: http://localhost:58432/callback">
          <Input
            value={settings.ebayRuName}
            onChange={(event) => updateSetting('ebayRuName', event.target.value, 'ebay_ru_name')}
            placeholder="eBay Redirect URL Name"
          />
        </FieldRow>
        <FieldRow label="Marketplace">
          <NativeSelect
            value={settings.ebayMarketplaceId}
            onChange={(value) => updateSetting('ebayMarketplaceId', value, 'ebay_marketplace_id')}
            options={MARKETPLACE_OPTIONS}
          />
        </FieldRow>
        <FieldRow label="Inventory Location Key">
          <Input
            value={settings.ebayInventoryLocationKey}
            onChange={(event) => updateSetting('ebayInventoryLocationKey', event.target.value, 'ebay_inventory_location_key')}
            placeholder="z.B. polygrid-home"
          />
        </FieldRow>
        <FieldRow label="Business Policies" hint="Fulfillment, Payment und Return Policies aus eBay laden.">
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleLoadProfiles('ebay')}
              disabled={loadingAction === 'ebay-profiles'}
            >
              {loadingAction === 'ebay-profiles' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Policies laden
            </Button>
            <NativeSelect
              value={settings.ebayFulfillmentPolicyId}
              onChange={(value) => updateSetting('ebayFulfillmentPolicyId', value, 'ebay_default_fulfillment_policy_id')}
              options={ebayFulfillmentOptions}
              placeholder="Fulfillment Policy"
            />
            <NativeSelect
              value={settings.ebayPaymentPolicyId}
              onChange={(value) => updateSetting('ebayPaymentPolicyId', value, 'ebay_default_payment_policy_id')}
              options={ebayPaymentOptions}
              placeholder="Payment Policy"
            />
            <NativeSelect
              value={settings.ebayReturnPolicyId}
              onChange={(value) => updateSetting('ebayReturnPolicyId', value, 'ebay_default_return_policy_id')}
              options={ebayReturnOptions}
              placeholder="Return Policy"
            />
          </div>
        </FieldRow>
        <FieldRow label="Default-Kategorie">
          <Input
            value={settings.ebayCategoryId}
            onChange={(event) => updateSetting('ebayCategoryId', event.target.value, 'ebay_default_category_id')}
            placeholder="eBay Category ID"
          />
        </FieldRow>
      </Section>

      <Section title="Sync-Konfiguration" description="Basiswerte für automatische Synchronisation und Order-Import.">
        <FieldRow label="Sync-Intervall" hint="Minuten zwischen automatischen Sync-Läufen.">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={5}
              value={settings.syncIntervalMinutes}
              onChange={(event) => {
                const value = Number(event.target.value) || DEFAULTS.sync_interval_minutes;
                updateSetting('syncIntervalMinutes', value, 'sync_interval_minutes');
              }}
              className="max-w-32"
            />
            <span className="text-sm text-text-secondary">Minuten</span>
          </div>
        </FieldRow>
        <FieldRow label="Auto-Sync">
          <SwitchControl
            checked={settings.syncAutoEnabled}
            onChange={(checked) => updateSetting('syncAutoEnabled', checked, 'sync_auto_enabled')}
          />
        </FieldRow>
        <FieldRow label="Bestellungen automatisch importieren">
          <SwitchControl
            checked={settings.syncPullOrdersEnabled}
            onChange={(checked) => updateSetting('syncPullOrdersEnabled', checked, 'sync_pull_orders_enabled')}
          />
        </FieldRow>
      </Section>
    </div>
  );
}
