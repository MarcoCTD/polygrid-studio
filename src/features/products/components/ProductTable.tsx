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
import { StatusBadge } from "./StatusBadge";
import { cn } from "@/lib/utils";
import type { Product } from "../types";

// ── Column definitions ────────────────────────────────────────────────────────

const columns: ColumnDef<Product>[] = [
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
    size: 130,
    filterFn: "equals",
  },
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <div>
        <div className="font-medium text-[--foreground]">{row.original.name}</div>
        {row.original.short_name && (
          <div className="text-xs text-[--muted-foreground]">{row.original.short_name}</div>
        )}
      </div>
    ),
    minSize: 160,
  },
  {
    accessorKey: "category",
    header: "Kategorie",
    cell: ({ row }) => (
      <span className="text-sm text-[--foreground]">{row.original.category}</span>
    ),
    filterFn: "equals",
    size: 140,
  },
  {
    accessorKey: "material_type",
    header: "Material",
    cell: ({ row }) => (
      <Badge variant="outline">{row.original.material_type}</Badge>
    ),
    size: 90,
  },
  {
    accessorKey: "target_price",
    header: "Zielpreis",
    cell: ({ row }) =>
      row.original.target_price != null ? (
        <span className="font-mono text-sm tabular-nums">
          {row.original.target_price.toFixed(2).replace(".", ",")} €
        </span>
      ) : (
        <span className="text-[--muted-foreground]">—</span>
      ),
    size: 110,
  },
  {
    accessorKey: "estimated_margin",
    header: "Marge",
    cell: ({ row }) => {
      const m = row.original.estimated_margin;
      if (m == null) return <span className="text-[--muted-foreground]">—</span>;
      const cls =
        m >= 50
          ? "text-[--accent-success]"
          : m >= 25
          ? "text-[--accent-warning]"
          : "text-[--accent-danger]";
      return (
        <span className={cn("font-mono text-sm font-medium tabular-nums", cls)}>
          {m.toFixed(1)} %
        </span>
      );
    },
    size: 90,
  },
  {
    accessorKey: "platforms",
    header: "Plattformen",
    cell: ({ row }) => {
      const p = row.original.platforms;
      if (!p || p.length === 0) return <span className="text-[--muted-foreground]">—</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {p.slice(0, 3).map((name) => (
            <Badge key={name} variant="secondary" className="text-xs">
              {name}
            </Badge>
          ))}
          {p.length > 3 && (
            <Badge variant="muted" className="text-xs">
              +{p.length - 3}
            </Badge>
          )}
        </div>
      );
    },
    size: 180,
    enableSorting: false,
  },
];

// ── Sort icon ─────────────────────────────────────────────────────────────────

function SortIcon({ state }: { state: false | "asc" | "desc" }) {
  if (!state) return <ChevronsUpDown className="size-3.5 opacity-30" />;
  return state === "asc"
    ? <ChevronUp className="size-3.5 text-[--accent-primary]" />
    : <ChevronDown className="size-3.5 text-[--accent-primary]" />;
}

// ── ProductTable ──────────────────────────────────────────────────────────────

interface ProductTableProps {
  products: Product[];
  selectedId?: string | null;
  statusFilter?: string;
  categoryFilter?: string;
  globalFilter?: string;
  onRowClick?: (product: Product) => void;
}

export function ProductTable({
  products,
  selectedId,
  statusFilter,
  categoryFilter,
  globalFilter,
  onRowClick,
}: ProductTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columnFilters: ColumnFiltersState = [
    ...(statusFilter ? [{ id: "status", value: statusFilter }] : []),
    ...(categoryFilter ? [{ id: "category", value: categoryFilter }] : []),
  ];

  const table = useReactTable({
    data: products,
    columns,
    state: { sorting, columnFilters, globalFilter },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    globalFilterFn: "includesString",
  });

  const rows = table.getRowModel().rows;

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
            <p className="text-sm text-[--muted-foreground]">Keine Produkte gefunden.</p>
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
      <div className="shrink-0 border-t border-[--border] px-3 py-2">
        <span className="text-xs text-[--muted-foreground]">
          {rows.length} {rows.length === 1 ? "Produkt" : "Produkte"}
          {rows.length !== products.length && ` von ${products.length}`}
        </span>
      </div>
    </div>
  );
}
