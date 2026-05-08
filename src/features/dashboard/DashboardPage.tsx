import { useCallback, useEffect, useState } from 'react';
import { CheckSquare, Receipt, ShoppingCart, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { KpiCard, QuickActions } from '@/features/analytics/components';
import { getDashboardKPIs } from '@/features/analytics/services';
import type { DashboardKPIs } from '@/features/analytics/types';

const EMPTY_KPIS: DashboardKPIs = {
  revenueCurrentMonth: 0,
  revenuePreviousMonth: 0,
  revenueChangePercent: 0,
  expensesCurrentMonth: 0,
  expensesPreviousMonth: 0,
  expensesChangePercent: 0,
  openOrdersCount: 0,
  oldestOpenOrderDate: null,
  openTasksCount: 0,
  nextTaskDueDate: null,
};

function formatEUR(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return 'Keine';
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
}

function daysSince(value: string | null): string {
  if (!value) return 'Keine offenen Aufträge';
  const today = new Date();
  const date = new Date(`${value}T00:00:00`);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.max(Math.floor((todayStart - dateStart) / 86_400_000), 0);

  if (diffDays === 0) return 'Ältester: heute';
  if (diffDays === 1) return 'Ältester: vor 1 Tag';
  return `Ältester: vor ${diffDays} Tagen`;
}

function previousMonthText(value: number): string {
  return `Vormonat: ${formatEUR(value)}`;
}

export function DashboardPage() {
  const [kpis, setKpis] = useState<DashboardKPIs>(EMPTY_KPIS);
  const [isLoading, setIsLoading] = useState(true);

  const loadKpis = useCallback(async () => {
    setIsLoading(true);
    try {
      setKpis(await getDashboardKPIs());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Dashboard-KPIs konnten nicht laden');
      setKpis(EMPTY_KPIS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadKpis();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadKpis]);

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto bg-bg-primary p-6">
      <header>
        <h1 className="text-2xl font-semibold text-text-primary">Dashboard</h1>
        <p className="mt-1 text-sm text-text-secondary">Live-Überblick für den aktuellen Monat.</p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Umsatz"
          value={formatEUR(kpis.revenueCurrentMonth)}
          subtext={previousMonthText(kpis.revenuePreviousMonth)}
          icon={TrendingUp}
          changePercent={kpis.revenueChangePercent}
          positiveIsGood
          isLoading={isLoading}
        />
        <KpiCard
          title="Ausgaben"
          value={formatEUR(kpis.expensesCurrentMonth)}
          subtext={previousMonthText(kpis.expensesPreviousMonth)}
          icon={Receipt}
          changePercent={kpis.expensesChangePercent}
          positiveIsGood={false}
          isLoading={isLoading}
        />
        <KpiCard
          title="Offene Aufträge"
          value={String(kpis.openOrdersCount)}
          subtext={daysSince(kpis.oldestOpenOrderDate)}
          icon={ShoppingCart}
          isLoading={isLoading}
        />
        <KpiCard
          title="Offene Aufgaben"
          value={String(kpis.openTasksCount)}
          subtext={`Nächste fällig: ${formatDate(kpis.nextTaskDueDate)}`}
          icon={CheckSquare}
          isLoading={isLoading}
        />
      </section>

      <QuickActions onActionComplete={() => void loadKpis()} />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-dashed border-border-subtle bg-bg-elevated p-5 dark:border-border">
          <h2 className="text-base font-semibold text-text-primary">Widgets</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Dashboard-Widgets folgen in Sub-Session B.
          </p>
        </div>
      </section>
    </div>
  );
}
