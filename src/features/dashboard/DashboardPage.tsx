import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { CheckSquare, Receipt, ShoppingCart, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import {
  IncompleteListingsWidget,
  KpiCard,
  LowMarginWidget,
  OrderTimelineWidget,
  PipelineWidget,
  QuickActions,
  RecentProductsWidget,
  TopSellersWidget,
} from '@/features/analytics/components';
import { getTopSellers, type TopSellerEntry } from '@/features/orders/services/salesStatsService';
import {
  getDashboardKPIs,
  getIncompleteListings,
  getLowMarginProducts,
  getPipelineProducts,
  getRecentOrders,
  getRecentProducts,
} from '@/features/analytics/services';
import type {
  DashboardKPIs,
  IncompleteListing,
  LowMarginProduct,
  PipelineProductGroup,
  RecentOrder,
  RecentProduct,
} from '@/features/analytics/types';
import { ExpenseDetailPanel } from '@/features/expenses/components/ExpenseDetailPanel';
import { KleinunternehmerGrenzeCard } from '@/features/finance/components/KleinunternehmerGrenzeCard';
import { NewListingModal } from '@/features/listings/components';
import { NewOrderModal } from '@/features/orders/components';
import { NewProductDialog } from '@/features/products/components/NewProductDialog';
import { SmartActionsSection } from '@/features/smart-actions';
import { DEFAULTS, getSettingWithDefault } from '@/services/settings';
import { useUIStore } from '@/stores';

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
  const navigate = useNavigate();
  const openDetailPanel = useUIStore((state) => state.openDetailPanel);
  const closeDetailPanel = useUIStore((state) => state.closeDetailPanel);
  const [kpis, setKpis] = useState<DashboardKPIs>(EMPTY_KPIS);
  const [isLoading, setIsLoading] = useState(true);
  const [recentProducts, setRecentProducts] = useState<RecentProduct[]>([]);
  const [lowMarginProducts, setLowMarginProducts] = useState<LowMarginProduct[]>([]);
  const [incompleteListings, setIncompleteListings] = useState<IncompleteListing[]>([]);
  const [pipelineGroups, setPipelineGroups] = useState<PipelineProductGroup[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [topSellers, setTopSellers] = useState<TopSellerEntry[]>([]);
  const [lowMarginThreshold, setLowMarginThreshold] = useState(30);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [listingModalOpen, setListingModalOpen] = useState(false);
  const [orderModalOpen, setOrderModalOpen] = useState(false);

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

  const loadRecentProducts = useCallback(async () => {
    try {
      setRecentProducts(await getRecentProducts());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Produkt-Widget konnte nicht laden');
    }
  }, []);

  const loadLowMarginProducts = useCallback(async () => {
    try {
      const threshold = await getSettingWithDefault(
        'margin_warning_threshold',
        DEFAULTS.margin_warning_threshold,
      );
      setLowMarginThreshold(threshold);
      setLowMarginProducts(await getLowMarginProducts(threshold));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Margen-Widget konnte nicht laden');
    }
  }, []);

  const loadIncompleteListings = useCallback(async () => {
    try {
      setIncompleteListings(await getIncompleteListings());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Listing-Widget konnte nicht laden');
    }
  }, []);

  const loadPipelineProducts = useCallback(async () => {
    try {
      setPipelineGroups(await getPipelineProducts());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Pipeline-Widget konnte nicht laden');
    }
  }, []);

  const loadRecentOrders = useCallback(async () => {
    try {
      setRecentOrders(await getRecentOrders());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Auftrags-Widget konnte nicht laden');
    }
  }, []);

  const loadTopSellers = useCallback(async () => {
    try {
      setTopSellers(await getTopSellers('last_90_days', 5));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Top-Seller-Widget konnte nicht laden');
    }
  }, []);

  const refreshDashboard = useCallback(() => {
    void loadKpis();
    void loadRecentProducts();
    void loadLowMarginProducts();
    void loadIncompleteListings();
    void loadPipelineProducts();
    void loadRecentOrders();
    void loadTopSellers();
  }, [
    loadIncompleteListings,
    loadKpis,
    loadLowMarginProducts,
    loadPipelineProducts,
    loadRecentOrders,
    loadRecentProducts,
    loadTopSellers,
  ]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadKpis(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadKpis]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadRecentProducts(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadRecentProducts]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadLowMarginProducts(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadLowMarginProducts]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadIncompleteListings(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadIncompleteListings]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadPipelineProducts(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadPipelineProducts]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadRecentOrders(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadRecentOrders]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadTopSellers(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadTopSellers]);

  function handleNewExpense() {
    openDetailPanel(
      <ExpenseDetailPanel
        expense="new"
        onSaved={() => {
          refreshDashboard();
          closeDetailPanel();
        }}
        onDeleted={() => {
          refreshDashboard();
          closeDetailPanel();
        }}
        onRestored={() => {
          refreshDashboard();
          closeDetailPanel();
        }}
      />,
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto bg-bg-primary p-6">
      <header>
        <h1 className="text-2xl font-semibold text-text-primary">Dashboard</h1>
        <p className="mt-1 text-sm text-text-secondary">Live-Überblick für den aktuellen Monat.</p>
      </header>

      <SmartActionsSection />

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

      <QuickActions
        onNewExpense={handleNewExpense}
        onNewProduct={() => setProductModalOpen(true)}
        onNewListing={() => setListingModalOpen(true)}
        onNewOrder={() => setOrderModalOpen(true)}
      />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecentProductsWidget
          products={recentProducts}
          onCreateProduct={() => setProductModalOpen(true)}
        />
        <LowMarginWidget products={lowMarginProducts} threshold={lowMarginThreshold} />
        <IncompleteListingsWidget listings={incompleteListings} />
        <TopSellersWidget topSellers={topSellers} />
        <PipelineWidget groups={pipelineGroups} />
        <OrderTimelineWidget orders={recentOrders} onCreateOrder={() => setOrderModalOpen(true)} />
        <KleinunternehmerGrenzeCard />
      </section>

      <NewProductDialog
        open={productModalOpen}
        onOpenChange={setProductModalOpen}
        onCreated={refreshDashboard}
      />
      <NewListingModal
        open={listingModalOpen}
        onOpenChange={setListingModalOpen}
        onCreated={(listing) => {
          refreshDashboard();
          void navigate({ to: '/listings/$listingId', params: { listingId: listing.id } });
        }}
      />
      <NewOrderModal
        open={orderModalOpen}
        onOpenChange={setOrderModalOpen}
        onCreated={() => {
          refreshDashboard();
          void navigate({ to: '/orders' });
        }}
      />
    </div>
  );
}
