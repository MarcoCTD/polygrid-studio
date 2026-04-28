import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LISTING_STATUS_LABELS } from '../constants';
import type { ListingStatus } from '../schemas';

const STATUS_CLASSES: Record<ListingStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  ready: 'bg-sky-100 text-sky-700 border-sky-200',
  online: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  paused: 'bg-amber-100 text-amber-700 border-amber-200',
  archived: 'bg-zinc-100 text-zinc-600 border-zinc-200',
};

interface ListingStatusBadgeProps {
  status: ListingStatus;
}

export function ListingStatusBadge({ status }: ListingStatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn('border', STATUS_CLASSES[status])}>
      {LISTING_STATUS_LABELS[status]}
    </Badge>
  );
}
