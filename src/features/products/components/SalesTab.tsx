import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import {
  getMonthlySalesForProduct,
  getProductSalesKpis,
  getRecentOrdersForProduct,
  type MonthlySalesDatum,
  type ProductRecentOrder,
  type ProductSalesKpis,
} from '@/features/orders/services/salesStatsService';
import type { Product } from '../schema';

const ORDER_STATUS_LABELS: Record<string, string> = {
  inquiry: 'Anfrage',
  ordered: 'Bestellt',
  paid: 'Bezahlt',
  in_production: 'In Produktion',
  shipped: 'Versendet',
  completed: 'Abgeschlossen',
  issue: 'Problem',
  cancelled: 'Storniert',
};

function formatEUR(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
}

function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${isoDate.slice(0, 10)}T00:00:00`));
}

function formatMonth(month: string): string {
  const [year, monthIndex] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('de-DE', { month: 'short', year: '2-digit' }).format(
    new Date(year, monthIndex - 1, 1),
  );
}

const getCssColor = (varName: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(varName).trim();

interface SalesTabProps {
  product: Product;
}

export function SalesTab({ product }: SalesTabProps) {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<ProductSalesKpis | null>(null);
  const [monthly, setMonthly] = useState<MonthlySalesDatum[]>([]);
  const [recentOrders, setRecentOrders] = useState<ProductRecentOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const [kpiData, monthlyData, orders] = await Promise.all([
          getProductSalesKpis(product.id),
          getMonthlySalesForProduct(product.id),
          getRecentOrdersForProduct(product.id),
        ]);
        if (cancelled) return;
        setKpis(kpiData);
        setMonthly(monthlyData);
        setRecentOrders(orders);
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : 'Verkaufszahlen konnten nicht geladen werden',
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [product.id]);

  if (isLoading) {
    return <div className="text-sm text-text-muted">Verkaufszahlen werden geladen...</div>;
  }

  const hasSales = (kpis?.total.units_sold ?? 0) > 0;

  return (
    <div className="flex max-w-4xl flex-col gap-6" data-testid="sales-tab">
      {/* Kennzahlen */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SalesKpi
          label="Verkauft gesamt"
          value={String(kpis?.total.units_sold ?? 0)}
          subtext={`${kpis?.total.units_sold === 1 ? 'Einheit' : 'Einheiten'}`}
          testId="sales-kpi-total-units"
        />
        <SalesKpi
          label="Umsatz gesamt"
          value={formatEUR(kpis?.total.revenue ?? 0)}
          subtext="bezahlte, nicht stornierte Aufträge"
          testId="sales-kpi-total-revenue"
        />
        <SalesKpi
          label="Letzte 30 Tage"
          value={String(kpis?.last30Days.units_sold ?? 0)}
          subtext={formatEUR(kpis?.last30Days.revenue ?? 0)}
          testId="sales-kpi-last30"
        />
      </section>

      {/* Monatsdiagramm */}
      <section className="rounded-lg border border-border-subtle bg-bg-elevated p-4 dark:border-transparent dark:shadow-md">
        <h2 className="mb-3 text-base font-semibold text-text-primary">
          Verkäufe pro Monat (letzte 12 Monate)
        </h2>
        {hasSales ? (
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis
                  dataKey="month"
                  tickFormatter={formatMonth}
                  stroke="var(--text-secondary)"
                  fontSize={12}
                />
                <YAxis allowDecimals={false} stroke="var(--text-secondary)" fontSize={12} />
                <Tooltip
                  formatter={(value, name) => [
                    String(value),
                    name === 'units_sold' ? 'Verkäufe' : String(name),
                  ]}
                  labelFormatter={(label) => formatMonth(String(label))}
                  contentStyle={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                />
                <Bar
                  dataKey="units_sold"
                  name="Verkäufe"
                  fill={getCssColor('--accent-primary')}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-text-muted">
            Noch keine Verkäufe für dieses Produkt.
          </p>
        )}
      </section>

      {/* Letzte Aufträge */}
      <section className="rounded-lg border border-border-subtle bg-bg-elevated p-4 dark:border-transparent dark:shadow-md">
        <h2 className="mb-3 text-base font-semibold text-text-primary">Letzte Aufträge</h2>
        {recentOrders.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-muted">
            Noch keine Aufträge für dieses Produkt.
          </p>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {recentOrders.map((order) => (
              <li key={order.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-1 py-2 text-left text-sm transition-colors hover:bg-bg-hover"
                  onClick={() =>
                    void navigate({ to: '/orders', search: { order: order.id } })
                  }
                  title="Auftrag öffnen"
                >
                  <span className="font-medium tabular-nums text-pg-accent">
                    {order.receipt_number}
                  </span>
                  <span className="text-text-secondary">{formatDate(order.order_date)}</span>
                  <span className="tabular-nums text-text-secondary">
                    {order.quantity} × {formatEUR(order.sale_price)}
                  </span>
                  <span className="text-xs text-text-muted">
                    {ORDER_STATUS_LABELS[order.status] ?? order.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SalesKpi({
  label,
  value,
  subtext,
  testId,
}: {
  label: string;
  value: string;
  subtext: string;
  testId: string;
}) {
  return (
    <div
      className="rounded-lg border border-border-subtle bg-bg-elevated p-4 dark:border-transparent dark:shadow-md"
      data-testid={testId}
    >
      <p className="text-xs font-medium text-text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-text-primary">{value}</p>
      <p className="mt-0.5 text-xs text-text-muted">{subtext}</p>
    </div>
  );
}
