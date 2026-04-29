import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { Copy, ExternalLink } from 'lucide-react';
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

interface KleinanzeigenMetadata extends Record<string, unknown> {
  postal_code?: string | null;
  city?: string | null;
  shipping_available?: boolean;
  shipping_cost?: number | null;
}

interface KleinanzeigenTabProps {
  listing: ListingDetail;
  onChanged: () => void;
}

export function KleinanzeigenTab({ listing, onChanged }: KleinanzeigenTabProps) {
  const override = listing.overrides.find((entry) => entry.platform === 'kleinanzeigen') ?? null;
  const resolved = resolveListingForPlatform(listing, override, 'kleinanzeigen');
  const metadata = useMemo(() => getMetadata(override), [override]);
  const [title, setTitle] = useState(override?.title_override ?? '');
  const [description, setDescription] = useState(override?.long_description_override ?? '');
  const [price, setPrice] = useState(override?.price_override?.toString() ?? '');
  const [postalCode, setPostalCode] = useState(metadata.postal_code ?? '');
  const [city, setCity] = useState(metadata.city ?? '');
  const [shippingAvailable, setShippingAvailable] = useState(metadata.shipping_available ?? false);
  const [shippingCost, setShippingCost] = useState(metadata.shipping_cost?.toString() ?? '');

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      setTitle(override?.title_override ?? '');
      setDescription(override?.long_description_override ?? '');
      setPrice(override?.price_override?.toString() ?? '');
      setPostalCode(metadata.postal_code ?? '');
      setCity(metadata.city ?? '');
      setShippingAvailable(metadata.shipping_available ?? false);
      setShippingCost(metadata.shipping_cost?.toString() ?? '');
    });

    return () => {
      cancelled = true;
    };
  }, [metadata, override]);

  async function save(data: UpdateOverrideInput) {
    try {
      await upsertOverride(listing.id, 'kleinanzeigen', { ...data, sync_status: 'manual' });
      onChanged();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Kleinanzeigen-Daten konnten nicht gespeichert werden',
      );
    }
  }

  function metadataUpdate(next?: Partial<KleinanzeigenMetadata>): KleinanzeigenMetadata {
    return {
      ...metadata,
      postal_code: nullableText(postalCode),
      city: nullableText(city),
      shipping_available: shippingAvailable,
      shipping_cost: shippingAvailable ? nullableNumber(shippingCost) : null,
      ...next,
    };
  }

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} kopiert`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `${label} konnte nicht kopiert werden`);
    }
  }

  const resolvedTitle = title.trim() || resolved.title;
  const resolvedDescription = description.trim() || resolved.description;
  const completeText = `${resolvedTitle}\n\n${resolvedDescription}${
    listing.append_legal_texts ? '\n\n{{Rechtstexte werden in Modul 07 angehängt}}' : ''
  }`;

  return (
    <PlatformTabBase
      platform="kleinanzeigen"
      override={override}
      isActive={override?.is_active ?? false}
      showSyncSection={false}
      onActiveChange={(active) =>
        void togglePlatformActive(listing.id, 'kleinanzeigen', active).then(onChanged)
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-border-subtle bg-bg-elevated p-4 text-sm text-text-secondary dark:border-transparent">
          Kleinanzeigen bietet keine API. Inserate werden manuell gepflegt. PolyGrid hilft dir mit
          fertig formatierten Texten.
        </div>

        <Field label="Titel-Override">
          <Input
            value={title}
            placeholder={listing.master_title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => void save({ title_override: nullableText(title) })}
          />
          <p
            className={
              title.length > PLATFORM_LIMITS.kleinanzeigen.maxTitleLength
                ? 'mt-1 text-xs text-danger'
                : 'mt-1 text-xs text-text-muted'
            }
          >
            {title.length} / {PLATFORM_LIMITS.kleinanzeigen.maxTitleLength}
          </p>
        </Field>

        <Field label="Beschreibung-Override">
          <Textarea
            rows={8}
            value={description}
            placeholder={resolved.description}
            onChange={(event) => setDescription(event.target.value)}
            onBlur={() => void save({ long_description_override: nullableText(description) })}
          />
          <p className="mt-1 text-xs text-text-muted">Nur reiner Text</p>
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
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
          <Field label="PLZ">
            <Input
              maxLength={5}
              value={postalCode}
              onChange={(event) => setPostalCode(event.target.value)}
              onBlur={() => void save({ platform_metadata: metadataUpdate() })}
            />
          </Field>
          <Field label="Stadt">
            <Input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              onBlur={() => void save({ platform_metadata: metadataUpdate() })}
            />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={shippingAvailable}
            onCheckedChange={(checked) => {
              const next = Boolean(checked);
              setShippingAvailable(next);
              void save({ platform_metadata: metadataUpdate({ shipping_available: next }) });
            }}
          />
          <span>Versand anbieten</span>
        </label>

        {shippingAvailable && (
          <Field label="Versandkosten">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={shippingCost}
              onChange={(event) => setShippingCost(event.target.value)}
              onBlur={() => void save({ platform_metadata: metadataUpdate() })}
            />
          </Field>
        )}

        <div className="flex flex-wrap gap-2 rounded-lg border border-border-subtle bg-bg-elevated p-4 dark:border-transparent">
          <Button
            variant="ghost"
            onClick={() => void copyText(resolvedTitle, 'Titel')}
            className="gap-1.5"
          >
            <Copy size={14} />
            Titel kopieren
          </Button>
          <Button
            variant="ghost"
            onClick={() => void copyText(resolvedDescription, 'Beschreibung')}
            className="gap-1.5"
          >
            <Copy size={14} />
            Beschreibung kopieren
          </Button>
          <Button
            variant="ghost"
            onClick={() => void copyText(completeText, 'Komplett-Text')}
            className="gap-1.5"
          >
            <Copy size={14} />
            Komplett-Text kopieren
          </Button>
          <Button
            onClick={() => void openUrl('https://www.kleinanzeigen.de/p-anzeige-aufgeben.html')}
            className="gap-1.5"
          >
            <ExternalLink size={14} />
            Auf kleinanzeigen.de inserieren
          </Button>
        </div>
      </div>
    </PlatformTabBase>
  );
}

function getMetadata(override: ListingPlatformOverride | null): KleinanzeigenMetadata {
  return (override?.platform_metadata ?? {}) as KleinanzeigenMetadata;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-text-secondary">{label}</span>
      {children}
    </label>
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
