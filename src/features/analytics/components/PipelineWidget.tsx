import { useNavigate } from '@tanstack/react-router';
import { Badge } from '@/components/ui/badge';
import { getStatusLabel, useProductsUIStore } from '@/features/products';
import type { Status } from '@/features/products/schema';
import type { PipelineProductGroup } from '../types';
import { WidgetCard } from './WidgetCard';

interface PipelineWidgetProps {
  groups: PipelineProductGroup[];
}

export function PipelineWidget({ groups }: PipelineWidgetProps) {
  const navigate = useNavigate();
  const setStatus = useProductsUIStore((state) => state.setStatus);

  return (
    <WidgetCard
      title="Produkte in Pipeline"
      viewAllTo="/products"
      isEmpty={groups.length === 0}
      emptyMessage="Keine Produkte in der Pipeline"
    >
      <div className="space-y-3">
        {groups.map((group) => {
          const visibleProducts = group.products.slice(0, 3);
          const remaining = group.products.length - visibleProducts.length;

          return (
            <button
              key={group.status}
              type="button"
              className="w-full rounded-md px-2 py-2 text-left hover:bg-bg-hover"
              onClick={() => {
                setStatus([group.status as Status]);
                void navigate({ to: '/products' });
              }}
            >
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-text-primary">
                  {getStatusLabel(group.status as Status)}
                </p>
                <Badge variant="outline">{group.products.length}</Badge>
              </div>
              <p className="text-xs text-text-secondary">
                {visibleProducts.map((product) => product.name).join(', ')}
                {remaining > 0 ? `, +${remaining} weitere` : ''}
              </p>
            </button>
          );
        })}
      </div>
    </WidgetCard>
  );
}
