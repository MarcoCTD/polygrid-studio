import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AiAnalysisSummary,
  AnalyticsKpiRow,
  ExpensesByCategoryChart,
  ListingStatusChart,
  MarginByProductChart,
  RevenueByPlatformChart,
  SnapshotRefreshButton,
  TimeRangeSelector,
} from './components';
import {
  getAnalyticsKPIs,
  getEarliestAnalyticsDate,
  getExpensesByCategory,
  getListingStatusDistribution,
  getMarginByProduct,
  getRevenueByPlatform,
  getTopProductsByRevenue,
} from './services';
import type {
  AnalyticsKPIs,
  DashboardAnalysisInput,
  ExpensesByCategoryDatum,
  ListingStatusDatum,
  MarginByProductDatum,
  RevenueByPlatformDatum,
  TimeRange,
  TopProductByRevenue,
} from './types';
import { resolveTimeRange } from './utils';

const EMPTY_KPIS: AnalyticsKPIs = {
  revenueTotal: 0,
  expensesTotal: 0,
  averageMargin: null,
};

export function AnalyticsPage() {
  const [allTimeStartDate, setAllTimeStartDate] = useState<string | null>(null);
  const [range, setRange] = useState<TimeRange>(() => resolveTimeRange('current_month', null));
  const [kpis, setKpis] = useState<AnalyticsKPIs>(EMPTY_KPIS);
  const [revenueByPlatform, setRevenueByPlatform] = useState<RevenueByPlatformDatum[]>([]);
  const [expensesByCategory, setExpensesByCategory] = useState<ExpensesByCategoryDatum[]>([]);
  const [marginByProduct, setMarginByProduct] = useState<MarginByProductDatum[]>([]);
  const [topProductsByRevenue, setTopProductsByRevenue] = useState<TopProductByRevenue[]>([]);
  const [listingStatusDistribution, setListingStatusDistribution] = useState<ListingStatusDatum[]>(
    [],
  );
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadEarliestDate = useCallback(async () => {
    try {
      const earliest = await getEarliestAnalyticsDate();
      setAllTimeStartDate(earliest);
      if (range.preset === 'all_time') {
        setRange(resolveTimeRange('all_time', earliest));
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Analyse-Zeitraum konnte nicht geladen werden',
      );
    }
  }, [range.preset]);

  const loadAnalyticsData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [nextKpis, nextRevenue, nextExpenses, nextMargins, nextTopProducts, nextListingStatus] =
        await Promise.all([
          getAnalyticsKPIs(range.startDate, range.endDate),
          getRevenueByPlatform(range.startDate, range.endDate),
          getExpensesByCategory(range.startDate, range.endDate),
          getMarginByProduct(),
          getTopProductsByRevenue(range.startDate, range.endDate),
          getListingStatusDistribution(),
        ]);

      setKpis(nextKpis);
      setRevenueByPlatform(nextRevenue);
      setExpensesByCategory(nextExpenses);
      setMarginByProduct(nextMargins);
      setTopProductsByRevenue(nextTopProducts);
      setListingStatusDistribution(nextListingStatus);
      setAiSummary(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Analysedaten konnten nicht laden');
      setKpis(EMPTY_KPIS);
      setRevenueByPlatform([]);
      setExpensesByCategory([]);
      setMarginByProduct([]);
      setTopProductsByRevenue([]);
      setListingStatusDistribution([]);
      setAiSummary(null);
    } finally {
      setIsLoading(false);
    }
  }, [range.endDate, range.startDate]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadEarliestDate(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadEarliestDate]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadAnalyticsData(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadAnalyticsData]);

  const aiInput: DashboardAnalysisInput = useMemo(
    () => ({
      kpis,
      revenueByPlatform,
      expensesByCategory,
      bottomMarginProducts: marginByProduct.slice(0, 3),
      topProductsByRevenue,
      startDate: range.startDate,
      endDate: range.endDate,
    }),
    [
      expensesByCategory,
      kpis,
      marginByProduct,
      range.endDate,
      range.startDate,
      revenueByPlatform,
      topProductsByRevenue,
    ],
  );

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto bg-bg-primary p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Analysen</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Historische Auswertung für Umsatz, Ausgaben, Margen und Listing-Status.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <TimeRangeSelector
            value={range.preset}
            allTimeStartDate={allTimeStartDate}
            onChange={setRange}
          />
          <SnapshotRefreshButton />
        </div>
      </header>

      <AnalyticsKpiRow kpis={kpis} isLoading={isLoading} />

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <RevenueByPlatformChart data={revenueByPlatform} />
        <ExpensesByCategoryChart data={expensesByCategory} />
        <MarginByProductChart data={marginByProduct} />
        <ListingStatusChart data={listingStatusDistribution} />
      </section>

      <AiAnalysisSummary input={aiInput} summary={aiSummary} onSummaryChange={setAiSummary} />
    </div>
  );
}
