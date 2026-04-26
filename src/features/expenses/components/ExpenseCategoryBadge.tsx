import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  EXPENSE_CATEGORY_COLORS,
  EXPENSE_CATEGORY_LABELS,
  type ExpenseCategory,
} from '../constants';

interface ExpenseCategoryBadgeProps {
  category: ExpenseCategory;
}

export function ExpenseCategoryBadge({ category }: ExpenseCategoryBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn('whitespace-nowrap border text-xs', EXPENSE_CATEGORY_COLORS[category])}
    >
      {EXPENSE_CATEGORY_LABELS[category]}
    </Badge>
  );
}
