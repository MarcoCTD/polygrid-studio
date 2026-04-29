import { Badge } from '@/components/ui/badge';
import { PLATFORM_LIMITS } from '../../constants';
import { calculateCompleteness, type ListingDetail } from '../../listingsService';
import type { ListingPlatformOverride } from '../../schemas';
import { resolveListingForPlatform } from '../../utils';
import { PreviewDiagnostics } from './PreviewDiagnostics';
import { formatCurrency, getCompletenessHints, truncateText } from './previewUtils';

interface ItemSpecific extends Record<string, unknown> {
  key: string;
  value: string;
}

interface EbayMetadata extends Record<string, unknown> {
  item_specifics?: ItemSpecific[];
}

interface EbayPreviewProps {
  listing: ListingDetail;
}

export function EbayPreview({ listing }: EbayPreviewProps) {
  const override = listing.overrides.find((entry) => entry.platform === 'ebay') ?? null;
  const resolved = resolveListingForPlatform(listing, override, 'ebay');
  const metadata = getMetadata(override);
  const itemSpecifics = (metadata.item_specifics ?? []).filter(
    (item) => item.key.trim() || item.value.trim(),
  );
  const completeness = calculateCompleteness(
    { ...listing, imageCount: listing.images.length },
    'ebay',
  );
  const hints = getCompletenessHints(listing, 'ebay', completeness);

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border-subtle bg-bg-elevated p-5 dark:border-transparent">
        <div className="border-b border-border-subtle pb-4 dark:border-transparent">
          <h2 className="text-2xl font-semibold leading-tight text-text-primary">
            {resolved.title}
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p className="text-2xl font-semibold text-text-primary">
              {formatCurrency(resolved.price)}
            </p>
            <Badge variant="outline">Neu</Badge>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
          <section>
            <h3 className="mb-2 text-sm font-semibold text-text-primary">Beschreibung</h3>
            <p className="whitespace-pre-wrap text-sm leading-6 text-text-secondary">
              {truncateText(resolved.description, 1800) || 'Keine Beschreibung hinterlegt.'}
            </p>
          </section>

          <aside>
            <h3 className="mb-2 text-sm font-semibold text-text-primary">Item Specifics</h3>
            {itemSpecifics.length > 0 ? (
              <div className="overflow-hidden rounded-md border border-border-subtle dark:border-transparent">
                {itemSpecifics.map((item, index) => (
                  <div
                    key={`${item.key}-${index}`}
                    className="grid grid-cols-2 border-b border-border-subtle text-sm last:border-b-0 dark:border-transparent"
                  >
                    <span className="bg-bg-secondary px-3 py-2 text-text-secondary">
                      {item.key || '-'}
                    </span>
                    <span className="px-3 py-2 text-text-primary">{item.value || '-'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-md border border-dashed border-border-subtle p-3 text-sm text-text-muted">
                Keine Item Specifics hinterlegt.
              </p>
            )}
          </aside>
        </div>
      </div>

      <PreviewDiagnostics
        completeness={completeness}
        hints={hints}
        counters={[
          {
            label: 'Titel',
            value: `${resolved.title.length}/${PLATFORM_LIMITS.ebay.maxTitleLength}`,
            isOverLimit: resolved.title.length > PLATFORM_LIMITS.ebay.maxTitleLength,
          },
        ]}
      />
    </div>
  );
}

function getMetadata(override: ListingPlatformOverride | null): EbayMetadata {
  return (override?.platform_metadata ?? {}) as EbayMetadata;
}
