import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Lock } from 'lucide-react';
import { formatEUR, formatRelativeDate } from '@/features/products/utils';
import { cn } from '@/lib/utils';
import type { OrderListItem } from '../types';
import { OrderPlatformIcon, PaymentStatusBadge } from './OrderBadges';

interface KanbanCardProps {
  order: OrderListItem;
  onOpen: (order: OrderListItem) => void;
}

export function KanbanCard({ order, onOpen }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: order.id,
    disabled: order.tax_locked,
    data: { order },
  });
  const style = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      className={cn(
        'w-full rounded-lg border border-border-subtle bg-bg-elevated p-3 text-left shadow-sm transition hover:border-pg-accent/40 hover:shadow-md',
        isDragging && 'z-50 opacity-80 shadow-lg',
        order.tax_locked && 'cursor-not-allowed bg-bg-secondary opacity-80',
      )}
      title={order.tax_locked ? 'Steuerlich gesperrt' : undefined}
      onClick={() => onOpen(order)}
      {...attributes}
      {...listeners}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-text-tertiary">{order.receipt_number}</span>
        {order.tax_locked && <Lock className="size-3.5 text-amber-600" />}
      </div>

      <p
        className={cn(
          'line-clamp-2 min-h-10 text-sm font-semibold text-text-primary',
          !order.product_name && 'font-medium text-text-muted',
        )}
      >
        {order.product_name ?? 'Kein Produkt'}
      </p>

      <div className="mt-3 flex items-center justify-between gap-2">
        <OrderPlatformIcon platform={order.platform} />
        <span className="text-sm font-semibold tabular-nums text-text-primary">
          {formatEUR(order.sale_price)}
        </span>
      </div>

      {/* Geldstatus im Kanban sichtbar, klar abgesetzt vom Ablauf-Status
          (eigene Spalte oben) durch Münz-Icon und Präfix "Zahlung:". */}
      <div className="mt-2 flex">
        <PaymentStatusBadge status={order.payment_status} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-text-tertiary">
        <span className="truncate">{order.customer_name || 'Kein Kundenname'}</span>
        <span className="shrink-0" title={order.order_date}>
          {formatRelativeDate(order.order_date)}
        </span>
      </div>
    </button>
  );
}
