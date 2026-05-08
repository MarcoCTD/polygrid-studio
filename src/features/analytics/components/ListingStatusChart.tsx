import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { LISTING_STATUS_LABELS, type ListingStatus } from '@/features/listings';
import type { ListingStatusDatum } from '../types';
import { WidgetCard } from './WidgetCard';

interface ListingStatusChartProps {
  data: ListingStatusDatum[];
}

const STATUS_COLORS: Record<string, string> = {
  draft: '--text-muted',
  ready: '--accent-info',
  online: '--accent-success',
  paused: '--accent-warning',
  archived: '--text-disabled',
};

const getColor = (varName: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(varName).trim();

function statusLabel(status: string): string {
  return LISTING_STATUS_LABELS[status as ListingStatus] ?? status;
}

export function ListingStatusChart({ data }: ListingStatusChartProps) {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <WidgetCard
      title="Listing-Status"
      viewAllTo="/listings"
      isEmpty={data.length === 0}
      emptyMessage="Keine Daten für diesen Zeitraum"
    >
      <div className="grid min-h-[300px] gap-4 md:grid-cols-[minmax(180px,1fr)_minmax(160px,0.8fr)]">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="status"
              innerRadius={64}
              outerRadius={110}
              paddingAngle={2}
              stroke="transparent"
            >
              {data.map((entry) => (
                <Cell
                  key={entry.status}
                  fill={getColor(STATUS_COLORS[entry.status] ?? '--text-muted')}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [Number(value), statusLabel(String(name))]}
              contentStyle={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="flex min-w-0 flex-col justify-center gap-2">
          {data.map((item) => {
            const percentage = total > 0 ? (item.count / total) * 100 : 0;
            return (
              <div key={item.status} className="flex items-center gap-2 text-xs">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor: getColor(STATUS_COLORS[item.status] ?? '--text-muted'),
                  }}
                />
                <span className="min-w-0 flex-1 truncate text-text-secondary">
                  {statusLabel(item.status)}
                </span>
                <span className="shrink-0 tabular-nums text-text-primary">
                  {item.count} · {percentage.toFixed(1)} %
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </WidgetCard>
  );
}
