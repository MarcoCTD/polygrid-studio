import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { ExpensesByCategoryDatum } from '../types';
import { WidgetCard } from './WidgetCard';

interface ExpensesByCategoryChartProps {
  data: ExpensesByCategoryDatum[];
}

const COLOR_VARS = [
  '--accent-primary',
  '--accent-success',
  '--accent-warning',
  '--accent-info',
  '--accent-danger',
  '--text-muted',
];

const getColor = (varName: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(varName).trim();

function formatEUR(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function ExpensesByCategoryChart({ data }: ExpensesByCategoryChartProps) {
  const total = data.reduce((sum, item) => sum + item.amount, 0);

  return (
    <WidgetCard
      title="Ausgaben nach Kategorie"
      isEmpty={data.length === 0}
      emptyMessage="Keine Daten für diesen Zeitraum"
    >
      <div className="grid min-h-[300px] gap-4 md:grid-cols-[minmax(180px,1fr)_minmax(160px,0.8fr)]">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="category"
              innerRadius={64}
              outerRadius={110}
              paddingAngle={2}
              stroke="transparent"
            >
              {data.map((entry, index) => (
                <Cell key={entry.category} fill={getColor(COLOR_VARS[index] ?? '--text-muted')} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => formatEUR(Number(value))}
              contentStyle={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="flex min-w-0 flex-col justify-center gap-2">
          {data.map((item, index) => {
            const percentage = total > 0 ? (item.amount / total) * 100 : 0;
            return (
              <div key={item.category} className="flex items-center gap-2 text-xs">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: getColor(COLOR_VARS[index] ?? '--text-muted') }}
                />
                <span className="min-w-0 flex-1 truncate text-text-secondary">{item.category}</span>
                <span className="shrink-0 tabular-nums text-text-primary">
                  {percentage.toFixed(1)} %
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </WidgetCard>
  );
}
