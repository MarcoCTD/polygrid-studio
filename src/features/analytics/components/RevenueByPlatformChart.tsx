import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { RevenueByPlatformDatum } from '../types';
import { WidgetCard } from './WidgetCard';

interface RevenueByPlatformChartProps {
  data: RevenueByPlatformDatum[];
}

const PLATFORMS = ['etsy', 'ebay', 'direkt', 'kleinanzeigen'] as const;
const PLATFORM_LABELS: Record<string, string> = {
  etsy: 'Etsy',
  ebay: 'eBay',
  direkt: 'Direkt',
  kleinanzeigen: 'Kleinanzeigen',
};
const PLATFORM_COLORS: Record<string, string> = {
  etsy: '--accent-primary',
  ebay: '--accent-warning',
  direkt: '--accent-info',
  kleinanzeigen: '--text-muted',
};

const getColor = (varName: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(varName).trim();

interface ChartRow {
  month: string;
  [platform: string]: string | number;
}

function formatMonth(month: string): string {
  const [year, monthIndex] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('de-DE', { month: 'short', year: '2-digit' }).format(
    new Date(year, monthIndex - 1, 1),
  );
}

function formatEUR(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

function buildRows(data: RevenueByPlatformDatum[]): ChartRow[] {
  const rows = new Map<string, ChartRow>();

  for (const item of data) {
    const row = rows.get(item.month) ?? { month: item.month };
    row[item.platform] = item.revenue;
    rows.set(item.month, row);
  }

  return Array.from(rows.values()).sort((a, b) => String(a.month).localeCompare(String(b.month)));
}

export function RevenueByPlatformChart({ data }: RevenueByPlatformChartProps) {
  const rows = useMemo(() => buildRows(data), [data]);

  return (
    <WidgetCard
      title="Umsatz nach Plattform"
      isEmpty={rows.length === 0}
      emptyMessage="Keine Daten für diesen Zeitraum"
    >
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
            <XAxis
              dataKey="month"
              tickFormatter={formatMonth}
              stroke="var(--text-secondary)"
              fontSize={12}
            />
            <YAxis tickFormatter={formatEUR} stroke="var(--text-secondary)" fontSize={12} />
            <Tooltip
              formatter={(value, name) => [
                formatEUR(Number(value)),
                PLATFORM_LABELS[String(name)] ?? String(name),
              ]}
              labelFormatter={(label) => formatMonth(String(label))}
              contentStyle={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            />
            <Legend />
            {PLATFORMS.map((platform) => (
              <Bar
                key={platform}
                dataKey={platform}
                name={PLATFORM_LABELS[platform]}
                fill={getColor(PLATFORM_COLORS[platform])}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </WidgetCard>
  );
}
