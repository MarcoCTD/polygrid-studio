import { getDb } from "../db";

export interface DashboardStats {
  totalRevenue: number;
  totalExpenses: number;
  totalOrders: number;
  ordersThisMonth: number;
  productsOnline: number;
  productsTotal: number;
  openTasks: number;
  avgMargin: number | null;
}

export interface RecentOrder {
  id: string;
  customer_name: string | null;
  platform: string;
  sale_price: number;
  quantity: number;
  status: string;
  order_date: string;
}

export interface ProductStatusCount {
  status: string;
  count: number;
}

export interface MonthlyRevenue {
  month: string;
  revenue: number;
  expenses: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const db = await getDb();

  const [revenueRow] = await db.select<[{ total: number | null }]>(
    "SELECT COALESCE(SUM(sale_price * quantity), 0) as total FROM orders WHERE deleted_at IS NULL AND status != 'cancelled'"
  );

  const [expenseRow] = await db.select<[{ total: number | null }]>(
    "SELECT COALESCE(SUM(amount_gross), 0) as total FROM expenses WHERE deleted_at IS NULL"
  );

  const [orderRow] = await db.select<[{ total: number }]>(
    "SELECT COUNT(*) as total FROM orders WHERE deleted_at IS NULL"
  );

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const [ordersMonthRow] = await db.select<[{ total: number }]>(
    "SELECT COUNT(*) as total FROM orders WHERE deleted_at IS NULL AND order_date >= ?",
    [monthStart.toISOString().slice(0, 10)]
  );

  const [onlineRow] = await db.select<[{ total: number }]>(
    "SELECT COUNT(*) as total FROM products WHERE deleted_at IS NULL AND status = 'online'"
  );

  const [productsRow] = await db.select<[{ total: number }]>(
    "SELECT COUNT(*) as total FROM products WHERE deleted_at IS NULL"
  );

  const [tasksRow] = await db.select<[{ total: number }]>(
    "SELECT COUNT(*) as total FROM tasks WHERE deleted_at IS NULL AND status IN ('todo', 'in_progress')"
  );

  const [marginRow] = await db.select<[{ avg_margin: number | null }]>(
    "SELECT AVG(estimated_margin) as avg_margin FROM products WHERE deleted_at IS NULL AND estimated_margin IS NOT NULL"
  );

  return {
    totalRevenue: revenueRow?.total ?? 0,
    totalExpenses: expenseRow?.total ?? 0,
    totalOrders: orderRow?.total ?? 0,
    ordersThisMonth: ordersMonthRow?.total ?? 0,
    productsOnline: onlineRow?.total ?? 0,
    productsTotal: productsRow?.total ?? 0,
    openTasks: tasksRow?.total ?? 0,
    avgMargin: marginRow?.avg_margin ?? null,
  };
}

export async function getRecentOrders(limit = 5): Promise<RecentOrder[]> {
  const db = await getDb();
  return db.select<RecentOrder[]>(
    `SELECT id, customer_name, platform, sale_price, quantity, status, order_date
     FROM orders WHERE deleted_at IS NULL
     ORDER BY order_date DESC, created_at DESC LIMIT ?`,
    [limit]
  );
}

export async function getProductStatusCounts(): Promise<ProductStatusCount[]> {
  const db = await getDb();
  return db.select<ProductStatusCount[]>(
    `SELECT status, COUNT(*) as count FROM products
     WHERE deleted_at IS NULL GROUP BY status ORDER BY count DESC`
  );
}

export async function getMonthlyRevenue(months = 6): Promise<MonthlyRevenue[]> {
  const db = await getDb();

  const results: MonthlyRevenue[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = d.toISOString().slice(0, 7); // YYYY-MM
    const label = d.toLocaleDateString("de-DE", { month: "short", year: "2-digit" });

    const [rev] = await db.select<[{ total: number | null }]>(
      `SELECT COALESCE(SUM(sale_price * quantity), 0) as total FROM orders
       WHERE deleted_at IS NULL AND status != 'cancelled'
       AND substr(order_date, 1, 7) = ?`,
      [start]
    );

    const [exp] = await db.select<[{ total: number | null }]>(
      `SELECT COALESCE(SUM(amount_gross), 0) as total FROM expenses
       WHERE deleted_at IS NULL AND substr(date, 1, 7) = ?`,
      [start]
    );

    results.push({
      month: label,
      revenue: rev?.total ?? 0,
      expenses: exp?.total ?? 0,
    });
  }

  return results;
}
