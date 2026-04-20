import { useState } from 'react';
import { type UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  statusEnum,
  materialTypeEnum,
  licenseTypeEnum,
  licenseRiskEnum,
  shippingClassEnum,
  platformEnum,
} from '../schema';
import type {
  ProductUpdate,
  Status,
  MaterialType,
  LicenseType,
  LicenseRisk,
  ShippingClass,
  Platform,
} from '../schema';
import {
  STATUS_LABELS,
  MATERIAL_LABELS,
  LICENSE_TYPE_LABELS,
  LICENSE_RISK_LABELS,
  SHIPPING_LABELS,
  PLATFORM_LABELS,
} from '../labels';
import { ColorVariantsEditor } from './ColorVariantsEditor';
import { LicenseWarningDialog } from './LicenseWarningDialog';

interface OverviewTabProps {
  form: UseFormReturn<ProductUpdate>;
}

// ============================================================
// Helpers
// ============================================================

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-elevated p-5 dark:border-transparent dark:shadow-md">
      <h3 className="mb-4 text-sm font-semibold text-text-primary">{title}</h3>
      <div className="grid grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function FormField({
  label,
  error,
  children,
  span2,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  span2?: boolean;
}) {
  return (
    <div className={span2 ? 'col-span-2' : ''}>
      <Label className="mb-1.5 text-xs text-text-secondary">{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs text-[var(--accent-danger)]">{error}</p>}
    </div>
  );
}

function NumberInput({
  form,
  name,
  placeholder,
}: {
  form: UseFormReturn<ProductUpdate>;
  name: keyof ProductUpdate;
  placeholder?: string;
}) {
  const value = form.watch(name);
  return (
    <Input
      type="number"
      step="any"
      placeholder={placeholder}
      value={value === null || value === undefined ? '' : String(value)}
      onChange={(e) => {
        const val = e.target.value;
        form.setValue(name, val === '' ? null : Number(val), { shouldDirty: true });
      }}
    />
  );
}

// ============================================================
// Main Component
// ============================================================

export function OverviewTab({ form }: OverviewTabProps) {
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = form;

  const [showLicenseWarning, setShowLicenseWarning] = useState(false);

  const platforms = watch('platforms') ?? [];
  const status = watch('status');
  const materialType = watch('material_type');
  const licenseType = watch('license_type');
  const licenseRisk = watch('license_risk');
  const licenseSource = watch('license_source');
  const shippingClass = watch('shipping_class');

  const handleStatusChange = (newStatus: Status) => {
    if (newStatus === 'online') {
      const risk = licenseRisk;
      if (!risk || risk === 'risky' || risk === 'review_needed') {
        setShowLicenseWarning(true);
        return;
      }
    }
    setValue('status', newStatus, { shouldDirty: true });
  };

  const togglePlatform = (platform: Platform) => {
    const current = platforms as Platform[];
    if (current.includes(platform)) {
      setValue(
        'platforms',
        current.filter((p) => p !== platform),
        { shouldDirty: true },
      );
    } else {
      setValue('platforms', [...current, platform], { shouldDirty: true });
    }
  };

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
      {/* Grunddaten */}
      <FormSection title="Grunddaten">
        <FormField label="Name *" error={errors.name?.message as string | undefined} span2>
          <Input {...register('name')} placeholder="Produktname" />
        </FormField>

        <FormField label="Kurzname" error={errors.short_name?.message as string | undefined}>
          <Input {...register('short_name')} placeholder="Kurzname" />
        </FormField>

        <FormField label="Kategorie *" error={errors.category?.message as string | undefined}>
          <Input {...register('category')} placeholder="z.B. Deko, Organizer, Gadget" />
        </FormField>

        <FormField label="Unterkategorie">
          <Input {...register('subcategory')} placeholder="Unterkategorie" />
        </FormField>

        <FormField label="Kollektion">
          <Input {...register('collection')} placeholder="z.B. Minimal, Industrial" />
        </FormField>

        <FormField label="Status *">
          <Select
            value={status ?? 'idea'}
            onValueChange={(val) => {
              if (val) handleStatusChange(val as Status);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Status wählen">
                {status ? STATUS_LABELS[status] : 'Status wählen'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {statusEnum.options.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="Material *">
          <Select
            value={materialType ?? 'PLA'}
            onValueChange={(val) => {
              if (val) setValue('material_type', val as MaterialType, { shouldDirty: true });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Material wählen">
                {materialType ? MATERIAL_LABELS[materialType] : 'Material wählen'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {materialTypeEnum.options.map((m) => (
                <SelectItem key={m} value={m}>
                  {MATERIAL_LABELS[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </FormSection>

      {/* Produktion */}
      <FormSection title="Produktion">
        <FormField label="Druckzeit (Minuten)">
          <NumberInput form={form} name="print_time_minutes" placeholder="z.B. 120" />
        </FormField>

        <FormField label="Materialverbrauch (g)">
          <NumberInput form={form} name="material_grams" placeholder="z.B. 50" />
        </FormField>

        <FormField label="Verpackungskosten (EUR)">
          <NumberInput form={form} name="packaging_cost" placeholder="z.B. 0.50" />
        </FormField>

        <FormField label="Versandklasse">
          <Select
            value={shippingClass ?? ''}
            onValueChange={(val) =>
              setValue('shipping_class', (val || null) as ShippingClass | null, {
                shouldDirty: true,
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Keine">
                {shippingClass ? SHIPPING_LABELS[shippingClass] : 'Keine'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {shippingClassEnum.options.map((s) => (
                <SelectItem key={s} value={s}>
                  {SHIPPING_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="Farbvarianten" span2>
          <ColorVariantsEditor form={form} />
        </FormField>
      </FormSection>

      {/* Preise */}
      <FormSection title="Preise">
        <FormField label="Zielpreis (EUR)">
          <NumberInput form={form} name="target_price" placeholder="z.B. 14.99" />
        </FormField>

        <FormField label="Mindestpreis (EUR)">
          <NumberInput form={form} name="min_price" placeholder="z.B. 9.99" />
        </FormField>

        <FormField label="Preis Etsy (EUR)">
          <NumberInput form={form} name="price_etsy" placeholder="Etsy-Preis" />
        </FormField>

        <FormField label="Preis eBay (EUR)">
          <NumberInput form={form} name="price_ebay" placeholder="eBay-Preis" />
        </FormField>

        <FormField label="Preis Kleinanzeigen (EUR)">
          <NumberInput form={form} name="price_kleinanzeigen" placeholder="Kleinanzeigen-Preis" />
        </FormField>
      </FormSection>

      {/* Lizenz */}
      <FormSection title="Lizenz">
        <FormField label="Quelle">
          <Input
            {...register('license_source')}
            placeholder="z.B. Thingiverse, Printables, Eigen"
          />
        </FormField>

        <FormField label="Lizenztyp">
          <Select
            value={licenseType ?? ''}
            onValueChange={(val) =>
              setValue('license_type', (val || null) as LicenseType | null, { shouldDirty: true })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Nicht gesetzt">
                {licenseType ? LICENSE_TYPE_LABELS[licenseType] : 'Nicht gesetzt'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {licenseTypeEnum.options.map((l) => (
                <SelectItem key={l} value={l}>
                  {LICENSE_TYPE_LABELS[l]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="Lizenz-URL" error={errors.license_url?.message as string | undefined}>
          <Input {...register('license_url')} placeholder="https://..." />
        </FormField>

        <FormField label="Lizenz-Risiko">
          <Select
            value={licenseRisk ?? ''}
            onValueChange={(val) =>
              setValue('license_risk', (val || null) as LicenseRisk | null, { shouldDirty: true })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Nicht bewertet">
                {licenseRisk ? LICENSE_RISK_LABELS[licenseRisk] : 'Nicht bewertet'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {licenseRiskEnum.options.map((r) => (
                <SelectItem key={r} value={r}>
                  {LICENSE_RISK_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </FormSection>

      {/* Plattformen */}
      <FormSection title="Plattformen">
        <div className="col-span-2 flex flex-col gap-2">
          {platformEnum.options.map((p) => (
            <label key={p} className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={(platforms as Platform[]).includes(p)}
                onCheckedChange={() => togglePlatform(p)}
              />
              <span>{PLATFORM_LABELS[p]}</span>
            </label>
          ))}
        </div>
      </FormSection>

      {/* Notizen */}
      <FormSection title="Notizen">
        <FormField label="Interne Beschreibung" span2>
          <Textarea
            {...register('description_internal')}
            placeholder="Interne Notizen zum Produkt..."
            rows={3}
          />
        </FormField>

        <FormField label="Allgemeine Notizen" span2>
          <Textarea {...register('notes')} placeholder="Freitextnotizen..." rows={3} />
        </FormField>

        <FormField label="Upselling-Ideen" span2>
          <Textarea
            {...register('upsell_notes')}
            placeholder="Ideen für Cross-Selling und Upselling..."
            rows={3}
          />
        </FormField>
      </FormSection>

      {/* License Warning Dialog */}
      <LicenseWarningDialog
        open={showLicenseWarning}
        onOpenChange={setShowLicenseWarning}
        product={{
          license_type: licenseType ?? null,
          license_risk: licenseRisk ?? null,
          license_source: licenseSource ?? null,
        }}
        onConfirm={() => {
          setValue('status', 'online', { shouldDirty: true });
          setShowLicenseWarning(false);
        }}
        onCancel={() => setShowLicenseWarning(false)}
      />
    </div>
  );
}
