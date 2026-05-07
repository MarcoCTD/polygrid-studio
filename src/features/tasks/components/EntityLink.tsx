import { useNavigate } from '@tanstack/react-router';
import { FileText, Package, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TaskListItem } from '../services';

interface EntityLinkProps {
  task: TaskListItem;
  className?: string;
}

export function EntityLink({ task, className }: EntityLinkProps) {
  const navigate = useNavigate();

  if (task.product_id) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn('h-7 min-w-0 justify-start px-1.5 text-text-secondary', className)}
        title={task.product_name ?? 'Produkt öffnen'}
        onClick={(event) => {
          event.stopPropagation();
          void navigate({ to: '/products/$productId', params: { productId: task.product_id! } });
        }}
      >
        <Package className="size-3.5" />
        <span className="truncate">{task.product_name ?? 'Produkt'}</span>
      </Button>
    );
  }

  if (task.order_id) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn('h-7 min-w-0 justify-start px-1.5 text-text-secondary', className)}
        title={task.order_receipt_number ?? 'Auftrag öffnen'}
        onClick={(event) => {
          event.stopPropagation();
          void navigate({ to: '/orders' });
        }}
      >
        <ShoppingCart className="size-3.5" />
        <span className="truncate">{task.order_receipt_number ?? 'Auftrag'}</span>
      </Button>
    );
  }

  if (task.listing_id) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn('h-7 min-w-0 justify-start px-1.5 text-text-secondary', className)}
        title={task.listing_title ?? 'Listing öffnen'}
        onClick={(event) => {
          event.stopPropagation();
          void navigate({ to: '/listings/$listingId', params: { listingId: task.listing_id! } });
        }}
      >
        <FileText className="size-3.5" />
        <span className="truncate">{task.listing_title ?? 'Listing'}</span>
      </Button>
    );
  }

  return <span className={cn('text-sm text-text-muted', className)}>Keine</span>;
}
