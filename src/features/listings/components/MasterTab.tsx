import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { LISTING_STATUS_LABELS, PLATFORM_LIMITS } from '../constants';
import type { ListingDetail } from '../listingsService';
import type { MasterListingFormValues } from '../masterFormSchema';
import type { InventoryMode, ListingStatus } from '../schemas';

const STATUS_OPTIONS: ListingStatus[] = ['draft', 'ready', 'online', 'paused', 'archived'];
type NullableNumberField =
  | 'stock_quantity'
  | 'processing_time_min_days'
  | 'processing_time_max_days'
  | 'weight_grams'
  | 'dimension_length_cm'
  | 'dimension_width_cm'
  | 'dimension_height_cm';

interface MasterTabProps {
  listing: ListingDetail;
  form: UseFormReturn<MasterListingFormValues>;
}

function toNullableNumber(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function MasterTab({ listing, form }: MasterTabProps) {
  const [tagInput, setTagInput] = useState('');
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = form;

  const title = watch('master_title') ?? '';
  const tags = watch('master_tags') ?? [];
  const inventoryMode = watch('inventory_mode');
  const language = watch('language');
  const appendLegalTexts = watch('append_legal_texts');

  const titleCounters = useMemo(
    () => [
      { key: 'etsy', label: 'Etsy', limit: PLATFORM_LIMITS.etsy.maxTitleLength },
      { key: 'ebay', label: 'eBay', limit: PLATFORM_LIMITS.ebay.maxTitleLength },
      { key: 'kleinanzeigen', label: 'KA', limit: PLATFORM_LIMITS.kleinanzeigen.maxTitleLength },
    ],
    [],
  );

  function addTags(raw: string) {
    const nextTags = raw
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (nextTags.length === 0) return;

    const merged = Array.from(new Set([...tags, ...nextTags])).slice(0, 20);
    setValue('master_tags', merged, { shouldDirty: true, shouldValidate: true });
    setTagInput('');
  }

  function removeTag(tag: string) {
    setValue(
      'master_tags',
      tags.filter((item) => item !== tag),
      { shouldDirty: true, shouldValidate: true },
    );
  }

  function setInventoryMode(mode: InventoryMode) {
    setValue('inventory_mode', mode, { shouldDirty: true, shouldValidate: true });
    if (mode === 'made_to_order') {
      setValue('stock_quantity', null, { shouldDirty: true, shouldValidate: true });
    }
  }

  function setNullableText(
    field: 'master_short_description' | 'master_long_description' | 'sku_base',
    value: string,
  ) {
    setValue(field, value.trim() === '' ? null : value, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function setNullableNumber(field: NullableNumberField, value: string) {
    setValue(field, toNullableNumber(value), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(280px,2fr)]">
      <div className="space-y-5">
        <Field label="Produkt">
          <Input value={listing.product_name ?? listing.product_id} readOnly />
        </Field>

        <Field label="Master-Titel" error={errors.master_title?.message}>
          <Input {...register('master_title')} />
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-text-muted">
            {titleCounters.map((counter) => (
              <span
                key={counter.key}
                className={cn(title.length > counter.limit && 'font-medium text-danger')}
              >
                {title.length} / {counter.limit} {counter.label}
              </span>
            ))}
          </div>
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Basispreis" error={errors.base_price?.message}>
            <Input
              type="number"
              min="0"
              step="0.01"
              {...register('base_price', { valueAsNumber: true })}
            />
          </Field>
          <Field label="SKU-Basis" error={errors.sku_base?.message}>
            <Input
              value={watch('sku_base') ?? ''}
              onChange={(event) => setNullableText('sku_base', event.target.value)}
              placeholder="PG-VASE-001"
            />
          </Field>
        </div>

        <Field label="Master-Kurzbeschreibung" error={errors.master_short_description?.message}>
          <Textarea
            rows={3}
            value={watch('master_short_description') ?? ''}
            onChange={(event) => setNullableText('master_short_description', event.target.value)}
          />
        </Field>

        <Field label="Master-Langbeschreibung" error={errors.master_long_description?.message}>
          <Textarea
            rows={8}
            className="min-h-40"
            value={watch('master_long_description') ?? ''}
            onChange={(event) => setNullableText('master_long_description', event.target.value)}
          />
        </Field>

        <Field label="Master-Tags" error={errors.master_tags?.message}>
          <div className="rounded-lg border border-input p-2">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex h-6 items-center gap-1 rounded-full bg-bg-secondary px-2 text-xs text-text-primary"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="rounded-full p-0.5 hover:bg-bg-hover"
                    aria-label={`${tag} entfernen`}
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
            <Input
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ',') {
                  event.preventDefault();
                  addTags(tagInput);
                }
              }}
              onBlur={() => addTags(tagInput)}
              placeholder="Tag eingeben, Enter oder Komma"
            />
          </div>
          <p className="mt-1 text-xs text-text-muted">{tags.length} / 20 Tags</p>
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Inventory-Modus">
            <div className="flex rounded-lg border border-input p-1">
              <button
                type="button"
                onClick={() => setInventoryMode('made_to_order')}
                className={cn(
                  'flex-1 rounded-md px-3 py-1.5 text-sm transition-colors',
                  inventoryMode === 'made_to_order'
                    ? 'bg-bg-secondary text-text-primary'
                    : 'text-text-secondary hover:bg-bg-hover',
                )}
              >
                Auf Bestellung
              </button>
              <button
                type="button"
                onClick={() => setInventoryMode('stock')}
                className={cn(
                  'flex-1 rounded-md px-3 py-1.5 text-sm transition-colors',
                  inventoryMode === 'stock'
                    ? 'bg-bg-secondary text-text-primary'
                    : 'text-text-secondary hover:bg-bg-hover',
                )}
              >
                Lagerbestand
              </button>
            </div>
          </Field>

          {inventoryMode === 'stock' && (
            <Field label="Lagerbestand" error={errors.stock_quantity?.message}>
              <Input
                type="number"
                min="0"
                step="1"
                value={watch('stock_quantity') ?? ''}
                onChange={(event) => setNullableNumber('stock_quantity', event.target.value)}
              />
            </Field>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Bearbeitungszeit Min." error={errors.processing_time_min_days?.message}>
            <Input
              type="number"
              min="0"
              step="1"
              value={watch('processing_time_min_days') ?? ''}
              onChange={(event) =>
                setNullableNumber('processing_time_min_days', event.target.value)
              }
            />
          </Field>
          <Field label="Bearbeitungszeit Max." error={errors.processing_time_max_days?.message}>
            <Input
              type="number"
              min="0"
              step="1"
              value={watch('processing_time_max_days') ?? ''}
              onChange={(event) =>
                setNullableNumber('processing_time_max_days', event.target.value)
              }
            />
          </Field>
        </div>

        <Field label="Versandgewicht (g)" error={errors.weight_grams?.message}>
          <Input
            type="number"
            min="0"
            step="0.1"
            value={watch('weight_grams') ?? ''}
            onChange={(event) => setNullableNumber('weight_grams', event.target.value)}
          />
        </Field>

        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Länge (cm)" error={errors.dimension_length_cm?.message}>
            <Input
              type="number"
              min="0"
              step="0.1"
              value={watch('dimension_length_cm') ?? ''}
              onChange={(event) => setNullableNumber('dimension_length_cm', event.target.value)}
            />
          </Field>
          <Field label="Breite (cm)" error={errors.dimension_width_cm?.message}>
            <Input
              type="number"
              min="0"
              step="0.1"
              value={watch('dimension_width_cm') ?? ''}
              onChange={(event) => setNullableNumber('dimension_width_cm', event.target.value)}
            />
          </Field>
          <Field label="Höhe (cm)" error={errors.dimension_height_cm?.message}>
            <Input
              type="number"
              min="0"
              step="0.1"
              value={watch('dimension_height_cm') ?? ''}
              onChange={(event) => setNullableNumber('dimension_height_cm', event.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Sprache">
            <div className="flex rounded-lg border border-input p-1">
              {(['de', 'en'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setValue('language', value, { shouldDirty: true })}
                  className={cn(
                    'flex-1 rounded-md px-3 py-1.5 text-sm transition-colors',
                    language === value
                      ? 'bg-bg-secondary text-text-primary'
                      : 'text-text-secondary hover:bg-bg-hover',
                  )}
                >
                  {value.toUpperCase()}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Status">
            <Select
              value={watch('status')}
              onValueChange={(value) => {
                if (value) {
                  setValue('status', value as ListingStatus, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue>{LISTING_STATUS_LABELS[watch('status')]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {LISTING_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-text-primary">
          <Checkbox
            checked={appendLegalTexts}
            onCheckedChange={(checked) =>
              setValue('append_legal_texts', Boolean(checked), {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
          />
          <span>Rechtstexte automatisch anhängen</span>
        </label>
      </div>

      <aside className="space-y-4">
        <div className="rounded-lg border border-border-subtle bg-bg-elevated p-4 text-sm text-text-secondary dark:border-transparent">
          Master-Daten sind Standardwerte. In den Plattform-Tabs kannst du diese pro Plattform
          überschreiben.
        </div>

        <div className="space-y-2 rounded-lg border border-border-subtle bg-bg-elevated p-4 dark:border-transparent">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">KI-Aktionen</p>
          {['Titel verbessern', 'Beschreibung generieren', 'Tags vorschlagen'].map((label) => (
            <Button
              key={label}
              variant="ghost"
              size="sm"
              disabled
              title="Wird in Modul 06 verfügbar"
              className="w-full justify-start gap-1.5"
            >
              <Sparkles size={14} />
              <span>{label}</span>
            </Button>
          ))}
        </div>
      </aside>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-text-secondary">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}
