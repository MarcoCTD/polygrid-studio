import { useEffect, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Package,
  CheckSquare,
  Receipt,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  getDashboardStats,
  getRecentOrders,
  getProductStatusCounts,
  getMonthlyRevenue,
  type DashboardStats,
  type RecentOrder,
  type ProductStatusCount,
  type MonthlyRevenue,
} from "@/services/database/queries/dashboard";
import { cn } from "@/lib/utils";
import de from "@/i18n/de.json";

function formatCurrency(n: number): string {
  return n.toFixed(2).replace(".", ",") + " €";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

const STATUS_LABELS: Record<string, string> = {
  idea: "Idee",
  review: "Review",
  print_ready: "Druckbereit",
  test_print: "Testdruck",
  launch_ready: "Launch-bereit",
  online: "Online",
  paused: "Pausiert",
  discontinued: "Eingestellt",
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  inquiry: "Anfrage",
  quoted: "Angebot",
  ordered: "Bestellt",
  paid: "Bezahlt",
  in_production: "In Produktion",
  ready: "Fertig",
  shipped: "Versendet",
  completed: "Abgeschlossen",
  issue: "Problem",
  cancelled: "Storniert",
};

// ── KPI Card ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ElementType;
  trend?: "up" | "down" | null;
  accent?: string;
}

function KpiCard({ label, value, subValue, icon: Icon, trend, accent }: KpiCardProps) {
  return (
    <div className="rounded-lg border border-[--border] bg-[--card] p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-[--muted-foreground]">
          {label}
        </span>
        <Icon className={cn("size-4", accent ?? "text-[--muted-foreground]")} />
      </div>
      <div className="mt-2 flex items-end gap-2">
        <span className="text-2xl font-semibold tabular-nums text-[--foreground]">{value}</span>
        {trend && (
          trend === "up"
            ? <TrendingUp className="mb-0.5 size-4 text-[--accent-success]" />
            : <TrendingDown className="mb-0.5 size-4 text-[--accent-danger]" />
        )}
      </div>
      {subValue && (
        <p className="mt-1 text-xs text-[--muted-foreground]">{subValue}</p>
      )}
    </div>
  );
}

// ── Recent Orders Table ───────────────────────────────────────────────────────

function RecentOrdersCard({
  orders,
  onViewAll,
}: {
  orders: RecentOrder[];
  onViewAll?: () => void;
}) {
  return (
    <div className="rounded-lg border border-[--border] bg-[--card]">
      <div className="flex items-center justify-between border-b border-[--border] px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[--muted-foreground]">
          Letzte Aufträge
        </h3>
        {onViewAll && (
          <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs" onClick={onViewAll}>
            Alle <ArrowRight className="size-3" />
          </Button>
        )}
      </div>
      {orders.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-[--muted-foreground]">
          Noch keine Aufträge vorhanden.
        </div>
      ) : (
        <div>
          {orders.map((order) => (
            <div
              key={order.id}
              className="flex items-center gap-3 border-b border-[--border] px-4 py-2.5 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-[--foreground]">
                  {order.customer_name || "Unbekannter Kunde"}
                </div>
                <div className="text-xs text-[--muted-foreground]">
                  {order.platform} &middot; {formatDate(order.order_date)}
                </div>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {ORDER_STATUS_LABELS[order.status] ?? order.status}
              </Badge>
              <span className="font-mono text-sm font-medium tabular-nums text-[--foreground]">
                {formatCurrency(order.sale_price * order.quantity)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Product Status Overview ───────────────────────────────────────────────────

function ProductStatusCard({ counts }: { counts: ProductStatusCount[] }) {
  const total = counts.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="rounded-lg border border-[--border] bg-[--card]">
      <div className="border-b border-[--border] px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[--muted-foreground]">
          Produkt-Status
        </h3>
      </div>
      {counts.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-[--muted-foreground]">
          Noch keine Produkte vorhanden.
        </div>
      ) : (
        <div className="p-4 space-y-2">
          {counts.map(({ status, count }) => {
            const pct = total > 0 ? (count / total) * 100 : 0;
            const barColor =
              status === "online" ? "bg-[--accent-success]"
              : status === "paused" || status === "discontinued" ? "bg-[--accent-warning]"
              : "bg-[--accent-primary]";
            return (
              <div key={status}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[--foreground]">{STATUS_LABELS[status] ?? status}</span>
                  <span className="tabular-nums text-[--muted-foreground]">{count}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-[--muted]">
                  <div
                    className={cn("h-full rounded-full transition-all", barColor)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Revenue Chart ─────────────────────────────────────────────────────────────

function RevenueChart({ data }: { data: MonthlyRevenue[] }) {
  return (
    <div className="rounded-lg border border-[--border] bg-[--card]">
      <div className="border-b border-[--border] px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[--muted-foreground]">
          Umsatz vs. Ausgaben (6 Monate)
        </h3>
      </div>
      <div className="p-4">
        {data.every((d) => d.revenue === 0 && d.expenses === 0) ? (
          <div className="flex h-40 items-center justify-center text-sm text-[--muted-foreground]">
            Noch keine Daten vorhanden.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                width={50}
                tickFormatter={(v: number) => `${v.toFixed(0)}€`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value, name) => [
                  formatCurrency(Number(value)),
                  name === "revenue" ? "Umsatz" : "Ausgaben",
                ]}
              />
              <Bar dataKey="revenue" fill="var(--accent-primary)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="expenses" fill="var(--accent-danger)" radius={[3, 3, 0, 0]} opacity={0.6} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ── Dashboard Page ────────────────────────────────────────────────────────────

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [statusCounts, setStatusCounts] = useState<ProductStatusCount[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyRevenue[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const [s, ro, sc, md] = await Promise.all([
          getDashboardStats(),
          getRecentOrders(5),
          getProductStatusCounts(),
          getMonthlyRevenue(6),
        ]);
        setStats(s);
        setRecentOrders(ro);
        setStatusCounts(sc);
        setMonthlyData(md);
      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  if (isLoading || !stats) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-[--muted-foreground]">Laden...</span>
      </div>
    );
  }

  const profit = stats.totalRevenue - stats.totalExpenses;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-[--border] px-6 py-4">
        <h1 className="text-base font-semibold text-[--foreground]">{de.dashboard.title}</h1>
        <p className="text-xs text-[--muted-foreground]">{de.dashboard.subtitle}</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-6 p-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4">
            <KpiCard
              label="Umsatz"
              value={formatCurrency(stats.totalRevenue)}
              subValue={`Gewinn: ${formatCurrency(profit)}`}
              icon={TrendingUp}
              trend={profit >= 0 ? "up" : "down"}
              accent="text-[--accent-success]"
            />
            <KpiCard
              label="Aufträge"
              value={String(stats.totalOrders)}
              subValue={`${stats.ordersThisMonth} diesen Monat`}
              icon={ShoppingCart}
              accent="text-[--accent-primary]"
            />
            <KpiCard
              label="Produkte"
              value={`${stats.productsOnline} / ${stats.productsTotal}`}
              subValue={
                stats.avgMargin != null
                  ? `Ø Marge: ${stats.avgMargin.toFixed(1)}%`
                  : "Keine Marge berechnet"
              }
              icon={Package}
              accent="text-[--accent-warning]"
            />
            <KpiCard
              label="Offene Aufgaben"
              value={String(stats.openTasks)}
              subValue={`Ausgaben: ${formatCurrency(stats.totalExpenses)}`}
              icon={CheckSquare}
              accent="text-[--accent-danger]"
            />
          </div>

          {/* Charts + Tables row */}
          <div className="grid grid-cols-[1fr_320px] gap-4">
            <div className="space-y-4">
              <RevenueChart data={monthlyData} />
              <RecentOrdersCard orders={recentOrders} />
            </div>
            <div className="space-y-4">
              <ProductStatusCard counts={statusCounts} />

              {/* Quick Actions */}
              <div className="rounded-lg border border-[--border] bg-[--card]">
                <div className="border-b border-[--border] px-4 py-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[--muted-foreground]">
                    Schnellaktionen
                  </h3>
                </div>
                <div className="p-3 space-y-1.5">
                  <QuickAction icon={Package} label="Neues Produkt" />
                  <QuickAction icon={ShoppingCart} label="Neuer Auftrag" />
                  <QuickAction icon={Receipt} label="Neue Ausgabe" />
                  <QuickAction icon={CheckSquare} label="Neue Aufgabe" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function QuickAction({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <button className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-[--foreground] transition-colors hover:bg-[--muted]">
      <Icon className="size-4 text-[--muted-foreground]" />
      {label}
    </button>
  );
}
