import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ExternalLink, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PLATFORM_LIMITS } from '../constants';
import {
  togglePlatformActive,
  upsertOverride,
  type ListingDetail,
  type UpdateOverrideInput,
} from '../listingsService';
import { resolveListingForPlatform } from '../utils';
import type { ListingPlatformOverride } from '../schemas';
import { PlatformTabBase } from './PlatformTabBase';

interface EtsyMetadata extends Record<string, unknown> {
  materials?: string[];
  is_personalizable?: boolean;
}

interface EtsyTabProps {
  listing: ListingDetail;
  onChanged: () => void;
}

export function EtsyTab({ listing, onChanged }: EtsyTabProps) {
  const override = listing.overrides.find((entry) => entry.platform === 'etsy') ?? null;
  const resolved = resolveListingForPlatform(listing, override, 'etsy');
  const metadata = useMemo(() => getMetadata(override), [override]);
  const [title, setTitle] = useState(override?.title_override ?? '');
  const [description, setDescription] = useState(override?.long_description_override ?? '');
  const [tags, setTags] = useState<string[]>(override?.tags_override ?? []);
  const [tagInput, setTagInput] = useState('');
  const [price, setPrice] = useState(override?.price_override?.toString() ?? '');
  const [taxonomyId, setTaxonomyId] = useState(override?.platform_category_id ?? '');
  const [shippingProfileId, setShippingProfileId] = useState(override?.shipping_profile_id ?? '');
  const [returnPolicyId, setReturnPolicyId] = useState(override?.return_policy_id ?? '');
  const [materials, setMaterials] = useState<string[]>(metadata.materials ?? []);
  const [materialInput, setMaterialInput] = useState('');
  const [isPersonalizable, setIsPersonalizable] = useState(metadata.is_personalizable ?? false);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      setTitle(override?.title_override ?? '');
      setDescription(override?.long_description_override ?? '');
      setTags(override?.tags_override ?? []);
      setPrice(override?.price_override?.toString() ?? '');
      setTaxonomyId(override?.platform_category_id ?? '');
      setShippingProfileId(override?.shipping_profile_id ?? '');
      setReturnPolicyId(override?.return_policy_id ?? '');
      setMaterials(metadata.materials ?? []);
      setIsPersonalizable(metadata.is_personalizable ?? false);
    });

    return () => {
      cancelled = true;
    };
  }, [metadata, override]);

  const titleLimit = PLATFORM_LIMITS.etsy.maxTitleLength;
  const overTitleLimit = title.length > titleLimit;

  async function save(data: UpdateOverrideInput) {
    try {
      await upsertOverride(listing.id, 'etsy', data);
      onChanged();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Etsy-Daten konnten nicht gespeichert werden',
      );
    }
  }

  function addTags(raw: string) {
    const next = raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item) => item.length <= PLATFORM_LIMITS.etsy.maxTagLength);
    if (next.length === 0) return;
    setTags(Array.from(new Set([...tags, ...next])).slice(0, PLATFORM_LIMITS.etsy.maxTagCount));
    setTagInput('');
  }

  function addMaterials(raw: string) {
    const next = raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (next.length === 0) return;
    setMaterials(Array.from(new Set([...materials, ...next])));
    setMaterialInput('');
  }

  const metadataUpdate = useMemo<EtsyMetadata>(
    () => ({ ...metadata, materials, is_personalizable: isPersonalizable }),
    [isPersonalizable, materials, metadata],
  );

  return (
    <PlatformTabBase
      platform="etsy"
      override={override}
      isActive={override?.is_active ?? false}
      onActiveChange={(active) =>
        void togglePlatformActive(listing.id, 'etsy', active).then(onChanged)
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(280px,2fr)]">
        <div className="space-y-4">
          <Field label="Titel-Override">
            <Input
              value={title}
              placeholder={listing.master_title}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => void save({ title_override: nullableText(title) })}
            />
            <p
              className={
                overTitleLimit ? 'mt-1 text-xs text-danger' : 'mt-1 text-xs text-text-muted'
              }
            >
              {title.length} / {titleLimit}
            </p>
          </Field>

          <Field label="Beschreibung-Override">
            <Textarea
              rows={7}
              value={description}
              placeholder={resolved.description}
              onChange={(event) => setDescription(event.target.value)}
              onBlur={() => void save({ long_description_override: nullableText(description) })}
            />
          </Field>

          <ChipField
            label={`Tags-Override (${tags.length}/${PLATFORM_LIMITS.etsy.maxTagCount})`}
            values={tags}
            input={tagInput}
            placeholder={listing.master_tags.join(', ')}
            onInputChange={setTagInput}
            onAdd={addTags}
            onRemove={(tag) => setTags(tags.filter((item) => item !== tag))}
            onBlur={() => void save({ tags_override: tags.length > 0 ? tags : null })}
          />

          <Field label="Preis-Override">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={price}
              placeholder={String(listing.base_price)}
              onChange={(event) => setPrice(event.target.value)}
              onBlur={() => void save({ price_override: nullableNumber(price) })}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Etsy Taxonomy ID">
              <Input
                value={taxonomyId}
                onChange={(event) => setTaxonomyId(event.target.value)}
                onBlur={() => void save({ platform_category_id: nullableText(taxonomyId) })}
              />
            </Field>
            <Field label="Shipping Profile ID">
              <Input
                value={shippingProfileId}
                placeholder="z.B. 12345678"
                onChange={(event) => setShippingProfileId(event.target.value)}
                onBlur={() => void save({ shipping_profile_id: nullableText(shippingProfileId) })}
              />
            </Field>
            <Field label="Return Policy ID">
              <Input
                value={returnPolicyId}
                onChange={(event) => setReturnPolicyId(event.target.value)}
                onBlur={() => void save({ return_policy_id: nullableText(returnPolicyId) })}
              />
            </Field>
          </div>

          <ChipField
            label="Materials"
            values={materials}
            input={materialInput}
            onInputChange={setMaterialInput}
            onAdd={addMaterials}
            onRemove={(material) => setMaterials(materials.filter((item) => item !== material))}
            onBlur={() => void save({ platform_metadata: metadataUpdate })}
          />

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={isPersonalizable}
              onCheckedChange={(checked) => {
                const next = Boolean(checked);
                setIsPersonalizable(next);
                void save({
                  platform_metadata: { ...metadata, materials, is_personalizable: next },
                });
              }}
            />
            <span>Is Personalizable</span>
          </label>
        </div>

        <aside className="space-y-3">
          <a
            href="https://www.etsy.com/developers/documentation/getting_started/taxonomy"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-pg-accent hover:underline"
          >
            <ExternalLink size={14} />
            Etsy Taxonomy Dokumentation
          </a>
          <div className="space-y-2 rounded-lg border border-border-subtle bg-bg-elevated p-4 dark:border-transparent">
            <p className="text-xs font-medium uppercase text-text-muted">KI-Aktionen</p>
            {['Titel optimieren', 'Beschreibung generieren', 'Tags vorschlagen'].map((label) => (
              <Button
                key={label}
                variant="ghost"
                size="sm"
                disabled
                title="Wird in Modul 06 verfügbar"
                className="w-full justify-start gap-1.5"
              >
                <Sparkles size={14} />
                {label}
              </Button>
            ))}
          </div>
        </aside>
      </div>
    </PlatformTabBase>
  );
}

function getMetadata(override: ListingPlatformOverride | null): EtsyMetadata {
  return (override?.platform_metadata ?? {}) as EtsyMetadata;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-text-secondary">{label}</span>
      {children}
    </label>
  );
}

function ChipField({
  label,
  values,
  input,
  placeholder,
  onInputChange,
  onAdd,
  onRemove,
  onBlur,
}: {
  label: string;
  values: string[];
  input: string;
  placeholder?: string;
  onInputChange: (value: string) => void;
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
  onBlur: () => void;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium text-text-secondary">{label}</span>
      <div className="rounded-lg border border-input p-2">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {values.map((value) => (
            <span
              key={value}
              className="inline-flex h-6 items-center gap-1 rounded-full bg-bg-secondary px-2 text-xs"
            >
              {value}
              <button
                type="button"
                onClick={() => onRemove(value)}
                className="rounded-full p-0.5 hover:bg-bg-hover"
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
        <Input
          value={input}
          placeholder={placeholder}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault();
              onAdd(input);
            }
          }}
          onBlur={() => {
            onAdd(input);
            onBlur();
          }}
        />
      </div>
    </div>
  );
}

function nullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function nullableNumber(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
