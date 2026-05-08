export interface DashboardKPIs {
  revenueCurrentMonth: number;
  revenuePreviousMonth: number;
  revenueChangePercent: number;
  expensesCurrentMonth: number;
  expensesPreviousMonth: number;
  expensesChangePercent: number;
  openOrdersCount: number;
  oldestOpenOrderDate: string | null;
  openTasksCount: number;
  nextTaskDueDate: string | null;
}

export interface RecentProduct {
  id: string;
  name: string;
  status: string;
  updated_at: string;
}

export interface LowMarginProduct {
  id: string;
  name: string;
  estimated_margin: number;
  status: string;
}

export interface IncompleteListing {
  id: string;
  title: string;
  platform: string | null;
  completeness: number;
  missingFields: string[];
}

export interface PipelineProduct {
  id: string;
  name: string;
  status: string;
}

export interface PipelineProductGroup {
  status: string;
  products: PipelineProduct[];
}

export interface RecentOrder {
  id: string;
  receipt_number: string;
  platform: string;
  product_name: string | null;
  status: string;
  updated_at: string;
}

export type TimeRangePreset =
  | 'current_month'
  | 'last_month'
  | 'last_3_months'
  | 'last_6_months'
  | 'current_year'
  | 'all_time';

export interface TimeRange {
  preset: TimeRangePreset;
  startDate: string;
  endDate: string;
}

export interface AnalyticsKPIs {
  revenueTotal: number;
  expensesTotal: number;
  averageMargin: number | null;
}

export interface RevenueByPlatformDatum {
  platform: string;
  month: string;
  revenue: number;
}

export interface ExpensesByCategoryDatum {
  category: string;
  amount: number;
}

export interface MarginByProductDatum {
  id: string;
  name: string;
  estimated_margin: number;
}

export interface ListingStatusDatum {
  status: string;
  count: number;
}

export interface KpiSnapshot {
  id: string;
  period_type: 'week' | 'month';
  period_start: string;
  period_end: string;
  revenue: number;
  expenses_total: number;
  orders_count: number;
  open_orders: number;
  open_tasks: number;
  completed_orders: number;
  active_products: number;
  active_listings: number;
  avg_margin: number | null;
  revenue_by_platform: Record<string, number> | null;
  expenses_by_category: Record<string, number> | null;
  created_at: string;
}

export interface TopProductByRevenue {
  id: string;
  name: string;
  revenue: number;
}

export interface DashboardAnalysisInput {
  kpis: AnalyticsKPIs;
  revenueByPlatform: RevenueByPlatformDatum[];
  expensesByCategory: ExpensesByCategoryDatum[];
  bottomMarginProducts: MarginByProductDatum[];
  topProductsByRevenue: TopProductByRevenue[];
  startDate: string;
  endDate: string;
}
