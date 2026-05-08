import { useNavigate } from '@tanstack/react-router';
import { OrderPlatformIcon, OrderStatusBadge } from '@/features/orders/components';
import type { OrderPlatform, OrderStatus } from '@/features/orders/types';
import { formatRelativeDate } from '@/features/products/utils';
import type { RecentOrder } from '../types';
import { WidgetCard } from './WidgetCard';

interface OrderTimelineWidgetProps {
  orders: RecentOrder[];
  onCreateOrder: () => void;
}

export function OrderTimelineWidget({ orders, onCreateOrder }: OrderTimelineWidgetProps) {
  const navigate = useNavigate();

  return (
    <WidgetCard
      title="Auftrags-Timeline"
      viewAllTo="/orders"
      isEmpty={orders.length === 0}
      emptyMessage="Noch keine Aufträge erfasst"
      ctaLabel="Ersten Auftrag anlegen"
      onCtaClick={onCreateOrder}
    >
      <div className="divide-y divide-border-subtle">
        {orders.map((order) => (
          <button
            key={order.id}
            type="button"
            className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:bg-bg-hover"
            onClick={() => void navigate({ to: '/orders' })}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text-primary">
                {order.product_name ?? order.receipt_number}
              </p>
              <p className="text-xs text-text-secondary">{formatRelativeDate(order.updated_at)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <OrderPlatformIcon platform={order.platform as OrderPlatform} />
              <OrderStatusBadge status={order.status as OrderStatus} />
            </div>
          </button>
        ))}
      </div>
    </WidgetCard>
  );
}
