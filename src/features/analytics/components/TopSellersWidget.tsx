import { useNavigate } from '@tanstack/react-router';
import type { TopSellerEntry } from '@/features/orders/services/salesStatsService';
import { WidgetCard } from './WidgetCard';

function formatEUR(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
}

interface TopSellersWidgetProps {
  topSellers: TopSellerEntry[];
}

/** Top 5 Produkte nach verkaufter Menge der letzten 90 Tage (Modul 15). */
export function TopSellersWidget({ topSellers }: TopSellersWidgetProps) {
  const navigate = useNavigate();

  return (
    <WidgetCard
      title="Top-Seller (90 Tage)"
      viewAllTo="/products"
      isEmpty={topSellers.length === 0}
      emptyMessage="Noch keine Verkäufe in den letzten 90 Tagen."
    >
      <ul className="divide-y divide-border-subtle" data-testid="top-sellers-widget">
        {topSellers.map((entry, index) => (
          <li key={entry.product_id}>
            <button
              type="button"
              className="flex w-full items-center gap-3 px-1 py-2 text-left text-sm transition-colors hover:bg-bg-hover"
              onClick={() =>
                void navigate({
                  to: '/products/$productId',
                  params: { productId: entry.product_id },
                })
              }
              title={`${entry.product_name} öffnen`}
            >
              <span className="w-5 shrink-0 text-xs font-semibold tabular-nums text-text-muted">
                {index + 1}.
              </span>
              <span className="min-w-0 flex-1 truncate font-medium text-text-primary">
                {entry.product_name}
              </span>
              <span className="shrink-0 tabular-nums text-text-secondary">
                {entry.units_sold} {entry.units_sold === 1 ? 'Verkauf' : 'Verkäufe'}
              </span>
              <span className="shrink-0 tabular-nums text-text-secondary">
                {formatEUR(entry.revenue)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}
