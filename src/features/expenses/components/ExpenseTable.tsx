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
import { ChevronUp, ChevronDown, ChevronsUpDown, Paperclip, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Expense } from "../types";
import { EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from "../types";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatCurrency(n: number): string {
  return n.toFixed(2).replace(".", ",") + " €";
}

const columns: ColumnDef<Expense>[] = [
  {
    accessorKey: "date",
    header: "Datum",
    cell: ({ row }) => (
      <span className="text-sm text-[--foreground] tabular-nums">
        {formatDate(row.original.date)}
      </span>
    ),
    size: 110,
  },
  {
    accessorKey: "vendor",
    header: "Lieferant",
    cell: ({ row }) => (
      <div>
        <div className="font-medium text-[--foreground]">{row.original.vendor}</div>
        {row.original.purpose && (
          <div className="text-xs text-[--muted-foreground] truncate max-w-[200px]">
            {row.original.purpose}
          </div>
        )}
      </div>
    ),
    minSize: 160,
  },
  {
    accessorKey: "category",
    header: "Kategorie",
    cell: ({ row }) => (
      <Badge variant="outline">
        {EXPENSE_CATEGORY_LABELS[row.original.category as ExpenseCategory] ?? row.original.category}
      </Badge>
    ),
    filterFn: "equals",
    size: 140,
  },
  {
    accessorKey: "amount_gross",
    header: "Betrag (brutto)",
    cell: ({ row }) => (
      <span className="font-mono text-sm font-medium tabular-nums text-[--foreground]">
        {formatCurrency(row.original.amount_gross)}
      </span>
    ),
    size: 130,
  },
  {
    accessorKey: "amount_net",
    header: "Netto",
    cell: ({ row }) =>
      row.original.amount_net != null ? (
        <span className="font-mono text-sm tabular-nums text-[--muted-foreground]">
          {formatCurrency(row.original.amount_net)}
        </span>
      ) : (
        <span className="text-[--muted-foreground]">—</span>
      ),
    size: 110,
  },
  {
    accessorKey: "payment_method",
    header: "Zahlung",
    cell: ({ row }) => {
      const m = row.original.payment_method;
      if (!m) return <span className="text-[--muted-foreground]">—</span>;
      const labels: Record<string, string> = {
        bank_transfer: "Überweisung",
        paypal: "PayPal",
        credit_card: "Kreditkarte",
        cash: "Bar",
        other: "Sonstige",
      };
      return <span className="text-sm text-[--foreground]">{labels[m] ?? m}</span>;
    },
    size: 110,
  },
  {
    id: "flags",
    header: "",
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5">
        {row.original.receipt_attached && (
          <Paperclip className="size-3.5 text-[--muted-foreground]" />
        )}
        {row.original.recurring && (
          <RotateCcw className="size-3.5 text-[--accent-primary]" />
        )}
      </div>
    ),
    size: 60,
    enableSorting: false,
  },
];

function SortIcon({ state }: { state: false | "asc" | "desc" }) {
  if (!state) return <ChevronsUpDown className="size-3.5 opacity-30" />;
  return state === "asc"
    ? <ChevronUp className="size-3.5 text-[--accent-primary]" />
    : <ChevronDown className="size-3.5 text-[--accent-primary]" />;
}

interface ExpenseTableProps {
  expenses: Expense[];
  selectedId?: string | null;
  categoryFilter?: string;
  globalFilter?: string;
  onRowClick?: (expense: Expense) => void;
}

export function ExpenseTable({
  expenses,
  selectedId,
  categoryFilter,
  globalFilter,
  onRowClick,
}: ExpenseTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "date", desc: true },
  ]);

  const columnFilters: ColumnFiltersState = [
    ...(categoryFilter ? [{ id: "category", value: categoryFilter }] : []),
  ];

  const table = useReactTable({
    data: expenses,
    columns,
    state: { sorting, columnFilters, globalFilter },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    globalFilterFn: "includesString",
  });

  const rows = table.getRowModel().rows;

  // Sum up visible expenses
  const totalGross = rows.reduce((sum, r) => sum + r.original.amount_gross, 0);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Table header */}
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

      {/* Table body */}
      <div className="flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-[--muted-foreground]">Keine Ausgaben gefunden.</p>
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

      {/* Footer */}
      <div className="flex shrink-0 items-center justify-between border-t border-[--border] px-3 py-2">
        <span className="text-xs text-[--muted-foreground]">
          {rows.length} {rows.length === 1 ? "Ausgabe" : "Ausgaben"}
          {rows.length !== expenses.length && ` von ${expenses.length}`}
        </span>
        <span className="font-mono text-xs font-medium tabular-nums text-[--foreground]">
          Gesamt: {formatCurrency(totalGross)}
        </span>
      </div>
    </div>
  );
}
