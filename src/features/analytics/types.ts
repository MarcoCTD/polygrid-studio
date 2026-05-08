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
