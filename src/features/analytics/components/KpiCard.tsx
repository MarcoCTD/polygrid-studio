import { ArrowDown, ArrowUp, Minus, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  title: string;
  value: string;
  subtext: string;
  icon: LucideIcon;
  changePercent?: number;
  positiveIsGood?: boolean;
  isLoading?: boolean;
}

function formatChange(value: number): string {
  return `${Math.abs(value).toFixed(1)} %`;
}

export function KpiCard({
  title,
  value,
  subtext,
  icon: Icon,
  changePercent,
  positiveIsGood = true,
  isLoading = false,
}: KpiCardProps) {
  const hasChange = typeof changePercent === 'number';
  const isPositive = hasChange && changePercent > 0;
  const isNegative = hasChange && changePercent < 0;
  const isGood =
    hasChange && changePercent !== 0
      ? positiveIsGood
        ? changePercent > 0
        : changePercent < 0
      : null;
  const TrendIcon = isPositive ? ArrowUp : isNegative ? ArrowDown : Minus;

  return (
    <article className="rounded-lg border border-border-subtle bg-bg-elevated p-4 dark:border-transparent dark:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-secondary">{title}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-text-primary">
            {isLoading ? '...' : value}
          </p>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-pg-accent-subtle text-pg-accent">
          <Icon className="size-5" />
        </div>
      </div>

      <div className="mt-3 flex min-h-6 flex-wrap items-center gap-2">
        {hasChange ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium',
              isGood === true && 'bg-success-subtle text-success',
              isGood === false && 'bg-danger-subtle text-danger',
              isGood === null && 'bg-bg-secondary text-text-secondary',
            )}
          >
            <TrendIcon className="size-3" />
            {formatChange(changePercent)}
          </span>
        ) : null}
        <span className="text-xs text-text-secondary">{isLoading ? '-' : subtext}</span>
      </div>
    </article>
  );
}
