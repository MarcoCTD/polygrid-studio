import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_CHART_COLORS,
  EXPENSE_CATEGORY_LABELS,
  type ExpenseCategory,
} from '../constants';
import { calculatePercentChange, formatEUR, formatMonthLabel, monthOptions } from '../utils';

interface CategoryBreakdownItem {
  category: string;
  total: number;
}

interface ExpensesHeaderProps {
  selectedMonth: string;
  monthlySum: number;
  previousMonthSum: number;
  categoryBreakdown: CategoryBreakdownItem[];
  isLoading: boolean;
  onSelectedMonthChange: (month: string) => void;
}

interface ChartDatum {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface CategoryTooltipProps {
  active?: boolean;
  payload?: { payload?: unknown }[];
  total: number;
}

const OTHER_CATEGORY_COLOR = '#a8a29e';

export function ExpensesHeader({
  selectedMonth,
  monthlySum,
  previousMonthSum,
  categoryBreakdown,
  isLoading,
  onSelectedMonthChange,
}: ExpensesHeaderProps) {
  const percentChange = calculatePercentChange(monthlySum, previousMonthSum);
  const isUp = percentChange !== null && percentChange > 0;
  const isDown = percentChange !== null && percentChange < 0;
  const TrendIcon = isUp ? ArrowUp : isDown ? ArrowDown : Minus;
  const chartData = buildChartData(categoryBreakdown);
  const chartTotal = chartData.reduce((sum, item) => sum + item.value, 0);

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

      <div className="min-h-[154px] rounded-lg border border-border-subtle bg-bg-elevated p-4 dark:border-transparent dark:shadow-md">
        {isLoading ? (
          <div className="flex h-full min-h-[122px] items-center gap-4">
            <div className="h-28 w-28 shrink-0 rounded-full bg-bg-secondary animate-pulse" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-3 w-32 rounded bg-bg-secondary animate-pulse" />
              <div className="h-3 w-24 rounded bg-bg-secondary animate-pulse" />
              <div className="h-3 w-28 rounded bg-bg-secondary animate-pulse" />
            </div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-full min-h-[122px] items-center justify-center text-sm text-text-muted">
            Keine Ausgaben in diesem Monat
          </div>
        ) : (
          <div className="grid min-h-[122px] gap-3 sm:grid-cols-[minmax(120px,1fr)_minmax(130px,0.95fr)]">
            <div className="h-[122px] min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={34}
                    outerRadius={56}
                    paddingAngle={2}
                    stroke="transparent"
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CategoryTooltip total={chartTotal} />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex min-w-0 flex-col justify-center gap-1.5">
              {chartData.map((item) => (
                <div key={item.key} className="flex items-center gap-2 text-xs">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="min-w-0 flex-1 truncate text-text-secondary">{item.label}</span>
                  <span className="shrink-0 tabular-nums text-text-primary">
                    {formatEUR(item.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function buildChartData(items: CategoryBreakdownItem[]): ChartDatum[] {
  const sortedItems = items.filter((item) => item.total > 0).sort((a, b) => b.total - a.total);
  const topItems = sortedItems.slice(0, 5);
  const restTotal = sortedItems.slice(5).reduce((sum, item) => sum + item.total, 0);

  const chartData = topItems.map((item) => {
    const category = asExpenseCategory(item.category);
    return {
      key: category ?? item.category,
      label: category ? EXPENSE_CATEGORY_LABELS[category] : item.category,
      value: item.total,
      color: category ? EXPENSE_CATEGORY_CHART_COLORS[category] : OTHER_CATEGORY_COLOR,
    };
  });

  if (restTotal > 0) {
    chartData.push({
      key: 'other',
      label: 'Sonstige',
      value: restTotal,
      color: OTHER_CATEGORY_COLOR,
    });
  }

  return chartData;
}

function asExpenseCategory(value: string): ExpenseCategory | null {
  return EXPENSE_CATEGORIES.includes(value as ExpenseCategory) ? (value as ExpenseCategory) : null;
}

function CategoryTooltip({ active, payload, total }: CategoryTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const data = payload[0].payload;
  if (!isChartDatum(data)) {
    return null;
  }

  const percentage = total > 0 ? (data.value / total) * 100 : 0;

  return (
    <div className="rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-text-primary">{data.label}</p>
      <p className="text-text-secondary">
        {formatEUR(data.value)} · {percentage.toFixed(1)} %
      </p>
    </div>
  );
}

function isChartDatum(value: unknown): value is ChartDatum {
  return (
    typeof value === 'object' &&
    value !== null &&
    'label' in value &&
    'value' in value &&
    typeof value.label === 'string' &&
    typeof value.value === 'number'
  );
}

function previousMonthValueForLabel(value: string): string {
  const [year, month] = value.split('-').map(Number);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
