import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type ColumnDef,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useNavigate } from '@tanstack/react-router';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { InlineStatusBadge } from '@/components/shared';
import { statusEnum, type Product, type Status } from '../schema';
import { updateProduct } from '../db';
import { StatusBadge } from './StatusBadge';
import { LicenseWarningDialog } from './LicenseWarningDialog';
import { MarginCell } from './MarginCell';
import { PlatformIcons } from './PlatformIcons';
import { formatRelativeDate, formatEUR } from '../utils';
import { useProductsUIStore, type ColumnConfig } from '../productsUiStore';
import { LICENSE_RISK_LABELS, STATUS_LABELS } from '../labels';

/** Produktzeile inkl. Verkaufszahl aus dem salesStatsService (Modul 15). */
export type ProductWithSales = Product & { units_sold?: number };

const columnHelper = createColumnHelper<ProductWithSales>();

const ROW_HEIGHT = 44;
// Name column is flex — this is its minimum width used for the totalMinWidth calculation
const NAME_COL_MIN_WIDTH = 200;

function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc') return <ArrowUp size={12} />;
  if (sorted === 'desc') return <ArrowDown size={12} />;
  return <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-50" />;
}

// ============================================================
// Column definitions — all possible columns
// ============================================================

const STATUS_OPTIONS = statusEnum.options.map((status) => ({
  value: status,
  label: STATUS_LABELS[status],
}));

function createAllColumns(
  selectedIds: Set<string>,
  toggleSelected: (id: string) => void,
  selectAll: (ids: string[]) => void,
  clearSelection: () => void,
  allProductIds: string[],
  onStatusSelect: (product: ProductWithSales, status: Status) => Promise<void>,
): Record<string, ColumnDef<ProductWithSales, unknown>> {
  const selectColumn = columnHelper.display({
    id: 'select',
    size: 40,
    header: () => {
      const allSelected =
        allProductIds.length > 0 && allProductIds.every((id) => selectedIds.has(id));
      const someSelected = allProductIds.some((id) => selectedIds.has(id));
      return (
        <Checkbox
          checked={allSelected}
          indeterminate={someSelected && !allSelected}
          onCheckedChange={(checked) => {
            if (checked) {
              selectAll(allProductIds);
            } else {
              clearSelection();
            }
          }}
        />
      );
    },
    cell: ({ row }) => (
      <Checkbox
        checked={selectedIds.has(row.original.id)}
        onCheckedChange={() => toggleSelected(row.original.id)}
        onClick={(e) => e.stopPropagation()}
      />
    ),
    enableSorting: false,
  }) as ColumnDef<ProductWithSales, unknown>;

  return {
    select: selectColumn,
    status: columnHelper.accessor('status', {
      header: 'Status',
      size: 120,
      cell: (info) => (
        <InlineStatusBadge
          value={info.getValue()}
          options={STATUS_OPTIONS}
          renderBadge={(status) => <StatusBadge status={status} />}
          onSelect={(status) => onStatusSelect(info.row.original, status)}
          ariaLabel={`Status von ${info.row.original.name} ändern`}
        />
      ),
    }) as ColumnDef<ProductWithSales, unknown>,
    // Name: flex column — no fixed size, grows to fill available space
    name: columnHelper.accessor('name', {
      header: 'Name',
      // size 99999 = sentinel: treated as flex in our layout
      size: 99999,
      minSize: NAME_COL_MIN_WIDTH,
      cell: (info) => (
        <span
          className="truncate font-medium text-pg-accent hover:underline"
          title={info.getValue()}
        >
          {info.getValue()}
        </span>
      ),
      meta: { clickable: true },
    }) as ColumnDef<ProductWithSales, unknown>,
    category: columnHelper.accessor('category', {
      header: 'Kategorie',
      size: 120,
      cell: (info) => <span className="truncate">{info.getValue()}</span>,
    }) as ColumnDef<ProductWithSales, unknown>,
    material_type: columnHelper.accessor('material_type', {
      header: 'Material',
      size: 100,
      cell: (info) => info.getValue(),
    }) as ColumnDef<ProductWithSales, unknown>,
    target_price: columnHelper.accessor('target_price', {
      header: 'Zielpreis',
      size: 100,
      cell: (info) => <span className="tabular-nums">{formatEUR(info.getValue())}</span>,
      meta: { align: 'right' as const },
    }) as ColumnDef<ProductWithSales, unknown>,
    estimated_margin: columnHelper.accessor('estimated_margin', {
      header: 'Marge',
      size: 100,
      cell: (info) => <MarginCell marginPercent={info.getValue()} />,
      meta: { align: 'right' as const },
    }) as ColumnDef<ProductWithSales, unknown>,
    units_sold: columnHelper.accessor((row) => row.units_sold ?? 0, {
      id: 'units_sold',
      header: 'Verkauft',
      size: 90,
      cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
      sortingFn: 'basic',
      meta: { align: 'right' as const },
    }) as ColumnDef<ProductWithSales, unknown>,
    platforms: columnHelper.accessor('platforms', {
      header: 'Plattformen',
      size: 120,
      enableSorting: false,
      cell: (info) => <PlatformIcons platforms={info.getValue()} />,
    }) as ColumnDef<ProductWithSales, unknown>,
    updated_at: columnHelper.accessor('updated_at', {
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
    }) as ColumnDef<ProductWithSales, unknown>,
    collection: columnHelper.accessor('collection', {
      header: 'Kollektion',
      size: 120,
      cell: (info) => <span className="truncate">{info.getValue() ?? '–'}</span>,
    }) as ColumnDef<ProductWithSales, unknown>,
    print_time_minutes: columnHelper.accessor('print_time_minutes', {
      header: 'Druckzeit',
      size: 100,
      cell: (info) => {
        const v = info.getValue();
        return v !== null ? `${v} min` : '–';
      },
      meta: { align: 'right' as const },
    }) as ColumnDef<ProductWithSales, unknown>,
    material_grams: columnHelper.accessor('material_grams', {
      header: 'Material (g)',
      size: 100,
      cell: (info) => {
        const v = info.getValue();
        return v !== null ? `${v} g` : '–';
      },
      meta: { align: 'right' as const },
    }) as ColumnDef<ProductWithSales, unknown>,
    license_risk: columnHelper.accessor('license_risk', {
      header: 'Lizenz-Risiko',
      size: 120,
      cell: (info) => {
        const v = info.getValue();
        return v ? LICENSE_RISK_LABELS[v] : '–';
      },
    }) as ColumnDef<ProductWithSales, unknown>,
    created_at: columnHelper.accessor('created_at', {
      header: 'Erstellt am',
      size: 140,
      cell: (info) => (
        <span className="text-text-secondary">
          {new Date(info.getValue()).toLocaleDateString('de-DE')}
        </span>
      ),
    }) as ColumnDef<ProductWithSales, unknown>,
  };
}

// ============================================================
// Build visible columns from config
// ============================================================

function buildVisibleColumns(
  allColumns: Record<string, ColumnDef<ProductWithSales, unknown>>,
  config: ColumnConfig[],
): ColumnDef<ProductWithSales, unknown>[] {
  return config
    .filter((c) => c.visible && allColumns[c.id])
    .sort((a, b) => a.order - b.order)
    .map((c) => allColumns[c.id]);
}

// ============================================================
// Helper: compute the minimum total width for the column set
// Used to set minWidth on the inner container so horizontal
// scroll kicks in before columns start compressing.
// ============================================================

function computeTotalMinWidth(columns: ColumnDef<ProductWithSales, unknown>[]): number {
  return columns.reduce((sum, col) => {
    const size = col.size;
    if (size === undefined) return sum + 100;
    if (size === 99999) return sum + NAME_COL_MIN_WIDTH; // flex name col
    return sum + size;
  }, 0);
}

// ============================================================
// Cell width helpers — returns the style props for a cell/header
// Fixed cols: flex 0 0 auto → never shrink or grow
// Flex col (name): flex 1 1 0% + min-width → grows but never below min
// ============================================================

function colStyle(size: number | undefined): React.CSSProperties {
  if (size === undefined || size === 99999) {
    return { flex: '1 1 0%', minWidth: NAME_COL_MIN_WIDTH, overflow: 'hidden' };
  }
  return { flex: '0 0 auto', width: size };
}

// ============================================================
// ProductsTable
// ============================================================

interface ProductsTableProps {
  products: ProductWithSales[];
  isLoading: boolean;
  /** Nach erfolgreichem Inline-Statuswechsel (Liste neu laden). */
  onChanged: () => void;
}

export function ProductsTable({ products, isLoading, onChanged }: ProductsTableProps) {
  const navigate = useNavigate();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pendingOnlineProduct, setPendingOnlineProduct] = useState<ProductWithSales | null>(null);

  const {
    selectedIds,
    toggleSelected,
    selectAll,
    clearSelection,
    activeRowIndex,
    setActiveRowIndex,
    toggleRange,
    columnConfig,
  } = useProductsUIStore();

  const allProductIds = useMemo(() => products.map((p) => p.id), [products]);

  /** Persistiert den Statuswechsel über denselben Service-Pfad wie der Editor. */
  const applyStatus = useCallback(
    async (product: ProductWithSales, status: Status) => {
      try {
        await updateProduct(product.id, { status });
        toast.success(`Status geändert: ${STATUS_LABELS[status]}`);
        onChanged();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Status konnte nicht geändert werden',
        );
      }
    },
    [onChanged],
  );

  const handleStatusSelect = useCallback(
    async (product: ProductWithSales, status: Status) => {
      // Gleiche Lizenz-Regel wie im Produkt-Editor (OverviewTab.handleStatusChange):
      // online nur nach Bestätigung bei fehlendem/riskantem/ungeklärtem Risiko.
      if (status === 'online') {
        const risk = product.license_risk;
        if (!risk || risk === 'risky' || risk === 'review_needed') {
          setPendingOnlineProduct(product);
          return;
        }
      }
      await applyStatus(product, status);
    },
    [applyStatus],
  );

  const allColumns = useMemo(
    () =>
      createAllColumns(
        selectedIds,
        toggleSelected,
        selectAll,
        clearSelection,
        allProductIds,
        handleStatusSelect,
      ),
    [selectedIds, toggleSelected, selectAll, clearSelection, allProductIds, handleStatusSelect],
  );

  const columns = useMemo(
    () => buildVisibleColumns(allColumns, columnConfig),
    [allColumns, columnConfig],
  );

  const totalMinWidth = useMemo(() => computeTotalMinWidth(columns), [columns]);

  const table = useReactTable({
    data: products,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const { rows } = table.getRowModel();

  // Single scroll container: both x (horizontal) and y (vertical).
  // The header sits sticky inside it, so it scrolls horizontally in sync
  // but stays fixed when scrolling vertically.
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  // Keyboard Navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const rowCount = rows.length;
      if (rowCount === 0) return;

      switch (e.key) {
        case 'j':
        case 'ArrowDown': {
          e.preventDefault();
          const nextIndex = Math.min(activeRowIndex + 1, rowCount - 1);
          setActiveRowIndex(nextIndex);
          if (e.shiftKey) {
            toggleRange(
              rows.map((r) => r.original.id),
              activeRowIndex,
              nextIndex,
            );
          }
          break;
        }
        case 'k':
        case 'ArrowUp': {
          e.preventDefault();
          const prevIndex = Math.max(activeRowIndex - 1, 0);
          setActiveRowIndex(prevIndex);
          if (e.shiftKey) {
            toggleRange(
              rows.map((r) => r.original.id),
              activeRowIndex,
              prevIndex,
            );
          }
          break;
        }
        case 'Enter': {
          if (activeRowIndex >= 0 && activeRowIndex < rowCount) {
            e.preventDefault();
            const product = rows[activeRowIndex].original;
            navigate({
              to: '/products/$productId',
              params: { productId: product.id },
            });
          }
          break;
        }
        case ' ': {
          if (activeRowIndex >= 0 && activeRowIndex < rowCount) {
            e.preventDefault();
            const product = rows[activeRowIndex].original;
            toggleSelected(product.id);
          }
          break;
        }
        case 'Escape': {
          if (selectedIds.size > 0) {
            e.preventDefault();
            clearSelection();
          }
          break;
        }
      }
    },
    [
      activeRowIndex,
      rows,
      navigate,
      toggleSelected,
      clearSelection,
      selectedIds.size,
      setActiveRowIndex,
      toggleRange,
    ],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Scroll active row into view (vertical only)
  useEffect(() => {
    if (activeRowIndex >= 0) {
      virtualizer.scrollToIndex(activeRowIndex, { align: 'auto' });
    }
  }, [activeRowIndex, virtualizer]);

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
    <>
    <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-border-subtle bg-bg-elevated dark:border-transparent dark:shadow-md">
      {/*
       * Single scroll container that handles BOTH axes:
       * - overflow-x: auto → horizontal scrollbar appears when content exceeds width
       * - overflow-y: auto → vertical scrollbar for virtualized rows
       *
       * The header uses `sticky top-0` so it stays visible when scrolling
       * vertically, but moves with the body when scrolling horizontally.
       */}
      <div ref={parentRef} className="flex-1 overflow-auto">
        {/* Inner content wrapper: forces minimum width so scroll triggers correctly */}
        <div style={{ minWidth: totalMinWidth }} className="flex flex-col">
          {/* Sticky header — scrolls horizontally with body, stays fixed vertically */}
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

          {/* Virtualized rows */}
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              const isDeleted = row.original.deleted_at !== null;
              const isActive = virtualRow.index === activeRowIndex;
              const isRowSelected = selectedIds.has(row.original.id);

              return (
                <div
                  key={row.id}
                  className={cn(
                    'absolute left-0 top-0 flex w-full items-center border-b border-border-subtle transition-colors hover:bg-bg-hover dark:border-transparent',
                    isDeleted && 'opacity-50',
                    isRowSelected && 'bg-accent-subtle',
                    isActive && 'ring-2 ring-inset ring-pg-accent',
                  )}
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                    // Ensure row is never narrower than the inner content
                    minWidth: '100%',
                  }}
                  onClick={() => setActiveRowIndex(virtualRow.index)}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as
                      | { align?: 'right'; clickable?: boolean }
                      | undefined;
                    return (
                      <div
                        key={cell.id}
                        className={cn(
                          'flex h-full items-center px-3 text-sm',
                          meta?.align === 'right' && 'justify-end',
                          isDeleted && 'line-through',
                          meta?.clickable && 'cursor-pointer',
                        )}
                        style={colStyle(cell.column.columnDef.size)}
                        onClick={
                          meta?.clickable
                            ? () =>
                                navigate({
                                  to: '/products/$productId',
                                  params: { productId: row.original.id },
                                })
                            : undefined
                        }
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

    {/* Lizenz-Gate auch beim Inline-Wechsel auf online (wie im Editor) */}
    {pendingOnlineProduct ? (
      <LicenseWarningDialog
        open
        onOpenChange={(open) => {
          if (!open) setPendingOnlineProduct(null);
        }}
        product={pendingOnlineProduct}
        onConfirm={() => {
          const product = pendingOnlineProduct;
          setPendingOnlineProduct(null);
          if (product) void applyStatus(product, 'online');
        }}
        onCancel={() => setPendingOnlineProduct(null)}
      />
    ) : null}
    </>
  );
}
