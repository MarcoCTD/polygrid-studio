import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { OrderPlatform, OrderStatus } from '@/features/orders/types';
import type { PlaybookActionType, PlaybookRunStatus } from '../schemas';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  inquiry: 'Anfrage',
  ordered: 'Bestellt',
  paid: 'Bezahlt',
  in_production: 'Produktion',
  shipped: 'Versendet',
  completed: 'Abgeschlossen',
  issue: 'Problem',
  cancelled: 'Storniert',
};

export const PLATFORM_LABELS: Record<OrderPlatform, string> = {
  etsy: 'Etsy',
  ebay: 'eBay',
  kleinanzeigen: 'Kleinanzeigen',
  direkt: 'Direktverkauf',
  website: 'Website',
};

export const ACTION_TYPE_LABELS: Record<PlaybookActionType, string> = {
  create_task: 'Aufgabe erstellen',
  create_expense: 'Ausgabe anlegen',
  suggest_template: 'Vorlage vorschlagen',
};

export const RUN_STATUS_LABELS: Record<PlaybookRunStatus, string> = {
  success: 'Erfolgreich',
  partial: 'Teilweise',
  error: 'Fehler',
  dry_run: 'Dry-Run',
};

const runStatusClasses: Record<PlaybookRunStatus, string> = {
  success: 'border-emerald-300 bg-emerald-100 text-emerald-700',
  partial: 'border-amber-300 bg-amber-100 text-amber-800',
  error: 'border-red-300 bg-red-100 text-red-700',
  dry_run: 'border-slate-300 bg-slate-100 text-slate-600',
};

export function RunStatusBadge({ status }: { status: PlaybookRunStatus }) {
  return (
    <Badge variant="outline" className={cn('whitespace-nowrap', runStatusClasses[status])}>
      {RUN_STATUS_LABELS[status]}
    </Badge>
  );
}

export function TriggerStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge variant="outline" className="whitespace-nowrap border-blue-300 bg-blue-100 text-blue-700">
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-bg-elevated p-5 shadow-sm">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          {description ? <p className="mt-1 text-sm text-text-secondary">{description}</p> : null}
        </div>
        {actions}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}
