import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { cn } from "@/lib/utils";
import type { Order } from "../types";
import { PAYMENT_STATUS_LABELS, type PaymentStatus } from "../types";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatCurrency(n: number): string {
  return n.toFixed(2).replace(".", ",") + " €";
}

const columns: ColumnDef<Order>[] = [
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <OrderStatusBadge status={row.original.status} />,
    size: 130,
    filterFn: "equals",
  },
  {
    accessorKey: "order_date",
    header: "Datum",
    cell: ({ row }) => (
      <span className="text-sm tabular-nums text-[--foreground]">
        {formatDate(row.original.order_date)}
      </span>
    ),
    size: 110,
  },
  {
    accessorKey: "customer_name",
    header: "Kunde",
    cell: ({ row }) => (
      <div>
        <div className="font-medium text-[--foreground]">
          {row.original.customer_name || "—"}
        </div>
        {row.original.external_order_id && (
          <div className="text-xs text-[--muted-foreground]">
            #{row.original.external_order_id}
          </div>
        )}
      </div>
    ),
    minSize: 140,
  },
  {
    accessorKey: "platform",
    header: "Plattform",
    cell: ({ row }) => (
      <Badge variant="secondary">{row.original.platform}</Badge>
    ),
    filterFn: "equals",
    size: 110,
  },
  {
    accessorKey: "quantity",
    header: "Menge",
    cell: ({ row }) => (
      <span className="text-sm tabular-nums text-[--foreground]">
        {row.original.quantity}x
      </span>
    ),
    size: 70,
  },
  {
    accessorKey: "sale_price",
    header: "Preis",
    cell: ({ row }) => (
      <span className="font-mono text-sm font-medium tabular-nums text-[--foreground]">
        {formatCurrency(row.original.sale_price)}
      </span>
    ),
    size: 110,
  },
  {
    accessorKey: "payment_status",
    header: "Zahlung",
    cell: ({ row }) => {
      const ps = row.original.payment_status as PaymentStatus;
      const variant =
        ps === "paid" ? "success" : ps === "pending" ? "warning" : ps === "refunded" ? "muted" : "danger";
      return (
        <Badge variant={variant}>
          {PAYMENT_STATUS_LABELS[ps] ?? ps}
        </Badge>
      );
    },
    size: 110,
  },
];

function SortIcon({ state }: { state: false | "asc" | "desc" }) {
  if (!state) return <ChevronsUpDown className="size-3.5 opacity-30" />;
  return state === "asc"
    ? <ChevronUp className="size-3.5 text-[--accent-primary]" />
    : <ChevronDown className="size-3.5 text-[--accent-primary]" />;
}

interface OrderTableProps {
  orders: Order[];
  selectedId?: string | null;
  statusFilter?: string;
  platformFilter?: string;
  globalFilter?: string;
  onRowClick?: (order: Order) => void;
}

export function OrderTable({
  orders,
  selectedId,
  statusFilter,
  platformFilter,
  globalFilter,
  onRowClick,
}: OrderTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "order_date", desc: true },
  ]);

  const columnFilters: ColumnFiltersState = [
    ...(statusFilter ? [{ id: "status", value: statusFilter }] : []),
    ...(platformFilter ? [{ id: "platform", value: platformFilter }] : []),
  ];

  const table = useReactTable({
    data: orders,
    columns,
    state: { sorting, columnFilters, globalFilter },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    globalFilterFn: "includesString",
  });

  const rows = table.getRowModel().rows;
  const totalRevenue = rows.reduce((sum, r) => sum + r.original.sale_price * r.original.quantity, 0);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-[--border]">
        {table.getHeaderGroups().map((hg) => (
          <div key={hg.id} className="flex items-center">
            {hg.headers.map((header) => (
              <div
                key={header.id}
                className={cn(
                  "flex items-center gap-1 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-[--muted-foreground]",
                  header.column.getCanSort() && "cursor-pointer select-none hover:text-[--foreground]"
                )}
                style={{ width: header.getSize(), flexShrink: 0, flexGrow: header.column.columnDef.minSize ? 1 : 0 }}
                onClick={header.column.getToggleSortingHandler()}
              >
                {flexRender(header.column.columnDef.header, header.getContext())}
                {header.column.getCanSort() && (
                  <SortIcon state={header.column.getIsSorted()} />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-[--muted-foreground]">Keine Aufträge gefunden.</p>
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              onClick={() => onRowClick?.(row.original)}
              className={cn(
                "flex cursor-pointer items-center border-b border-[--border] transition-colors",
                "hover:bg-[--muted]",
                selectedId === row.original.id && "bg-[--accent-primary-subtle]"
              )}
            >
              {row.getVisibleCells().map((cell) => (
                <div
                  key={cell.id}
                  className="px-3 py-3"
                  style={{
                    width: cell.column.getSize(),
                    flexShrink: 0,
                    flexGrow: cell.column.columnDef.minSize ? 1 : 0,
                    minWidth: 0,
                  }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-[--border] px-3 py-2">
        <span className="text-xs text-[--muted-foreground]">
          {rows.length} {rows.length === 1 ? "Auftrag" : "Aufträge"}
          {rows.length !== orders.length && ` von ${orders.length}`}
        </span>
        <span className="font-mono text-xs font-medium tabular-nums text-[--foreground]">
          Umsatz: {formatCurrency(totalRevenue)}
        </span>
      </div>
    </div>
  );
}
