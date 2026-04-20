import { useMemo, useRef } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Product } from '../schema';
import { StatusBadge } from './StatusBadge';
import { MarginCell } from './MarginCell';
import { PlatformIcons } from './PlatformIcons';
import { formatRelativeDate, formatEUR } from '../utils';
import { useState } from 'react';

const columnHelper = createColumnHelper<Product>();

const ROW_HEIGHT = 44;

function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc') return <ArrowUp size={12} />;
  if (sorted === 'desc') return <ArrowDown size={12} />;
  return <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-50" />;
}

function createColumns() {
  return [
    columnHelper.accessor('status', {
      header: 'Status',
      size: 100,
      cell: (info) => <StatusBadge status={info.getValue()} />,
    }),
    columnHelper.accessor('name', {
      header: 'Name',
      size: 99999, // flex
      minSize: 200,
      cell: (info) => (
        <span className="truncate font-medium" title={info.getValue()}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('category', {
      header: 'Kategorie',
      size: 120,
      cell: (info) => <span className="truncate">{info.getValue()}</span>,
    }),
    columnHelper.accessor('material_type', {
      header: 'Material',
      size: 100,
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('target_price', {
      header: 'Zielpreis',
      size: 100,
      cell: (info) => <span className="tabular-nums">{formatEUR(info.getValue())}</span>,
      meta: { align: 'right' as const },
    }),
    columnHelper.accessor('estimated_margin', {
      header: 'Marge',
      size: 100,
      cell: (info) => <MarginCell marginPercent={info.getValue()} />,
      meta: { align: 'right' as const },
    }),
    columnHelper.accessor('platforms', {
      header: 'Plattformen',
      size: 120,
      enableSorting: false,
      cell: (info) => <PlatformIcons platforms={info.getValue()} />,
    }),
    columnHelper.accessor('updated_at', {
      header: 'Letzte Änderung',
      size: 140,
      cell: (info) => (
        <span
          className="text-text-secondary"
          title={new Date(info.getValue()).toLocaleString('de-DE')}
        >
          {formatRelativeDate(info.getValue())}
        </span>
      ),
    }),
  ];
}

interface ProductsTableProps {
  products: Product[];
  isLoading: boolean;
}

export function ProductsTable({ products, isLoading }: ProductsTableProps) {
  const columns = useMemo(() => createColumns(), []);
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: products,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const { rows } = table.getRowModel();

  // Virtualization
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-text-muted">
        Produkte werden geladen...
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-text-muted">
        <p className="text-sm">Keine Produkte gefunden</p>
        <p className="text-xs">Passe deine Filter an oder erstelle ein neues Produkt.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-border-subtle bg-bg-elevated dark:border-transparent dark:shadow-md">
      {/* Table Header */}
      <div className="flex border-b border-border-subtle bg-bg-secondary dark:border-transparent dark:bg-bg-elevated-1">
        {table.getHeaderGroups().map((headerGroup) =>
          headerGroup.headers.map((header) => {
            const meta = header.column.columnDef.meta as { align?: 'right' } | undefined;
            return (
              <div
                key={header.id}
                className={cn(
                  'group flex h-9 shrink-0 cursor-pointer select-none items-center gap-1 px-3 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary',
                  meta?.align === 'right' && 'justify-end',
                )}
                style={{
                  width:
                    header.column.columnDef.size === 99999 ? undefined : header.column.getSize(),
                  flex: header.column.columnDef.size === 99999 ? '1 1 0%' : undefined,
                }}
                onClick={header.column.getToggleSortingHandler()}
              >
                {flexRender(header.column.columnDef.header, header.getContext())}
                {header.column.getCanSort() && <SortIcon sorted={header.column.getIsSorted()} />}
              </div>
            );
          }),
        )}
      </div>

      {/* Table Body (virtualized) */}
      <div ref={parentRef} className="flex-1 overflow-auto">
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            const isDeleted = row.original.deleted_at !== null;

            return (
              <div
                key={row.id}
                className={cn(
                  'absolute left-0 top-0 flex w-full items-center border-b border-border-subtle transition-colors hover:bg-bg-hover dark:border-transparent',
                  isDeleted && 'opacity-50',
                )}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta as { align?: 'right' } | undefined;
                  return (
                    <div
                      key={cell.id}
                      className={cn(
                        'flex h-full items-center px-3 text-sm',
                        meta?.align === 'right' && 'justify-end',
                        isDeleted && 'line-through',
                      )}
                      style={{
                        width:
                          cell.column.columnDef.size === 99999 ? undefined : cell.column.getSize(),
                        flex: cell.column.columnDef.size === 99999 ? '1 1 0%' : undefined,
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
