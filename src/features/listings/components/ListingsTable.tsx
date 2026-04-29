import { useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ArrowUp, ArrowUpDown, ImageIcon } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { formatEUR, formatRelativeDate } from '@/features/products/utils';
import type { ListingListItem } from '../listingsService';
import { ListingStatusBadge } from './ListingStatusBadge';
import { PlatformStatusBadges } from './PlatformStatusBadges';

const ROW_HEIGHT = 56;
const TITLE_COL_MIN_WIDTH = 240;
const columnHelper = createColumnHelper<ListingListItem>();

interface ListingsTableProps {
  listings: ListingListItem[];
  isLoading: boolean;
  selectedIds: Set<string>;
  onToggleSelected: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onClearSelection: () => void;
  onOpenListing: (listing: ListingListItem) => void;
}

function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc') return <ArrowUp size={12} />;
  if (sorted === 'desc') return <ArrowDown size={12} />;
  return <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-50" />;
}

function colStyle(size: number | undefined): CSSProperties {
  if (size === undefined || size === 99999) {
    return { flex: '1 1 0%', minWidth: TITLE_COL_MIN_WIDTH, overflow: 'hidden' };
  }

  return { flex: '0 0 auto', width: size };
}

function computeTotalMinWidth(columns: ColumnDef<ListingListItem, unknown>[]): number {
  return columns.reduce((sum, column) => {
    const size = column.size;
    if (size === undefined) return sum + 100;
    if (size === 99999) return sum + TITLE_COL_MIN_WIDTH;
    return sum + size;
  }, 0);
}

function inventoryLabel(listing: ListingListItem): string {
  if (listing.inventory_mode === 'stock') {
    return `Lager: ${listing.stock_quantity ?? 0}`;
  }

  return 'Auf Bestellung';
}

export function ListingsTable({
  listings,
  isLoading,
  selectedIds,
  onToggleSelected,
  onSelectAll,
  onClearSelection,
  onOpenListing,
}: ListingsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'updated_at', desc: true }]);
  const parentRef = useRef<HTMLDivElement>(null);
  const allListingIds = useMemo(() => listings.map((listing) => listing.id), [listings]);

  const columns = useMemo(
    () =>
      [
        columnHelper.display({
          id: 'select',
          size: 40,
          header: () => {
            const allSelected =
              allListingIds.length > 0 && allListingIds.every((id) => selectedIds.has(id));
            const someSelected = allListingIds.some((id) => selectedIds.has(id));
            return (
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected && !allSelected}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onSelectAll(allListingIds);
                  } else {
                    onClearSelection();
                  }
                }}
              />
            );
          },
          cell: ({ row }) => (
            <Checkbox
              checked={selectedIds.has(row.original.id)}
              onCheckedChange={() => onToggleSelected(row.original.id)}
              onClick={(event) => event.stopPropagation()}
            />
          ),
          enableSorting: false,
        }),
        columnHelper.accessor('status', {
          header: 'Status',
          size: 100,
          cell: (info) => <ListingStatusBadge status={info.getValue()} />,
        }),
        columnHelper.display({
          id: 'thumbnail',
          header: 'Bild',
          size: 60,
          cell: ({ row }) => (
            <div className="flex size-12 items-center justify-center overflow-hidden rounded-md border border-border-subtle bg-bg-secondary">
              {row.original.thumbnail_path ? (
                <img
                  src={row.original.thumbnail_path}
                  alt={row.original.thumbnail_alt_text ?? ''}
                  className="size-full object-cover"
                />
              ) : (
                <ImageIcon size={18} className="text-text-muted" />
              )}
            </div>
          ),
          enableSorting: false,
        }),
        columnHelper.accessor('master_title', {
          header: 'Master-Titel',
          size: 99999,
          cell: (info) => (
            <button
              type="button"
              className="max-w-full truncate font-medium text-pg-accent hover:underline"
              title={info.getValue()}
              onClick={(event) => {
                event.stopPropagation();
                onOpenListing(info.row.original);
              }}
            >
              {info.getValue()}
            </button>
          ),
        }),
        columnHelper.accessor('product_name', {
          header: 'Produkt',
          size: 160,
          cell: (info) => (
            <span className="truncate text-text-secondary" title={info.getValue() ?? undefined}>
              {info.getValue() ?? 'Unbekannt'}
            </span>
          ),
        }),
        columnHelper.display({
          id: 'platforms',
          header: 'Plattformen',
          size: 140,
          cell: ({ row }) => (
            <PlatformStatusBadges
              overrides={row.original.overrides}
              masterStatus={row.original.status}
              completeness={row.original.completeness}
            />
          ),
          enableSorting: false,
        }),
        columnHelper.accessor('inventory_mode', {
          header: 'Inventory',
          size: 120,
          cell: ({ row }) => (
            <span className="text-text-secondary">{inventoryLabel(row.original)}</span>
          ),
        }),
        columnHelper.accessor('base_price', {
          header: 'Basispreis',
          size: 110,
          cell: (info) => <span className="tabular-nums">{formatEUR(info.getValue())}</span>,
          meta: { align: 'right' as const },
        }),
        columnHelper.accessor('language', {
          header: 'Sprache',
          size: 70,
          cell: (info) => (
            <span className="rounded-full bg-bg-secondary px-2 py-0.5 text-xs font-medium text-text-secondary">
              {info.getValue().toUpperCase()}
            </span>
          ),
        }),
        columnHelper.accessor('updated_at', {
          header: 'Geändert',
          size: 120,
          cell: (info) => (
            <span
              className="text-text-secondary"
              title={new Date(info.getValue()).toLocaleString('de-DE')}
            >
              {formatRelativeDate(info.getValue())}
            </span>
          ),
        }),
      ] as ColumnDef<ListingListItem, unknown>[],
    [allListingIds, onClearSelection, onOpenListing, onSelectAll, onToggleSelected, selectedIds],
  );

  const table = useReactTable({
    data: listings,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const totalMinWidth = useMemo(() => computeTotalMinWidth(columns), [columns]);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-border-subtle bg-bg-elevated text-sm text-text-muted dark:border-transparent">
        Listings werden geladen...
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-border-subtle bg-bg-elevated text-text-muted dark:border-transparent">
        <p className="text-sm">Keine Listings gefunden</p>
        <p className="text-xs">Passe deine Filter an oder erstelle später ein neues Listing.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-border-subtle bg-bg-elevated dark:border-transparent dark:shadow-md">
      <div ref={parentRef} className="flex-1 overflow-auto">
        <div style={{ minWidth: totalMinWidth }} className="flex flex-col">
          <div className="sticky top-0 z-10 flex border-b border-border-subtle bg-bg-secondary dark:border-transparent dark:bg-bg-elevated-1">
            {table.getHeaderGroups().map((headerGroup) =>
              headerGroup.headers.map((header) => {
                const meta = header.column.columnDef.meta as { align?: 'right' } | undefined;
                return (
                  <div
                    key={header.id}
                    className={cn(
                      'group flex h-9 items-center gap-1 px-3 text-xs font-medium text-text-secondary transition-colors',
                      header.column.getCanSort() &&
                        'cursor-pointer select-none hover:text-text-primary',
                      meta?.align === 'right' && 'justify-end',
                    )}
                    style={colStyle(header.column.columnDef.size)}
                    onClick={
                      header.column.getCanSort()
                        ? header.column.getToggleSortingHandler()
                        : undefined
                    }
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getCanSort() && (
                      <SortIcon sorted={header.column.getIsSorted()} />
                    )}
                  </div>
                );
              }),
            )}
          </div>

          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              const isDeleted = row.original.deleted_at !== null;
              const isSelected = selectedIds.has(row.original.id);

              return (
                <div
                  key={row.id}
                  className={cn(
                    'absolute left-0 top-0 flex w-full items-center border-b border-border-subtle transition-colors hover:bg-bg-hover dark:border-transparent',
                    isDeleted && 'opacity-50',
                    isSelected && 'bg-accent-subtle',
                  )}
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                    minWidth: '100%',
                  }}
                  onClick={() => onOpenListing(row.original)}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as { align?: 'right' } | undefined;
                    return (
                      <div
                        key={cell.id}
                        className={cn(
                          'flex h-full min-w-0 items-center px-3 text-sm',
                          meta?.align === 'right' && 'justify-end',
                          isDeleted && 'line-through',
                        )}
                        style={colStyle(cell.column.columnDef.size)}
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
    </div>
  );
}
