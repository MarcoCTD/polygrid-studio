import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PLATFORM_LABELS, PLATFORMS } from '../constants';
import type { CompletenessResult, CompletenessStatus } from '../listingsService';
import type { ListingPlatformOverride, Platform, ListingStatus } from '../schemas';

const PLATFORM_SHORT_LABELS: Record<Platform, string> = {
  etsy: 'E',
  ebay: 'eB',
  kleinanzeigen: 'KA',
};

const STATUS_TEXT: Record<string, string> = {
  manual: 'manuell',
  pending: 'ausstehend',
  synced: 'synchronisiert',
  error: 'Fehler',
  draft: 'Entwurf',
  ready: 'bereit',
  online: 'online',
  paused: 'pausiert',
  archived: 'archiviert',
};

const COMPLETENESS_CLASSES: Record<CompletenessStatus, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-400',
  red: 'bg-red-500',
};

interface PlatformStatusBadgesProps {
  overrides: ListingPlatformOverride[];
  masterStatus: ListingStatus;
  completeness?: Record<Platform, CompletenessResult>;
}

function badgeClass(override: ListingPlatformOverride | undefined, masterStatus: ListingStatus) {
  if (!override?.is_active) return 'bg-zinc-100 text-zinc-500 border-zinc-200';
  if (override.sync_status === 'error') return 'bg-red-100 text-red-700 border-red-200';
  if (override.sync_status === 'synced' || masterStatus === 'online') {
    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  }
  if (override.sync_status === 'pending' || masterStatus === 'draft') {
    return 'bg-amber-100 text-amber-700 border-amber-200';
  }
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function tooltipText(
  platform: Platform,
  override: ListingPlatformOverride | undefined,
  masterStatus: ListingStatus,
  completeness: CompletenessResult | undefined,
) {
  const hints = completeness?.hints.slice(0, 3) ?? [];
  if (!override) {
    return [`${PLATFORM_LABELS[platform]}: inaktiv`, ...hints].join('\n');
  }
  const sync = STATUS_TEXT[override.sync_status] ?? override.sync_status;
  const status = STATUS_TEXT[masterStatus] ?? masterStatus;
  return [
    `${PLATFORM_LABELS[platform]}: ${override.is_active ? 'aktiv' : 'inaktiv'}, Sync ${sync}, Listing ${status}`,
    ...hints,
  ].join('\n');
}

export function PlatformStatusBadges({
  overrides,
  masterStatus,
  completeness,
}: PlatformStatusBadgesProps) {
  return (
    <div className="flex items-center gap-1">
      {PLATFORMS.map((platform) => {
        const override = overrides.find((entry) => entry.platform === platform);
        const completenessResult = completeness?.[platform];
        return (
          <Badge
            key={platform}
            variant="outline"
            title={tooltipText(platform, override, masterStatus, completenessResult)}
            className={cn(
              'h-5 min-w-7 gap-1 border px-1.5 font-mono text-[10px]',
              badgeClass(override, masterStatus),
            )}
          >
            {completenessResult && (
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  COMPLETENESS_CLASSES[completenessResult.status],
                )}
              />
            )}
            {PLATFORM_SHORT_LABELS[platform]}
          </Badge>
        );
      })}
    </div>
  );
}
