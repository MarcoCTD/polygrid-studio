import { cn } from '@/lib/utils';
import { getMarginColor } from '../margin';

interface MarginCellProps {
  marginPercent: number | null;
}

const COLOR_MAP: Record<ReturnType<typeof getMarginColor>, string> = {
  success: 'text-[var(--accent-success)]',
  warning: 'text-[var(--accent-warning)]',
  danger: 'text-[var(--accent-danger)]',
};

export function MarginCell({ marginPercent }: MarginCellProps) {
  if (marginPercent === null || marginPercent === undefined) {
    return <span className="text-text-muted">–</span>;
  }

  const color = getMarginColor(marginPercent);

  return (
    <span className={cn('font-medium tabular-nums', COLOR_MAP[color])}>
      {marginPercent.toFixed(1)}%
    </span>
  );
}
