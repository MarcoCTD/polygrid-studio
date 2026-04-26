import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { calculatePercentChange, formatEUR, formatMonthLabel, monthOptions } from '../utils';

interface ExpensesHeaderProps {
  selectedMonth: string;
  monthlySum: number;
  previousMonthSum: number;
  isLoading: boolean;
  onSelectedMonthChange: (month: string) => void;
}

export function ExpensesHeader({
  selectedMonth,
  monthlySum,
  previousMonthSum,
  isLoading,
  onSelectedMonthChange,
}: ExpensesHeaderProps) {
  const percentChange = calculatePercentChange(monthlySum, previousMonthSum);
  const isUp = percentChange !== null && percentChange > 0;
  const isDown = percentChange !== null && percentChange < 0;
  const TrendIcon = isUp ? ArrowUp : isDown ? ArrowDown : Minus;

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)]">
      <div className="rounded-lg border border-border-subtle bg-bg-elevated p-4 dark:border-transparent dark:shadow-md">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-text-secondary">Monatssumme brutto</p>
            <h2 className="mt-1 text-3xl font-semibold text-text-primary">
              {isLoading ? '...' : formatEUR(monthlySum)}
            </h2>
          </div>

          <Select
            value={selectedMonth}
            onValueChange={(value) => {
              if (value) onSelectedMonthChange(value);
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {monthOptions().map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium',
            isUp && 'bg-danger-subtle text-danger',
            isDown && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
            !isUp && !isDown && 'bg-bg-secondary text-text-secondary',
          )}
        >
          <TrendIcon size={14} />
          <span>
            {percentChange === null
              ? 'Kein Vormonatswert'
              : `${Math.abs(percentChange).toFixed(1)} % zum Vormonat`}
          </span>
        </div>

        <p className="mt-2 text-xs text-text-muted">
          Vergleich mit {formatMonthLabel(previousMonthValueForLabel(selectedMonth))}
        </p>
      </div>

      <div className="flex min-h-[154px] items-center justify-center rounded-lg border border-dashed border-border-subtle bg-bg-elevated p-4 text-sm text-text-muted dark:border-border">
        Chart wird in Sub-Session D implementiert
      </div>
    </section>
  );
}

function previousMonthValueForLabel(value: string): string {
  const [year, month] = value.split('-').map(Number);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
