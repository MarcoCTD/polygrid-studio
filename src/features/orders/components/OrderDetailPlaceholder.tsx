import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { formatEUR } from '@/features/products/utils';
import type { OrderListItem } from '../types';
import {
  OrderPlatformIcon,
  OrderStatusBadge,
  PaymentStatusBadge,
  TaxLockedIcon,
} from './OrderBadges';

interface OrderDetailPlaceholderProps {
  order: OrderListItem;
  onClose: () => void;
}

export function OrderDetailPlaceholder({ order, onClose }: OrderDetailPlaceholderProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border-subtle p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
              Auftrag
            </p>
            <h2 className="mt-1 text-lg font-semibold text-text-primary">{order.receipt_number}</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Schließen
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <div className="flex flex-wrap gap-2">
          <OrderStatusBadge status={order.status} />
          <PaymentStatusBadge status={order.payment_status} />
          <OrderPlatformIcon platform={order.platform} />
          <TaxLockedIcon locked={order.tax_locked} />
        </div>

        <Separator />

        <dl className="grid gap-3 text-sm">
          <div>
            <dt className="text-text-tertiary">Produkt</dt>
            <dd className="font-medium text-text-primary">
              {order.product_name ?? order.variant ?? 'Kein Produkt verknüpft'}
            </dd>
          </div>
          <div>
            <dt className="text-text-tertiary">Kunde</dt>
            <dd className="font-medium text-text-primary">{order.customer_name || '-'}</dd>
          </div>
          <div>
            <dt className="text-text-tertiary">Verkaufspreis</dt>
            <dd className="font-medium text-text-primary">{formatEUR(order.sale_price)}</dd>
          </div>
          <div>
            <dt className="text-text-tertiary">Bestelldatum</dt>
            <dd className="font-medium text-text-primary">{order.order_date.slice(0, 10)}</dd>
          </div>
        </dl>

        <div className="rounded-lg border border-dashed border-border-subtle bg-bg-secondary p-4 text-sm text-text-secondary">
          Detail-Panel folgt in Sub-Session 8.4. Diese Ansicht nutzt bereits das zentrale
          DetailPanel aus Foundation.
        </div>
      </div>
    </div>
  );
}
