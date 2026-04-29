import { openUrl } from '@tauri-apps/plugin-opener';
import type { ReactNode } from 'react';
import { ExternalLink, Rocket } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { PLATFORM_LABELS } from '../constants';
import type { ListingPlatformOverride, Platform, SyncStatus } from '../schemas';

const SYNC_STATUS_LABELS: Record<SyncStatus, string> = {
  manual: 'Manuell',
  pending: 'Ausstehend',
  synced: 'Synchronisiert',
  error: 'Fehler',
};

const SYNC_STATUS_CLASSES: Record<SyncStatus, string> = {
  manual: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  synced: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  error: 'bg-red-100 text-red-700 border-red-200',
};

interface PlatformTabBaseProps {
  platform: Platform;
  override: ListingPlatformOverride | null;
  isActive: boolean;
  onActiveChange: (isActive: boolean) => void;
  children: ReactNode;
  showSyncSection?: boolean;
}

export function PlatformTabBase({
  platform,
  override,
  isActive,
  onActiveChange,
  children,
  showSyncSection = true,
}: PlatformTabBaseProps) {
  const syncStatus = override?.sync_status ?? 'manual';

  async function openExternalListing() {
    if (!override?.external_listing_url) return;
    try {
      await openUrl(override.external_listing_url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Link konnte nicht geöffnet werden');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-bg-elevated p-4 dark:border-transparent">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-text-primary">{PLATFORM_LABELS[platform]}</h2>
            <Badge variant="outline" className={cn('border', SYNC_STATUS_CLASSES[syncStatus])}>
              {SYNC_STATUS_LABELS[syncStatus]}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-text-muted">
            {override?.last_synced_at
              ? `Zuletzt synchronisiert: ${new Date(override.last_synced_at).toLocaleString('de-DE')}`
              : 'Noch nicht synchronisiert'}
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-text-primary">
          <Checkbox
            checked={isActive}
            onCheckedChange={(checked) => onActiveChange(Boolean(checked))}
          />
          <span>Auf {PLATFORM_LABELS[platform]} aktiv pflegen</span>
        </label>
      </div>

      <div className="relative">
        <div className={cn(!isActive && 'pointer-events-none opacity-40')}>{children}</div>
        {!isActive && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg border border-dashed border-border-subtle bg-bg-elevated/80 text-center text-sm text-text-secondary backdrop-blur-[1px]">
            Für diese Plattform deaktiviert. Toggle aktivieren um Felder zu bearbeiten.
          </div>
        )}
      </div>

      {showSyncSection && (
        <div className="rounded-lg border border-border-subtle bg-bg-elevated p-4 dark:border-transparent">
          <div className="mb-3 grid gap-2 text-xs text-text-secondary sm:grid-cols-3">
            <span>Sync-Status: {SYNC_STATUS_LABELS[syncStatus]}</span>
            <span>Externe ID: {override?.external_listing_id ?? '-'}</span>
            <span>URL: {override?.external_listing_url ? 'gesetzt' : '-'}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled title="Wird in Modul 12 verfügbar" className="gap-1.5">
              <Rocket size={14} />
              Push to {PLATFORM_LABELS[platform]}
            </Button>
            <Button
              variant="ghost"
              disabled={!override?.external_listing_url}
              onClick={() => void openExternalListing()}
              className="gap-1.5"
            >
              <ExternalLink size={14} />
              Im Browser öffnen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
