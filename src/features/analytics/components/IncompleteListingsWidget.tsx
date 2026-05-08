import { useNavigate } from '@tanstack/react-router';
import { Badge } from '@/components/ui/badge';
import { PLATFORM_LABELS, type Platform } from '@/features/listings';
import type { IncompleteListing } from '../types';
import { WidgetCard } from './WidgetCard';

interface IncompleteListingsWidgetProps {
  listings: IncompleteListing[];
}

function platformLabel(platform: string | null): string {
  if (!platform) return 'Master';
  return PLATFORM_LABELS[platform as Platform] ?? platform;
}

export function IncompleteListingsWidget({ listings }: IncompleteListingsWidgetProps) {
  const navigate = useNavigate();

  return (
    <WidgetCard
      title="Listings mit fehlenden Daten"
      viewAllTo="/listings"
      isEmpty={listings.length === 0}
      emptyMessage="Alle Listings vollständig"
    >
      <div className="divide-y divide-border-subtle">
        {listings.map((listing) => (
          <button
            key={listing.id}
            type="button"
            className="flex w-full flex-col gap-2 py-2.5 text-left hover:bg-bg-hover"
            onClick={() =>
              void navigate({ to: '/listings/$listingId', params: { listingId: listing.id } })
            }
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text-primary">{listing.title}</p>
                <p className="text-xs text-text-secondary">
                  {platformLabel(listing.platform)} · {listing.completeness}% vollständig
                </p>
              </div>
              <Badge variant="outline" className="shrink-0">
                {listing.completeness}%
              </Badge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {listing.missingFields.map((field) => (
                <Badge key={field} variant="outline" className="bg-warning-subtle text-warning">
                  {field}
                </Badge>
              ))}
            </div>
          </button>
        ))}
      </div>
    </WidgetCard>
  );
}
