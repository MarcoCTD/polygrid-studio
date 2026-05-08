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
