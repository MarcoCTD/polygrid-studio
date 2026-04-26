import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getOneDriveBasePath } from '@/services/filesystem';
import { createProductFolderStructure } from '@/features/files/productFolders';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import {
  statusEnum,
  materialTypeEnum,
  licenseTypeEnum,
  licenseRiskEnum,
  shippingClassEnum,
  type ProductCreate,
  type Status,
  type MaterialType,
  type LicenseType,
  type LicenseRisk,
  type ShippingClass,
} from '../schema';
import { createProduct } from '../db';
import { calculateMargin, getMarginColor, getMarginLabel } from '../margin';
import { getProductSettings } from '../settings';
import type { ProductSettings } from '../defaults';
import { formatEUR } from '../utils';
import {
  STATUS_LABELS,
  MATERIAL_LABELS,
  LICENSE_TYPE_LABELS,
  LICENSE_RISK_LABELS,
  SHIPPING_LABELS,
} from '../labels';

// ============================================================
// Per-Step Zod Schemas
// ============================================================

const step1Schema = z.object({
  name: z.string().min(2, 'Name muss mindestens 2 Zeichen haben').max(200),
  category: z.string().min(1, 'Kategorie ist erforderlich'),
  subcategory: z.string().optional().nullable(),
  material_type: materialTypeEnum,
  status: statusEnum,
  collection: z.string().optional().nullable(),
});

const step2Schema = z.object({
  print_time_minutes: z.number().int().min(0).max(10080).optional().nullable(),
  material_grams: z.number().min(0).max(10000).optional().nullable(),
  packaging_cost: z.number().min(0).optional().nullable(),
  shipping_class: shippingClassEnum.optional().nullable(),
  target_price: z.number().min(0).optional().nullable(),
  min_price: z.number().min(0).optional().nullable(),
});

const step3Schema = z.object({
  license_source: z.string().optional().nullable(),
  license_type: licenseTypeEnum.optional().nullable(),
  license_url: z.string().url().optional().nullable().or(z.literal('')).or(z.null()),
  license_risk: licenseRiskEnum.optional().nullable(),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;
type Step3Data = z.infer<typeof step3Schema>;

// ============================================================
// Form Field Helper
// ============================================================

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1.5 text-xs text-text-secondary">{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs text-[var(--accent-danger)]">{error}</p>}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  placeholder,
  error,
}: {
  label: string;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  placeholder?: string;
  error?: string;
}) {
  return (
    <FormField label={label} error={error}>
      <Input
        type="number"
        step="any"
        placeholder={placeholder}
        value={value === null || value === undefined ? '' : String(value)}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      />
    </FormField>
  );
}

// ============================================================
// Step Indicator
// ============================================================

const STEP_NAMES = ['Basics', 'Kosten', 'Lizenz', 'Übersicht'];

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-2">
      {STEP_NAMES.map((name, i) => (
        <div key={name} className="flex items-center gap-2">
          <div
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
              i < currentStep
                ? 'bg-pg-accent text-white'
                : i === currentStep
                  ? 'bg-pg-accent text-white'
                  : 'bg-bg-hover text-text-muted',
            )}
          >
            {i + 1}
          </div>
          <span
            className={cn(
              'text-xs',
              i === currentStep ? 'font-medium text-text-primary' : 'text-text-muted',
            )}
          >
            {name}
          </span>
          {i < STEP_NAMES.length - 1 && <div className="h-px w-4 bg-border-subtle" />}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

interface NewProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function NewProductDialog({ open, onOpenChange, onCreated }: NewProductDialogProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingProductFolder, setIsCreatingProductFolder] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [createdProductPrompt, setCreatedProductPrompt] = useState<{
    id: string;
    name: string;
    basePath: string;
  } | null>(null);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [settings, setSettings] = useState<ProductSettings | null>(null);

  // Per-step form instances
  const form1 = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      name: '',
      category: '',
      subcategory: null,
      material_type: 'PLA',
      status: 'idea',
      collection: null,
    },
  });

  const form2 = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      print_time_minutes: null,
      material_grams: null,
      packaging_cost: null,
      shipping_class: null,
      target_price: null,
      min_price: null,
    },
  });

  const form3 = useForm<Step3Data>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      license_source: null,
      license_type: null,
      license_url: null,
      license_risk: null,
    },
  });

  // Load settings for margin calculation in step 4
  useEffect(() => {
    getProductSettings().then(setSettings).catch(console.error);
  }, []);

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setStep(0);
      form1.reset();
      form2.reset();
      form3.reset();
    }
  }, [open, form1, form2, form3]);

  const allData = useMemo(() => {
    const d1 = form1.getValues();
    const d2 = form2.getValues();
    const d3 = form3.getValues();
    return { ...d1, ...d2, ...d3 };
  }, [form1, form2, form3]);

  // Check if any data has been entered (for cancel confirmation)
  const hasData = () => {
    const d1 = form1.getValues();
    return d1.name !== '' || d1.category !== '';
  };

  const handleNext = async () => {
    if (step === 0) {
      const valid = await form1.trigger();
      if (!valid) return;
    } else if (step === 1) {
      const valid = await form2.trigger();
      if (!valid) return;
    } else if (step === 2) {
      const valid = await form3.trigger();
      if (!valid) return;
    }
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    setStep((s) => s - 1);
  };

  const handleCancel = () => {
    if (hasData()) {
      setShowCancelConfirm(true);
    } else {
      onOpenChange(false);
    }
  };

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const data = allData;
      const input: ProductCreate = {
        name: data.name,
        category: data.category,
        subcategory: data.subcategory ?? null,
        material_type: data.material_type,
        status: data.status,
        collection: data.collection ?? null,
        short_name: null,
        description_internal: null,
        color_variants: null,
        print_time_minutes: data.print_time_minutes ?? null,
        material_grams: data.material_grams ?? null,
        electricity_cost: null,
        packaging_cost: data.packaging_cost ?? null,
        shipping_class: data.shipping_class ?? null,
        target_price: data.target_price ?? null,
        min_price: data.min_price ?? null,
        price_etsy: null,
        price_ebay: null,
        price_kleinanzeigen: null,
        license_source: data.license_source ?? null,
        license_type: data.license_type ?? null,
        license_url: data.license_url || null,
        license_risk: data.license_risk ?? null,
        platforms: null,
        notes: null,
        upsell_notes: null,
        shipping_paid_by_customer: null,
      };

      const product = await createProduct(input);
      onOpenChange(false);
      onCreated?.();

      const basePath = await getOneDriveBasePath();
      if (basePath) {
        setCreatedProductPrompt({ id: product.id, name: product.name, basePath });
      } else {
        navigate({ to: '/products/$productId', params: { productId: product.id } });
      }
    } catch (err) {
      console.error('Fehler beim Erstellen:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const navigateToCreatedProduct = () => {
    if (!createdProductPrompt) return;
    const productId = createdProductPrompt.id;
    setCreatedProductPrompt(null);
    setFolderError(null);
    navigate({ to: '/products/$productId', params: { productId } });
  };

  const handleCreateProductFolder = async () => {
    if (!createdProductPrompt) return;

    setIsCreatingProductFolder(true);
    setFolderError(null);
    try {
      await createProductFolderStructure(createdProductPrompt.basePath, createdProductPrompt.name);
      navigateToCreatedProduct();
    } catch (err) {
      setFolderError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsCreatingProductFolder(false);
    }
  };

  // Step 4: Summary with margin
  const marginResult = useMemo(() => {
    if (!settings) return null;
    const data = allData;
    // Build a mock product for margin calculation
    const mockProduct = {
      id: '',
      name: data.name,
      short_name: null,
      category: data.category,
      subcategory: null,
      description_internal: null,
      collection: null,
      status: data.status,
      material_type: data.material_type,
      color_variants: null,
      print_time_minutes: data.print_time_minutes ?? null,
      material_grams: data.material_grams ?? null,
      electricity_cost: null,
      packaging_cost: data.packaging_cost ?? null,
      shipping_class: data.shipping_class ?? null,
      target_price: data.target_price ?? null,
      min_price: data.min_price ?? null,
      price_etsy: null,
      price_ebay: null,
      price_kleinanzeigen: null,
      estimated_margin: null,
      license_source: null,
      license_type: null,
      license_url: null,
      license_risk: null,
      platforms: null,
      notes: null,
      upsell_notes: null,
      primary_image_path: null,
      shipping_paid_by_customer: null,
      created_at: '',
      updated_at: '',
      deleted_at: null,
    };
    return calculateMargin(mockProduct, settings, null);
  }, [allData, settings]);

  return (
    <>
      <Dialog open={open} onOpenChange={handleCancel}>
        <DialogContent className="sm:max-w-[560px]" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Neues Produkt</DialogTitle>
            <StepIndicator currentStep={step} />
          </DialogHeader>

          <div className="min-h-[280px]">
            {/* Step 1: Basics */}
            {step === 0 && (
              <div className="flex flex-col gap-3">
                <FormField label="Name *" error={form1.formState.errors.name?.message}>
                  <Input {...form1.register('name')} placeholder="Produktname" />
                </FormField>
                <FormField label="Kategorie *" error={form1.formState.errors.category?.message}>
                  <Input {...form1.register('category')} placeholder="z.B. Deko, Organizer" />
                </FormField>
                <FormField label="Unterkategorie">
                  <Input {...form1.register('subcategory')} placeholder="Optional" />
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Material *">
                    <Select
                      value={form1.watch('material_type')}
                      onValueChange={(val) => {
                        if (val) form1.setValue('material_type', val as MaterialType);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>{MATERIAL_LABELS[form1.watch('material_type')]}</SelectValue>
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
                  <FormField label="Status">
                    <Select
                      value={form1.watch('status')}
                      onValueChange={(val) => {
                        if (val) form1.setValue('status', val as Status);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>{STATUS_LABELS[form1.watch('status')]}</SelectValue>
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
                </div>
                <FormField label="Kollektion">
                  <Input {...form1.register('collection')} placeholder="z.B. Minimal, Industrial" />
                </FormField>
              </div>
            )}

            {/* Step 2: Kosten */}
            {step === 1 && (
              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  label="Druckzeit (Min.)"
                  value={form2.watch('print_time_minutes')}
                  onChange={(v) => form2.setValue('print_time_minutes', v)}
                  placeholder="z.B. 120"
                />
                <NumberField
                  label="Material (g)"
                  value={form2.watch('material_grams')}
                  onChange={(v) => form2.setValue('material_grams', v)}
                  placeholder="z.B. 50"
                />
                <NumberField
                  label="Verpackung (EUR)"
                  value={form2.watch('packaging_cost')}
                  onChange={(v) => form2.setValue('packaging_cost', v)}
                  placeholder="z.B. 0.50"
                />
                <FormField label="Versandklasse">
                  <Select
                    value={form2.watch('shipping_class') ?? ''}
                    onValueChange={(val) =>
                      form2.setValue('shipping_class', (val || null) as ShippingClass | null)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Keine">
                        {form2.watch('shipping_class')
                          ? SHIPPING_LABELS[form2.watch('shipping_class')!]
                          : 'Keine'}
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
                <NumberField
                  label="Zielpreis (EUR)"
                  value={form2.watch('target_price')}
                  onChange={(v) => form2.setValue('target_price', v)}
                  placeholder="z.B. 14.99"
                />
                <NumberField
                  label="Mindestpreis (EUR)"
                  value={form2.watch('min_price')}
                  onChange={(v) => form2.setValue('min_price', v)}
                  placeholder="z.B. 9.99"
                />
              </div>
            )}

            {/* Step 3: Lizenz */}
            {step === 2 && (
              <div className="flex flex-col gap-3">
                <FormField label="Quelle">
                  <Input
                    {...form3.register('license_source')}
                    placeholder="z.B. Thingiverse, Printables, Eigen"
                  />
                </FormField>
                <FormField label="Lizenztyp">
                  <Select
                    value={form3.watch('license_type') ?? ''}
                    onValueChange={(val) =>
                      form3.setValue('license_type', (val || null) as LicenseType | null)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Nicht gesetzt">
                        {form3.watch('license_type')
                          ? LICENSE_TYPE_LABELS[form3.watch('license_type')!]
                          : 'Nicht gesetzt'}
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
                <FormField
                  label="Lizenz-URL"
                  error={form3.formState.errors.license_url?.message as string | undefined}
                >
                  <Input {...form3.register('license_url')} placeholder="https://..." />
                </FormField>
                <FormField label="Lizenz-Risiko">
                  <Select
                    value={form3.watch('license_risk') ?? ''}
                    onValueChange={(val) =>
                      form3.setValue('license_risk', (val || null) as LicenseRisk | null)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Nicht bewertet">
                        {form3.watch('license_risk')
                          ? LICENSE_RISK_LABELS[form3.watch('license_risk')!]
                          : 'Nicht bewertet'}
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
              </div>
            )}

            {/* Step 4: Übersicht */}
            {step === 3 && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <SummaryRow label="Name" value={allData.name} />
                  <SummaryRow label="Kategorie" value={allData.category} />
                  <SummaryRow label="Material" value={MATERIAL_LABELS[allData.material_type]} />
                  <SummaryRow label="Status" value={STATUS_LABELS[allData.status]} />
                  {allData.target_price != null && (
                    <SummaryRow label="Zielpreis" value={formatEUR(allData.target_price)} />
                  )}
                  {allData.print_time_minutes != null && (
                    <SummaryRow label="Druckzeit" value={`${allData.print_time_minutes} Min.`} />
                  )}
                  {allData.material_grams != null && (
                    <SummaryRow label="Material" value={`${allData.material_grams} g`} />
                  )}
                  {allData.license_type && (
                    <SummaryRow label="Lizenz" value={LICENSE_TYPE_LABELS[allData.license_type]} />
                  )}
                  {allData.license_risk && (
                    <SummaryRow label="Risiko" value={LICENSE_RISK_LABELS[allData.license_risk]} />
                  )}
                </div>

                {/* Live Margin */}
                {marginResult && allData.target_price != null && allData.target_price > 0 && (
                  <div
                    className={cn(
                      'rounded-lg p-3',
                      getMarginColor(marginResult.marginPercent) === 'success' &&
                        'bg-success-subtle',
                      getMarginColor(marginResult.marginPercent) === 'warning' &&
                        'bg-warning-subtle',
                      getMarginColor(marginResult.marginPercent) === 'danger' && 'bg-danger-subtle',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Geschätzte Marge</span>
                      <span
                        className={cn(
                          'text-lg font-bold tabular-nums',
                          getMarginColor(marginResult.marginPercent) === 'success' &&
                            'text-[var(--accent-success)]',
                          getMarginColor(marginResult.marginPercent) === 'warning' &&
                            'text-[var(--accent-warning)]',
                          getMarginColor(marginResult.marginPercent) === 'danger' &&
                            'text-[var(--accent-danger)]',
                        )}
                      >
                        {marginResult.marginPercent.toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary">
                      {getMarginLabel(marginResult.marginPercent)} — Rohgewinn{' '}
                      {formatEUR(marginResult.profit)}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={handleCancel}>
              Abbrechen
            </Button>
            <div className="flex gap-2">
              {step > 0 && (
                <Button variant="outline" onClick={handleBack}>
                  Zurück
                </Button>
              )}
              {step < 3 ? (
                <Button onClick={handleNext}>Weiter</Button>
              ) : (
                <Button onClick={handleCreate} disabled={isCreating}>
                  {isCreating ? 'Erstelle...' : 'Erstellen'}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eingaben verwerfen?</AlertDialogTitle>
            <AlertDialogDescription>
              Du hast bereits Daten eingegeben. Möchtest du das Formular wirklich schließen? Alle
              Eingaben gehen verloren.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Weiter bearbeiten</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setShowCancelConfirm(false);
                onOpenChange(false);
              }}
            >
              Verwerfen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={createdProductPrompt !== null}>
        <AlertDialogContent className="bg-bg-elevated text-text-primary">
          <AlertDialogHeader>
            <AlertDialogTitle>Produktordner anlegen?</AlertDialogTitle>
            <AlertDialogDescription className="text-text-secondary">
              Soll PolyGrid Studio automatisch einen Ordner für '{createdProductPrompt?.name ?? ''}'
              in deinem OneDrive anlegen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          {folderError ? <p className="text-sm text-danger">{folderError}</p> : null}
          <AlertDialogFooter className="bg-bg-elevated">
            <AlertDialogCancel onClick={navigateToCreatedProduct}>Später</AlertDialogCancel>
            <AlertDialogAction
              disabled={isCreatingProductFolder}
              onClick={() => void handleCreateProductFolder()}
            >
              {isCreatingProductFolder ? 'Legt an...' : 'Ja, anlegen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-text-secondary">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
