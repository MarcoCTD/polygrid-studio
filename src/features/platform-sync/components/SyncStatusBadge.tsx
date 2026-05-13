import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ListingSyncStatus } from '@/features/listings/schemas';

const LABELS: Record<ListingSyncStatus, string> = {
  not_synced: 'Nicht synchronisiert',
  synced: 'Synchronisiert',
  pending: 'Ausstehend',
  error: 'Fehler',
  conflict: 'Konflikt',
};

const CLASSES: Record<ListingSyncStatus, string> = {
  not_synced: 'border-zinc-200 bg-zinc-100 text-zinc-600',
  synced: 'border-emerald-200 bg-emerald-100 text-emerald-700',
  pending: 'border-amber-200 bg-amber-100 text-amber-700',
  error: 'border-red-200 bg-red-100 text-red-700',
  conflict: 'border-orange-200 bg-orange-100 text-orange-700',
};

export function SyncStatusBadge({
  status,
  className,
}: {
  status: ListingSyncStatus;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn('border', CLASSES[status], className)}>
      {LABELS[status]}
    </Badge>
  );
}
