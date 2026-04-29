import { MapPin, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PLATFORM_LIMITS } from '../../constants';
import { calculateCompleteness, type ListingDetail } from '../../listingsService';
import type { ListingPlatformOverride } from '../../schemas';
import { resolveListingForPlatform } from '../../utils';
import { PreviewDiagnostics } from './PreviewDiagnostics';
import { formatCurrency, getCompletenessHints, truncateText } from './previewUtils';

interface KleinanzeigenMetadata extends Record<string, unknown> {
  postal_code?: string | null;
  city?: string | null;
  shipping_available?: boolean;
  shipping_cost?: number | null;
}

interface KleinanzeigenPreviewProps {
  listing: ListingDetail;
}

export function KleinanzeigenPreview({ listing }: KleinanzeigenPreviewProps) {
  const override = listing.overrides.find((entry) => entry.platform === 'kleinanzeigen') ?? null;
  const resolved = resolveListingForPlatform(listing, override, 'kleinanzeigen');
  const metadata = getMetadata(override);
  const completeness = calculateCompleteness(
    { ...listing, imageCount: listing.images.length },
    'kleinanzeigen',
  );
  const hints = getCompletenessHints(listing, 'kleinanzeigen', completeness);
  const location = [metadata.postal_code, metadata.city].filter(Boolean).join(' ');

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border-subtle bg-bg-elevated p-5 dark:border-transparent">
        <div className="space-y-3 border-b border-border-subtle pb-4 dark:border-transparent">
          <h2 className="text-2xl font-semibold leading-tight text-text-primary">
            {resolved.title}
          </h2>
          <p className="text-2xl font-semibold text-text-primary">
            {formatCurrency(resolved.price)}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
            <MapPin size={15} />
            <span>{location || 'Kein Standort hinterlegt'}</span>
            {metadata.shipping_available && (
              <Badge variant="outline" className="gap-1.5">
                <Truck size={13} />
                Versand
                {metadata.shipping_cost !== null && metadata.shipping_cost !== undefined
                  ? ` ${formatCurrency(metadata.shipping_cost)}`
                  : ''}
              </Badge>
            )}
          </div>
        </div>

        <section className="mt-5">
          <h3 className="mb-2 text-sm font-semibold text-text-primary">Beschreibung</h3>
          <p className="whitespace-pre-wrap text-sm leading-6 text-text-secondary">
            {truncateText(resolved.description, 4000) || 'Keine Beschreibung hinterlegt.'}
          </p>
        </section>
      </div>

      <PreviewDiagnostics
        completeness={completeness}
        hints={hints}
        counters={[
          {
            label: 'Titel',
            value: `${resolved.title.length}/${PLATFORM_LIMITS.kleinanzeigen.maxTitleLength}`,
            isOverLimit: resolved.title.length > PLATFORM_LIMITS.kleinanzeigen.maxTitleLength,
          },
        ]}
      />
    </div>
  );
}

function getMetadata(override: ListingPlatformOverride | null): KleinanzeigenMetadata {
  return (override?.platform_metadata ?? {}) as KleinanzeigenMetadata;
}
