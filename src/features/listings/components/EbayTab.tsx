import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
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

interface ItemSpecific extends Record<string, unknown> {
  key: string;
  value: string;
}

interface EbayMetadata extends Record<string, unknown> {
  item_specifics?: ItemSpecific[];
  best_offer?: boolean;
  fulfillment_policy_id?: string | null;
}

interface EbayTabProps {
  listing: ListingDetail;
  onChanged: () => void;
}

export function EbayTab({ listing, onChanged }: EbayTabProps) {
  const override = listing.overrides.find((entry) => entry.platform === 'ebay') ?? null;
  const resolved = resolveListingForPlatform(listing, override, 'ebay');
  const metadata = useMemo(() => getMetadata(override), [override]);
  const [title, setTitle] = useState(override?.title_override ?? '');
  const [description, setDescription] = useState(override?.long_description_override ?? '');
  const [price, setPrice] = useState(override?.price_override?.toString() ?? '');
  const [categoryId, setCategoryId] = useState(override?.platform_category_id ?? '');
  const [fulfillmentPolicyId, setFulfillmentPolicyId] = useState(
    metadata.fulfillment_policy_id ?? '',
  );
  const [paymentPolicyId, setPaymentPolicyId] = useState(override?.payment_policy_id ?? '');
  const [returnPolicyId, setReturnPolicyId] = useState(override?.return_policy_id ?? '');
  const [bestOffer, setBestOffer] = useState(metadata.best_offer ?? false);
  const [itemSpecifics, setItemSpecifics] = useState<ItemSpecific[]>(metadata.item_specifics ?? []);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      setTitle(override?.title_override ?? '');
      setDescription(override?.long_description_override ?? '');
      setPrice(override?.price_override?.toString() ?? '');
      setCategoryId(override?.platform_category_id ?? '');
      setFulfillmentPolicyId(metadata.fulfillment_policy_id ?? '');
      setPaymentPolicyId(override?.payment_policy_id ?? '');
      setReturnPolicyId(override?.return_policy_id ?? '');
      setBestOffer(metadata.best_offer ?? false);
      setItemSpecifics(metadata.item_specifics ?? []);
    });

    return () => {
      cancelled = true;
    };
  }, [metadata, override]);

  async function save(data: UpdateOverrideInput) {
    try {
      await upsertOverride(listing.id, 'ebay', data);
      onChanged();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'eBay-Daten konnten nicht gespeichert werden',
      );
    }
  }

  function metadataUpdate(next?: Partial<EbayMetadata>): EbayMetadata {
    return {
      ...metadata,
      fulfillment_policy_id: nullableText(fulfillmentPolicyId),
      best_offer: bestOffer,
      item_specifics: itemSpecifics.filter((item) => item.key.trim() || item.value.trim()),
      ...next,
    };
  }

  function updateSpecific(index: number, patch: Partial<ItemSpecific>) {
    setItemSpecifics((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
  }

  return (
    <PlatformTabBase
      platform="ebay"
      override={override}
      isActive={override?.is_active ?? false}
      onActiveChange={(active) =>
        void togglePlatformActive(listing.id, 'ebay', active).then(onChanged)
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-border-subtle bg-bg-elevated p-4 text-sm text-text-secondary dark:border-transparent">
          eBay benötigt Business Policies. Diese müssen vorab im eBay Seller Hub angelegt werden.
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
              title.length > PLATFORM_LIMITS.ebay.maxTitleLength
                ? 'mt-1 text-xs text-danger'
                : 'mt-1 text-xs text-text-muted'
            }
          >
            {title.length} / {PLATFORM_LIMITS.ebay.maxTitleLength}
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
          <p className="mt-1 text-xs text-text-muted">HTML erlaubt</p>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
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
          <Field label="eBay Category ID">
            <Input
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              onBlur={() => void save({ platform_category_id: nullableText(categoryId) })}
            />
          </Field>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-text-secondary">Item Specifics</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setItemSpecifics([...itemSpecifics, { key: '', value: '' }])}
              className="gap-1.5"
            >
              <Plus size={14} />
              Zeile
            </Button>
          </div>
          {itemSpecifics.map((specific, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_32px] gap-2">
              <Input
                value={specific.key}
                placeholder="Brand"
                onChange={(event) => updateSpecific(index, { key: event.target.value })}
                onBlur={() => void save({ platform_metadata: metadataUpdate() })}
              />
              <Input
                value={specific.value}
                placeholder="PolyGrid"
                onChange={(event) => updateSpecific(index, { value: event.target.value })}
                onBlur={() => void save({ platform_metadata: metadataUpdate() })}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  const next = itemSpecifics.filter((_, itemIndex) => itemIndex !== index);
                  setItemSpecifics(next);
                  void save({ platform_metadata: metadataUpdate({ item_specifics: next }) });
                }}
              >
                <X size={14} />
              </Button>
            </div>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={bestOffer}
            onCheckedChange={(checked) => {
              const next = Boolean(checked);
              setBestOffer(next);
              void save({ platform_metadata: metadataUpdate({ best_offer: next }) });
            }}
          />
          <span>Best Offer akzeptieren</span>
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Fulfillment Policy ID">
            <Input
              value={fulfillmentPolicyId}
              onChange={(event) => setFulfillmentPolicyId(event.target.value)}
              onBlur={() => void save({ platform_metadata: metadataUpdate() })}
            />
          </Field>
          <Field label="Payment Policy ID">
            <Input
              value={paymentPolicyId}
              onChange={(event) => setPaymentPolicyId(event.target.value)}
              onBlur={() => void save({ payment_policy_id: nullableText(paymentPolicyId) })}
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
      </div>
    </PlatformTabBase>
  );
}

function getMetadata(override: ListingPlatformOverride | null): EbayMetadata {
  return (override?.platform_metadata ?? {}) as EbayMetadata;
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
