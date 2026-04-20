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
import type {
  ProductUpdate,
  Status,
  MaterialType,
  LicenseType,
  LicenseRisk,
  ShippingClass,
  Platform,
} from '../schema';
import { ColorVariantsEditor } from './ColorVariantsEditor';

interface OverviewTabProps {
  form: UseFormReturn<ProductUpdate>;
}

// ============================================================
// Label Maps
// ============================================================

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'idea', label: 'Idee' },
  { value: 'review', label: 'Review' },
  { value: 'print_ready', label: 'Druckbereit' },
  { value: 'test_print', label: 'Testdruck' },
  { value: 'launch_ready', label: 'Startbereit' },
  { value: 'online', label: 'Online' },
  { value: 'paused', label: 'Pausiert' },
  { value: 'discontinued', label: 'Eingestellt' },
];

const MATERIAL_OPTIONS: { value: MaterialType; label: string }[] = [
  { value: 'PLA', label: 'PLA' },
  { value: 'PETG', label: 'PETG' },
  { value: 'TPU', label: 'TPU' },
  { value: 'ABS', label: 'ABS' },
  { value: 'Resin', label: 'Resin' },
];

const LICENSE_TYPE_OPTIONS: { value: LicenseType; label: string }[] = [
  { value: 'own', label: 'Eigenes Design' },
  { value: 'cc_by', label: 'CC BY' },
  { value: 'cc_by_sa', label: 'CC BY-SA' },
  { value: 'cc_by_nc', label: 'CC BY-NC' },
  { value: 'commercial', label: 'Kommerzielle Lizenz' },
  { value: 'unclear', label: 'Unklar' },
];

const LICENSE_RISK_OPTIONS: { value: LicenseRisk; label: string }[] = [
  { value: 'safe', label: 'Sicher' },
  { value: 'review_needed', label: 'Prüfung nötig' },
  { value: 'risky', label: 'Riskant' },
];

const SHIPPING_OPTIONS: { value: ShippingClass; label: string }[] = [
  { value: 'Brief', label: 'Brief' },
  { value: 'Warensendung', label: 'Warensendung' },
  { value: 'Paket', label: 'Paket' },
];

const PLATFORM_OPTIONS: { value: Platform; label: string }[] = [
  { value: 'etsy', label: 'Etsy' },
  { value: 'ebay', label: 'eBay' },
  { value: 'kleinanzeigen', label: 'Kleinanzeigen' },
];

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

  const platforms = watch('platforms') ?? [];
  const status = watch('status');
  const materialType = watch('material_type');
  const licenseType = watch('license_type');
  const licenseRisk = watch('license_risk');
  const shippingClass = watch('shipping_class');

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
              if (val) setValue('status', val as Status, { shouldDirty: true });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
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
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MATERIAL_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
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
              <SelectValue placeholder="Keine" />
            </SelectTrigger>
            <SelectContent>
              {SHIPPING_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
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
              <SelectValue placeholder="Nicht gesetzt" />
            </SelectTrigger>
            <SelectContent>
              {LICENSE_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
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
              <SelectValue placeholder="Nicht bewertet" />
            </SelectTrigger>
            <SelectContent>
              {LICENSE_RISK_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </FormSection>

      {/* Plattformen */}
      <FormSection title="Plattformen">
        <div className="col-span-2 flex flex-col gap-2">
          {PLATFORM_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={(platforms as Platform[]).includes(opt.value)}
                onCheckedChange={() => togglePlatform(opt.value)}
              />
              <span>{opt.label}</span>
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
    </div>
  );
}
