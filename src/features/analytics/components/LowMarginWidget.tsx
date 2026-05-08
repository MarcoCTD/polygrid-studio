import { useNavigate } from '@tanstack/react-router';
import { Badge } from '@/components/ui/badge';
import { getMarginColor } from '@/features/products';
import { cn } from '@/lib/utils';
import type { LowMarginProduct } from '../types';
import { WidgetCard } from './WidgetCard';

interface LowMarginWidgetProps {
  products: LowMarginProduct[];
  threshold: number;
}

const MARGIN_CLASSES = {
  success: 'bg-success-subtle text-success',
  warning: 'bg-warning-subtle text-warning',
  danger: 'bg-danger-subtle text-danger',
} as const;

export function LowMarginWidget({ products, threshold }: LowMarginWidgetProps) {
  const navigate = useNavigate();

  return (
    <WidgetCard
      title="Produkte mit schwacher Marge"
      viewAllTo="/products"
      isEmpty={products.length === 0}
      emptyMessage={`Alle Margen über ${threshold}%`}
    >
      <div className="divide-y divide-border-subtle">
        {products.map((product) => {
          const tone = getMarginColor(product.estimated_margin);
          return (
            <button
              key={product.id}
              type="button"
              className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:bg-bg-hover"
              onClick={() =>
                void navigate({ to: '/products/$productId', params: { productId: product.id } })
              }
            >
              <p className="min-w-0 truncate text-sm font-medium text-text-primary">
                {product.name}
              </p>
              <Badge className={cn('shrink-0', MARGIN_CLASSES[tone])}>
                {product.estimated_margin.toFixed(1)} %
              </Badge>
            </button>
          );
        })}
      </div>
    </WidgetCard>
  );
}
