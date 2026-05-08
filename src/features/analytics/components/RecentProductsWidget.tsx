import { useNavigate } from '@tanstack/react-router';
import { StatusBadge } from '@/features/products';
import { formatRelativeDate } from '@/features/products/utils';
import type { Status } from '@/features/products/schema';
import type { RecentProduct } from '../types';
import { WidgetCard } from './WidgetCard';

interface RecentProductsWidgetProps {
  products: RecentProduct[];
  onCreateProduct: () => void;
}

export function RecentProductsWidget({ products, onCreateProduct }: RecentProductsWidgetProps) {
  const navigate = useNavigate();

  return (
    <WidgetCard
      title="Zuletzt bearbeitete Produkte"
      viewAllTo="/products"
      isEmpty={products.length === 0}
      emptyMessage="Noch keine Produkte angelegt"
      ctaLabel="Erstes Produkt erstellen"
      onCtaClick={onCreateProduct}
    >
      <div className="divide-y divide-border-subtle">
        {products.map((product) => (
          <button
            key={product.id}
            type="button"
            className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:bg-bg-hover"
            onClick={() =>
              void navigate({ to: '/products/$productId', params: { productId: product.id } })
            }
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text-primary">{product.name}</p>
              <p className="text-xs text-text-secondary">
                {formatRelativeDate(product.updated_at)}
              </p>
            </div>
            <StatusBadge status={product.status as Status} className="shrink-0" />
          </button>
        ))}
      </div>
    </WidgetCard>
  );
}
