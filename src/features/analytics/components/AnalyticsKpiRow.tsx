import { Percent, Receipt, TrendingUp } from 'lucide-react';
import type { AnalyticsKPIs } from '../types';

interface AnalyticsKpiRowProps {
  kpis: AnalyticsKPIs;
  isLoading?: boolean;
}

function formatEUR(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

function formatPercent(value: number | null): string {
  return value === null ? '–' : `${value.toFixed(1)} %`;
}

function MiniKpiCard({
  label,
  value,
  icon: Icon,
  isLoading,
}: {
  label: string;
  value: string;
  icon: typeof TrendingUp;
  isLoading?: boolean;
}) {
  return (
    <article className="rounded-lg border border-border-subtle bg-bg-elevated p-4 dark:border-transparent dark:shadow-md">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase text-text-secondary">{label}</p>
          <p className="mt-2 text-xl font-semibold tabular-nums text-text-primary">
            {isLoading ? '...' : value}
          </p>
        </div>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-pg-accent-subtle text-pg-accent">
          <Icon className="size-4" />
        </div>
      </div>
    </article>
  );
}

export function AnalyticsKpiRow({ kpis, isLoading = false }: AnalyticsKpiRowProps) {
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <MiniKpiCard
        label="Gesamtumsatz"
        value={formatEUR(kpis.revenueTotal)}
        icon={TrendingUp}
        isLoading={isLoading}
      />
      <MiniKpiCard
        label="Gesamtausgaben"
        value={formatEUR(kpis.expensesTotal)}
        icon={Receipt}
        isLoading={isLoading}
      />
      <MiniKpiCard
        label="Durchschnittsmarge"
        value={formatPercent(kpis.averageMargin)}
        icon={Percent}
        isLoading={isLoading}
      />
    </section>
  );
}
