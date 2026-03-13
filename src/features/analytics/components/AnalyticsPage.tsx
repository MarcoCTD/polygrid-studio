import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getDb } from "@/services/database/db";
import de from "@/i18n/de.json";

function formatCurrency(n: number): string {
  return n.toFixed(2).replace(".", ",") + " €";
}

interface MonthlyData {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
  orders: number;
}

interface PlatformData {
  name: string;
  revenue: number;
  orders: number;
}

interface CategoryExpense {
  name: string;
  value: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  material: "Material",
  equipment: "Ausstattung",
  packaging: "Verpackung",
  shipping: "Versand",
  software: "Software",
  marketing: "Marketing",
  office: "Büro",
  taxes: "Steuern",
  insurance: "Versicherung",
  education: "Weiterbildung",
  other: "Sonstiges",
};

const PIE_COLORS = [
  "var(--accent-primary)",
  "var(--accent-success)",
  "var(--accent-warning)",
  "var(--accent-danger)",
  "var(--muted-foreground)",
  "hsl(280 60% 55%)",
  "hsl(180 50% 45%)",
  "hsl(330 60% 55%)",
];

async function loadAnalyticsData() {
  const db = await getDb();
  const now = new Date();
  const monthlyData: MonthlyData[] = [];

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString("de-DE", { month: "short", year: "2-digit" });

    const [rev] = await db.select<[{ total: number | null; count: number }]>(
      `SELECT COALESCE(SUM(sale_price * quantity), 0) as total, COUNT(*) as count
       FROM orders WHERE deleted_at IS NULL AND status != 'cancelled' AND substr(order_date, 1, 7) = ?`,
      [ym]
    );
    const [exp] = await db.select<[{ total: number | null }]>(
      `SELECT COALESCE(SUM(amount_gross), 0) as total FROM expenses
       WHERE deleted_at IS NULL AND substr(date, 1, 7) = ?`,
      [ym]
    );

    const revenue = rev?.total ?? 0;
    const expenses = exp?.total ?? 0;

    monthlyData.push({
      month: label,
      revenue,
      expenses,
      profit: revenue - expenses,
      orders: rev?.count ?? 0,
    });
  }

  // Platform breakdown
  const platformRows = await db.select<{ platform: string; total: number; count: number }[]>(
    `SELECT platform, COALESCE(SUM(sale_price * quantity), 0) as total, COUNT(*) as count
     FROM orders WHERE deleted_at IS NULL AND status != 'cancelled'
     GROUP BY platform ORDER BY total DESC`
  );
  const platformData: PlatformData[] = platformRows.map((r) => ({
    name: r.platform,
    revenue: r.total,
    orders: r.count,
  }));

  // Expense by category
  const catRows = await db.select<{ category: string; total: number }[]>(
    `SELECT category, COALESCE(SUM(amount_gross), 0) as total
     FROM expenses WHERE deleted_at IS NULL
     GROUP BY category ORDER BY total DESC`
  );
  const categoryData: CategoryExpense[] = catRows.map((r) => ({
    name: CATEGORY_LABELS[r.category] ?? r.category,
    value: r.total,
  }));

  return { monthlyData, platformData, categoryData };
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[--border] bg-[--card]">
      <div className="border-b border-[--border] px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[--muted-foreground]">
          {title}
        </h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function AnalyticsPage() {
  const [data, setData] = useState<{
    monthlyData: MonthlyData[];
    platformData: PlatformData[];
    categoryData: CategoryExpense[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAnalyticsData()
      .then(setData)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading || !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-[--muted-foreground]">Laden...</span>
      </div>
    );
  }

  const hasData = data.monthlyData.some((d) => d.revenue > 0 || d.expenses > 0);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-[--border] px-6 py-4">
        <h1 className="text-base font-semibold text-[--foreground]">{de.analytics.title}</h1>
        <p className="text-xs text-[--muted-foreground]">{de.analytics.subtitle}</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-6 p-6">
          {!hasData ? (
            <div className="flex h-64 items-center justify-center">
              <p className="text-sm text-[--muted-foreground]">
                Noch keine Daten vorhanden. Erstelle Aufträge und Ausgaben, um Analysen zu sehen.
              </p>
            </div>
          ) : (
            <>
              {/* Revenue + Profit Trend */}
              <ChartCard title="Umsatz und Gewinn (12 Monate)">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={data.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={55} tickFormatter={(v: number) => `${v.toFixed(0)}€`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                      formatter={(value, name) => [formatCurrency(Number(value)), name === "revenue" ? "Umsatz" : name === "expenses" ? "Ausgaben" : "Gewinn"]}
                    />
                    <Legend formatter={(value: string) => value === "revenue" ? "Umsatz" : value === "expenses" ? "Ausgaben" : "Gewinn"} />
                    <Line type="monotone" dataKey="revenue" stroke="var(--accent-primary)" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="expenses" stroke="var(--accent-danger)" strokeWidth={2} dot={{ r: 3 }} opacity={0.7} />
                    <Line type="monotone" dataKey="profit" stroke="var(--accent-success)" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 5" />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <div className="grid grid-cols-2 gap-4">
                {/* Orders per month */}
                <ChartCard title="Aufträge pro Monat">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                        formatter={(value) => [Number(value), "Aufträge"]}
                      />
                      <Bar dataKey="orders" fill="var(--accent-primary)" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                {/* Expense breakdown */}
                <ChartCard title="Ausgaben nach Kategorie">
                  {data.categoryData.length === 0 ? (
                    <div className="flex h-[220px] items-center justify-center text-sm text-[--muted-foreground]">
                      Keine Ausgaben vorhanden.
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <ResponsiveContainer width={180} height={180}>
                        <PieChart>
                          <Pie
                            data={data.categoryData}
                            cx="50%"
                            cy="50%"
                            outerRadius={70}
                            innerRadius={40}
                            dataKey="value"
                            paddingAngle={2}
                          >
                            {data.categoryData.map((_entry, index) => (
                              <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                            formatter={(value) => [formatCurrency(Number(value))]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex-1 space-y-1.5">
                        {data.categoryData.slice(0, 6).map((cat, i) => (
                          <div key={cat.name} className="flex items-center gap-2 text-xs">
                            <div
                              className="size-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                            />
                            <span className="flex-1 text-[--foreground]">{cat.name}</span>
                            <span className="font-mono tabular-nums text-[--muted-foreground]">
                              {formatCurrency(cat.value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </ChartCard>
              </div>

              {/* Platform comparison */}
              {data.platformData.length > 0 && (
                <ChartCard title="Umsatz nach Plattform">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.platformData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v.toFixed(0)}€`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={70} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                        formatter={(value, name) => [
                          name === "revenue" ? formatCurrency(Number(value)) : Number(value),
                          name === "revenue" ? "Umsatz" : "Aufträge",
                        ]}
                      />
                      <Bar dataKey="revenue" fill="var(--accent-primary)" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
