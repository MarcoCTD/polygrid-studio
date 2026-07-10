/**
 * Settings-Abschnitt "Rechnungsstellung" (Modul 17, Tab Allgemein).
 *
 * Firmen-Stammdaten für Angebote/Rechnungen, Zahlungsziel, Angebots-
 * Gültigkeit, Logo-Auswahl (Kopie als Data-URL, E17-04), Standard-Layout
 * und Markenfarbe. Eine Live-Checkliste zeigt fehlende Pflichtangaben
 * (dieselbe Logik wie das Ausstellen-Gate des Dokument-Service).
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { CheckCircle2, Info, TriangleAlert, Upload, X } from 'lucide-react';
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
import { getMissingIssuerFields } from '@/features/documents/services';
import type { SnapshotIssuer } from '@/features/documents/schemas';
import { DOCUMENT_LAYOUT_LABELS } from '@/features/documents/schemas';
import { DEFAULTS, getSettingWithDefault } from '@/services/settings';
import { useAutoSave } from '../hooks/useAutoSave';
import { NumberField } from './NumberField';

/** Maximale Logo-Größe (E17-04). */
const MAX_LOGO_BYTES = 1024 * 1024;

const LOGO_MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

interface InvoiceSettingsState {
  ownerName: string;
  street: string;
  zip: string;
  city: string;
  taxNumber: string;
  vatId: string;
  iban: string;
  bic: string;
  bankName: string;
  paymentTermsDays: number;
  quoteValidityDays: number;
  logo: string;
  defaultLayout: 'modern' | 'classic';
  brandColor: string;
}

const EMPTY_STATE: InvoiceSettingsState = {
  ownerName: DEFAULTS.invoice_owner_name,
  street: DEFAULTS.invoice_street,
  zip: DEFAULTS.invoice_zip,
  city: DEFAULTS.invoice_city,
  taxNumber: DEFAULTS.invoice_tax_number,
  vatId: DEFAULTS.invoice_vat_id,
  iban: DEFAULTS.invoice_iban,
  bic: DEFAULTS.invoice_bic,
  bankName: DEFAULTS.invoice_bank_name,
  paymentTermsDays: DEFAULTS.invoice_payment_terms_days,
  quoteValidityDays: DEFAULTS.invoice_quote_validity_days,
  logo: DEFAULTS.invoice_logo,
  defaultLayout: DEFAULTS.invoice_default_layout,
  brandColor: DEFAULTS.invoice_brand_color,
};

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
      {children}
    </div>
  );
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

interface InvoiceSettingsSectionProps {
  /** Firmenname aus den Grundeinstellungen (für die Pflichtangaben-Checkliste). */
  companyName: string;
}

export function InvoiceSettingsSection({ companyName }: InvoiceSettingsSectionProps) {
  const { scheduleSave } = useAutoSave();
  const [state, setState] = useState<InvoiceSettingsState>(EMPTY_STATE);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const [
          ownerName,
          street,
          zip,
          city,
          taxNumber,
          vatId,
          iban,
          bic,
          bankName,
          paymentTermsDays,
          quoteValidityDays,
          logo,
          defaultLayout,
          brandColor,
        ] = await Promise.all([
          getSettingWithDefault('invoice_owner_name'),
          getSettingWithDefault('invoice_street'),
          getSettingWithDefault('invoice_zip'),
          getSettingWithDefault('invoice_city'),
          getSettingWithDefault('invoice_tax_number'),
          getSettingWithDefault('invoice_vat_id'),
          getSettingWithDefault('invoice_iban'),
          getSettingWithDefault('invoice_bic'),
          getSettingWithDefault('invoice_bank_name'),
          getSettingWithDefault('invoice_payment_terms_days'),
          getSettingWithDefault('invoice_quote_validity_days'),
          getSettingWithDefault('invoice_logo'),
          getSettingWithDefault('invoice_default_layout'),
          getSettingWithDefault('invoice_brand_color'),
        ]);

        if (cancelled) return;
        setState({
          ownerName,
          street,
          zip,
          city,
          taxNumber,
          vatId,
          iban,
          bic,
          bankName,
          paymentTermsDays: Number(paymentTermsDays) || 14,
          quoteValidityDays: Number(quoteValidityDays) || 30,
          logo,
          defaultLayout: String(defaultLayout) === 'classic' ? 'classic' : 'modern',
          brandColor,
        });
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Rechnungs-Einstellungen konnten nicht geladen werden',
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

  function updateField<K extends keyof InvoiceSettingsState>(
    key: K,
    value: InvoiceSettingsState[K],
    settingKey: string,
  ) {
    setState((current) => ({ ...current, [key]: value }));
    scheduleSave(settingKey, value);
  }

  const missingFields = useMemo(() => {
    const issuer: SnapshotIssuer = {
      company_name: companyName.trim(),
      owner_name: state.ownerName.trim(),
      street: state.street.trim(),
      zip: state.zip.trim(),
      city: state.city.trim(),
      tax_number: state.taxNumber.trim(),
      vat_id: state.vatId.trim(),
      iban: state.iban.trim(),
      bic: state.bic.trim(),
      bank_name: state.bankName.trim(),
      // Kontaktfelder sind keine Pflichtangaben (nur Layout polygrid)
      email: '',
      phone: '',
      website: '',
    };
    return getMissingIssuerFields(issuer);
  }, [companyName, state]);

  async function handleLogoSelect() {
    try {
      const selected = await open({
        multiple: false,
        title: 'Logo auswählen',
        filters: [{ name: 'Bilder', extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg'] }],
      });
      if (!selected || Array.isArray(selected)) return;

      const extension = selected.split('.').pop()?.toLowerCase() ?? '';
      const mime = LOGO_MIME_BY_EXTENSION[extension];
      if (!mime) {
        toast.error('Nur PNG, JPG, WebP oder SVG werden unterstützt.');
        return;
      }

      const bytes = await readFile(selected);
      if (bytes.length > MAX_LOGO_BYTES) {
        toast.error('Logo ist zu groß (maximal 1 MB).');
        return;
      }

      const dataUrl = `data:${mime};base64,${bytesToBase64(bytes)}`;
      updateField('logo', dataUrl, 'invoice_logo');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Logo konnte nicht geladen werden');
    }
  }

  function handleLogoRemove() {
    updateField('logo', '', 'invoice_logo');
  }

  function handleBrandColorChange(raw: string) {
    const value = raw.trim();
    if (value === '' || /^#[0-9a-fA-F]{6}$/.test(value)) {
      updateField('brandColor', value.toUpperCase(), 'invoice_brand_color');
      return;
    }
    // Teileingaben nur lokal halten, nicht speichern
    setState((current) => ({ ...current, brandColor: value }));
  }

  if (isLoading) {
    return <div className="text-sm text-text-secondary">Einstellungen werden geladen...</div>;
  }

  return (
    <Section
      title="Rechnungsstellung"
      description="Stammdaten und Vorgaben für Angebote und Rechnungen (Modul Dokumente)."
    >
      {/* Info-Box: E-Rechnungs-Befreiung für Kleinunternehmer (Spec Abschnitt 1) */}
      <div
        className="flex gap-3 rounded-lg border border-border bg-bg-secondary p-3 text-sm text-text-secondary"
        data-testid="invoice-einvoice-info"
      >
        <Info className="mt-0.5 size-4 shrink-0 text-pg-accent" />
        <p>
          Hinweis zur E-Rechnung: Kleinunternehmer nach §19 UStG sind von der Pflicht zur
          AUSSTELLUNG von E-Rechnungen befreit (JStG 2024) – PDF bleibt zulässig. Der Empfang von
          E-Rechnungen muss seit 2025 möglich sein (eine E-Mail-Adresse genügt).
        </p>
      </div>

      {missingFields.length > 0 ? (
        <div
          className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
          data-testid="invoice-missing-fields"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Für das Ausstellen von Rechnungen fehlen Pflichtangaben:</p>
            <ul className="mt-1 list-disc pl-4">
              {missingFields.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div
          className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"
          data-testid="invoice-fields-complete"
        >
          <CheckCircle2 className="size-4 shrink-0" />
          Alle Pflichtangaben für Rechnungen sind vorhanden.
        </div>
      )}

      <FieldRow
        label="Inhabername"
        hint="Der Firmenname wird oben unter „Firmenname / Shopname“ gepflegt"
      >
        <Input
          value={state.ownerName}
          data-testid="invoice-owner-name"
          onChange={(event) => updateField('ownerName', event.target.value, 'invoice_owner_name')}
        />
      </FieldRow>

      <FieldRow label="Straße und Hausnummer">
        <Input
          value={state.street}
          data-testid="invoice-street"
          onChange={(event) => updateField('street', event.target.value, 'invoice_street')}
        />
      </FieldRow>

      <FieldRow label="PLZ / Ort">
        <div className="grid grid-cols-[120px_1fr] gap-2">
          <Input
            value={state.zip}
            placeholder="PLZ"
            data-testid="invoice-zip"
            onChange={(event) => updateField('zip', event.target.value, 'invoice_zip')}
          />
          <Input
            value={state.city}
            placeholder="Ort"
            data-testid="invoice-city"
            onChange={(event) => updateField('city', event.target.value, 'invoice_city')}
          />
        </div>
      </FieldRow>

      <FieldRow label="Steuernummer" hint="Steuernummer ODER USt-IdNr ist Pflicht">
        <Input
          value={state.taxNumber}
          data-testid="invoice-tax-number"
          onChange={(event) => updateField('taxNumber', event.target.value, 'invoice_tax_number')}
        />
      </FieldRow>

      <FieldRow label="USt-IdNr (optional)">
        <Input
          value={state.vatId}
          data-testid="invoice-vat-id"
          onChange={(event) => updateField('vatId', event.target.value, 'invoice_vat_id')}
        />
      </FieldRow>

      <FieldRow label="IBAN">
        <Input
          value={state.iban}
          data-testid="invoice-iban"
          onChange={(event) => updateField('iban', event.target.value, 'invoice_iban')}
        />
      </FieldRow>

      <FieldRow label="BIC / Bank">
        <div className="grid grid-cols-2 gap-2">
          <Input
            value={state.bic}
            placeholder="BIC"
            data-testid="invoice-bic"
            onChange={(event) => updateField('bic', event.target.value, 'invoice_bic')}
          />
          <Input
            value={state.bankName}
            placeholder="Bank"
            data-testid="invoice-bank-name"
            onChange={(event) => updateField('bankName', event.target.value, 'invoice_bank_name')}
          />
        </div>
      </FieldRow>

      <FieldRow
        label="Zahlungsziel"
        hint="Fälligkeit der Rechnung = Ausstellungsdatum + Zahlungsziel"
      >
        <NumberField
          value={state.paymentTermsDays}
          min={0}
          max={365}
          step={1}
          unit="Tage"
          aria-label="Zahlungsziel in Tagen"
          className="max-w-40"
          inputClassName="pr-14"
          onValueChange={(value) =>
            updateField('paymentTermsDays', value, 'invoice_payment_terms_days')
          }
        />
      </FieldRow>

      <FieldRow label="Angebots-Gültigkeit">
        <NumberField
          value={state.quoteValidityDays}
          min={0}
          max={365}
          step={1}
          unit="Tage"
          aria-label="Angebots-Gültigkeit in Tagen"
          className="max-w-40"
          inputClassName="pr-14"
          onValueChange={(value) =>
            updateField('quoteValidityDays', value, 'invoice_quote_validity_days')
          }
        />
      </FieldRow>

      <FieldRow label="Logo" hint="Optional, max. 1 MB (PNG, JPG, WebP, SVG)">
        <div className="flex items-center gap-3">
          {state.logo ? (
            <img
              src={state.logo}
              alt="Firmenlogo"
              data-testid="invoice-logo-preview"
              className="h-12 max-w-40 rounded border border-border object-contain"
            />
          ) : (
            <span className="text-sm text-text-secondary">Kein Logo hinterlegt</span>
          )}
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => void handleLogoSelect()}
          >
            <Upload className="size-4" />
            {state.logo ? 'Logo ändern' : 'Logo auswählen'}
          </Button>
          {state.logo ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Logo entfernen"
              onClick={handleLogoRemove}
            >
              <X className="size-4" />
            </Button>
          ) : null}
        </div>
      </FieldRow>

      <FieldRow label="Standard-Layout">
        <Select
          value={state.defaultLayout}
          items={DOCUMENT_LAYOUT_LABELS}
          onValueChange={(value) =>
            updateField(
              'defaultLayout',
              value === 'classic' ? 'classic' : 'modern',
              'invoice_default_layout',
            )
          }
        >
          <SelectTrigger className="w-full max-w-60" data-testid="invoice-default-layout">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="modern">{DOCUMENT_LAYOUT_LABELS.modern}</SelectItem>
            <SelectItem value="classic">{DOCUMENT_LAYOUT_LABELS.classic}</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>

      <FieldRow
        label="Markenfarbe"
        hint="Feste Farbe für die Dokument-Layouts; leer = App-Akzentfarbe"
      >
        <div className="flex items-center gap-2">
          <Input
            value={state.brandColor}
            placeholder="#0070F2"
            className="max-w-40"
            data-testid="invoice-brand-color"
            onChange={(event) => handleBrandColorChange(event.target.value)}
          />
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(state.brandColor) ? state.brandColor : '#0070F2'}
            onChange={(event) => handleBrandColorChange(event.target.value)}
            className="h-8 w-10 rounded border border-border bg-transparent"
            aria-label="Markenfarbe wählen"
          />
          {state.brandColor ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Markenfarbe zurücksetzen"
              onClick={() => updateField('brandColor', '', 'invoice_brand_color')}
            >
              <X className="size-4" />
            </Button>
          ) : null}
        </div>
      </FieldRow>
    </Section>
  );
}
