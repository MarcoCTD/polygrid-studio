import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getMarginColor } from '@/features/products';
import type { MarginByProductDatum } from '../types';
import { WidgetCard } from './WidgetCard';

interface MarginByProductChartProps {
  data: MarginByProductDatum[];
}

const MARGIN_COLOR_VARS = {
  success: '--accent-success',
  warning: '--accent-warning',
  danger: '--accent-danger',
} as const;

const getColor = (varName: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(varName).trim();

function shortName(value: string): string {
  return value.length > 22 ? `${value.slice(0, 21)}…` : value;
}

export function MarginByProductChart({ data }: MarginByProductChartProps) {
  return (
    <WidgetCard
      title="Marge nach Produkt"
      viewAllTo="/products"
      isEmpty={data.length === 0}
      emptyMessage="Keine Daten für diesen Zeitraum"
    >
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical" margin={{ left: 24, right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
            <XAxis
              type="number"
              tickFormatter={(value) => `${Number(value).toFixed(0)} %`}
              stroke="var(--text-secondary)"
              fontSize={12}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tickFormatter={shortName}
              stroke="var(--text-secondary)"
              fontSize={12}
            />
            <Tooltip
              formatter={(value) => [`${Number(value).toFixed(1)} %`, 'Marge']}
              contentStyle={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            />
            <Bar dataKey="estimated_margin" radius={[0, 4, 4, 0]}>
              {data.map((item) => {
                const tone = getMarginColor(item.estimated_margin);
                return <Cell key={item.id} fill={getColor(MARGIN_COLOR_VARS[tone])} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </WidgetCard>
  );
}
