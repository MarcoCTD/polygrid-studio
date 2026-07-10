import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
  type DocumentStatus,
  type DocumentType,
} from '../schemas';

const statusClasses: Record<DocumentStatus, string> = {
  draft: 'border-slate-300 bg-slate-100 text-slate-700',
  issued: 'border-blue-300 bg-blue-100 text-blue-700',
  accepted: 'border-emerald-300 bg-emerald-100 text-emerald-700',
  rejected: 'border-zinc-300 bg-zinc-100 text-zinc-600',
  paid: 'border-emerald-300 bg-emerald-100 text-emerald-700',
  cancelled: 'border-red-300 bg-red-100 text-red-700',
};

export function DocumentStatusBadge({
  status,
  overdue,
}: {
  status: DocumentStatus;
  /** Rechnung issued mit überschrittener Fälligkeit → rote Kennzeichnung */
  overdue?: boolean;
}) {
  if (status === 'issued' && overdue) {
    return (
      <Badge
        variant="outline"
        className="whitespace-nowrap border-red-300 bg-red-100 text-red-700"
        data-testid="document-status-badge"
      >
        Überfällig
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className={cn('whitespace-nowrap', statusClasses[status])}
      data-testid="document-status-badge"
    >
      {DOCUMENT_STATUS_LABELS[status]}
    </Badge>
  );
}

const typeClasses: Record<DocumentType, string> = {
  quote: 'border-violet-300 bg-violet-100 text-violet-700',
  invoice: 'border-sky-300 bg-sky-100 text-sky-700',
};

export function DocumentTypeBadge({ type }: { type: DocumentType }) {
  return (
    <Badge variant="outline" className={cn('whitespace-nowrap', typeClasses[type])}>
      {DOCUMENT_TYPE_LABELS[type]}
    </Badge>
  );
}
