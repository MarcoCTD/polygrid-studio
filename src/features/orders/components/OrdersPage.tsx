import { useEffect, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { OrderTable } from "./OrderTable";
import { OrderDetailPanel } from "./OrderDetailPanel";
import { CreateOrderDialog } from "./CreateOrderDialog";
import { useOrderStore, useSelectedOrder } from "../store";
import { ORDER_STATUSES, ORDER_STATUS_LABELS, PLATFORMS } from "../types";
import de from "@/i18n/de.json";

const ALL_VALUE = "__all__";

export function OrdersPage() {
  const { orders, isLoading, error, fetchOrders, selectOrder, selectedOrderId } =
    useOrderStore();
  const selectedOrder = useSelectedOrder();

  const [createOpen, setCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [platformFilter, setPlatformFilter] = useState<string>("");
  const [globalFilter, setGlobalFilter] = useState("");

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const hasActiveFilter = statusFilter || platformFilter || globalFilter;

  function clearFilters() {
    setStatusFilter("");
    setPlatformFilter("");
    setGlobalFilter("");
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Page header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[--border] px-6 py-4">
        <div>
          <h1 className="text-base font-semibold text-[--foreground]">
            {de.orders.title}
          </h1>
          <p className="text-xs text-[--muted-foreground]">{de.orders.subtitle}</p>
        </div>
        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
          className="gap-1.5 bg-[--accent-primary] text-white hover:bg-[--accent-primary-hover]"
        >
          <Plus className="size-4" />
          Neuer Auftrag
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[--border] px-6 py-3">
        <div className="relative w-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[--muted-foreground]" />
          <Input
            placeholder="Suchen..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>

        <Select
          value={statusFilter || ALL_VALUE}
          onValueChange={(v) => setStatusFilter(v === ALL_VALUE ? "" : v)}
        >
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder="Alle Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Alle Status</SelectItem>
            {ORDER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {ORDER_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={platformFilter || ALL_VALUE}
          onValueChange={(v) => setPlatformFilter(v === ALL_VALUE ? "" : v)}
        >
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="Alle Plattformen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Alle Plattformen</SelectItem>
            {PLATFORMS.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilter && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-[--muted-foreground] hover:text-[--foreground] transition-colors"
          >
            <X className="size-3.5" />
            Filter zurücksetzen
          </button>
        )}

        <div className="flex-1" />

        {isLoading && (
          <span className="text-xs text-[--muted-foreground]">Laden...</span>
        )}
      </div>

      {/* Main content */}
      {error ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="rounded-lg border border-[--accent-danger-subtle] bg-[--accent-danger-subtle] px-4 py-2 text-sm text-[--accent-danger]">
            Fehler: {error}
          </p>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <OrderTable
              orders={orders}
              selectedId={selectedOrderId}
              statusFilter={statusFilter}
              platformFilter={platformFilter}
              globalFilter={globalFilter}
              onRowClick={(o) =>
                selectOrder(selectedOrderId === o.id ? null : o.id)
              }
            />
          </div>

          {selectedOrder && (
            <OrderDetailPanel order={selectedOrder} />
          )}
        </div>
      )}

      <CreateOrderDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
