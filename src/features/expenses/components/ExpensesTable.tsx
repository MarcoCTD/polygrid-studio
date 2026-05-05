import { useMemo, useRef, useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  CheckCircle,
  Edit,
  MoreHorizontal,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { softDeleteExpense } from '../services';
import type { Expense } from '../schemas';
import { formatDateDE, formatEUR } from '../utils';
import { ExpenseCategoryBadge } from './ExpenseCategoryBadge';

const ROW_HEIGHT = 48;
const VENDOR_COL_MIN_WIDTH = 180;
const columnHelper = createColumnHelper<Expense>();

interface ExpensesTableProps {
  expenses: Expense[];
  isLoading: boolean;
  rowSelection: RowSelectionState;
  onRowSelectionChange: (selection: RowSelectionState) => void;
  onEditExpense: (expense: Expense) => void;
  onDataChanged: () => void;
  productNamesById?: Map<string, string>;
}

function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc') return <ArrowUp size={12} />;
  if (sorted === 'desc') return <ArrowDown size={12} />;
  return <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-50" />;
}

function colStyle(size: number | undefined): React.CSSProperties {
  if (size === undefined || size === 99999) {
    return { flex: '1 1 0%', minWidth: VENDOR_COL_MIN_WIDTH, overflow: 'hidden' };
  }

  return { flex: '0 0 auto', width: size };
}

function computeTotalMinWidth(columns: ColumnDef<Expense, unknown>[]): number {
  return columns.reduce((sum, column) => {
    const size = column.size;
    if (size === undefined) return sum + 100;
    if (size === 99999) return sum + VENDOR_COL_MIN_WIDTH;
    return sum + size;
  }, 0);
}

function receiptIcon(expense: Expense) {
  const hasFlag = expense.receipt_attached;
  const hasPath = Boolean(expense.receipt_file_path?.trim());

  if (hasFlag && hasPath) {
    return <CheckCircle size={16} className="text-emerald-600" aria-label="Beleg vorhanden" />;
  }

  if (hasFlag && !hasPath) {
    return <AlertCircle size={16} className="text-amber-500" aria-label="Belegstatus inkonsistent" />;
  }

  return <XCircle size={16} className="text-text-muted" aria-label="Kein Beleg" />;
}

export function ExpensesTable({
  expenses,
  isLoading,
  rowSelection,
  onRowSelectionChange,
  onEditExpense,
  onDataChanged,
  productNamesById,
}: ExpensesTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: true }]);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const columns = useMemo(
    () =>
      [
        columnHelper.display({
          id: 'select',
          size: 42,
          header: ({ table }) => (
            <Checkbox
              checked={table.getIsAllRowsSelected()}
              indeterminate={table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected()}
              onCheckedChange={(checked) => table.toggleAllRowsSelected(Boolean(checked))}
            />
          ),
          cell: ({ row }) => (
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(checked) => row.toggleSelected(Boolean(checked))}
              onClick={(event) => event.stopPropagation()}
            />
          ),
          enableSorting: false,
        }),
        columnHelper.accessor('date', {
          header: 'Datum',
          size: 120,
          cell: (info) => (
            <span className="tabular-nums text-text-secondary">
              {formatDateDE(info.getValue())}
            </span>
          ),
        }),
        columnHelper.accessor('amount_gross', {
          header: 'Betrag',
          size: 120,
          cell: (info) => <span className="tabular-nums">{formatEUR(info.getValue())}</span>,
          meta: { align: 'right' as const },
        }),
        columnHelper.accessor('vendor', {
          header: 'Händler',
          size: 99999,
          cell: (info) => (
            <span className="truncate font-medium text-text-primary" title={info.getValue()}>
              {info.getValue()}
            </span>
          ),
        }),
        columnHelper.accessor('category', {
          header: 'Kategorie',
          size: 150,
          cell: (info) => <ExpenseCategoryBadge category={info.getValue()} />,
        }),
        columnHelper.accessor('product_id', {
          header: 'Produktbezug',
          size: 150,
          cell: (info) => {
            const productId = info.getValue();
            const productName = productId ? productNamesById?.get(productId) : null;
            return (
              <span
                className="truncate text-text-secondary"
                title={productName ?? productId ?? undefined}
              >
                {productName ?? (productId ? 'Produkt zugeordnet' : '')}
              </span>
            );
          },
        }),
        columnHelper.accessor('receipt_attached', {
          header: 'Beleg',
          size: 80,
          enableSorting: false,
          cell: ({ row }) => receiptIcon(row.original),
        }),
        columnHelper.accessor('tax_relevant', {
          header: 'Steuer',
          size: 90,
          cell: (info) =>
            info.getValue() ? (
              <Check size={16} className="text-emerald-600" />
            ) : (
              <X size={16} className="text-text-muted" />
            ),
        }),
        columnHelper.display({
          id: 'actions',
          header: '',
          size: 54,
          cell: ({ row }) => (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(event) => event.stopPropagation()}
                    aria-label="Ausgaben-Aktionen"
                  />
                }
              >
                <MoreHorizontal size={16} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  onClick={(event) => {
                    event.stopPropagation();
                    onEditExpense(row.original);
                  }}
                >
                  <Edit size={14} />
                  Bearbeiten
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={(event) => {
                    event.stopPropagation();
                    setDeleteTarget(row.original);
                  }}
                >
                  <Trash2 size={14} />
                  Löschen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ),
          enableSorting: false,
        }),
      ] as ColumnDef<Expense, unknown>[],
    [onEditExpense, productNamesById],
  );

  const table = useReactTable({
    data: expenses,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: (updater) => {
      const next = typeof updater === 'function' ? updater(rowSelection) : updater;
      onRowSelectionChange(next);
    },
    getRowId: (row) => row.id,
    enableRowSelection: true,
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

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;

    try {
      await softDeleteExpense(deleteTarget.id);
      toast.success('Ausgabe gelöscht');
      setDeleteTarget(null);
      onDataChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ausgabe konnte nicht gelöscht werden');
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-border-subtle bg-bg-elevated text-sm text-text-muted dark:border-transparent">
        Ausgaben werden geladen...
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-border-subtle bg-bg-elevated text-text-muted dark:border-transparent">
        <p className="text-sm">Keine Ausgaben gefunden</p>
        <p className="text-xs">Passe deine Filter an oder erfasse eine neue Ausgabe.</p>
      </div>
    );
  }

  return (
    <>
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
                const isSelected = row.getIsSelected();

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
                    onClick={() => onEditExpense(row.original)}
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

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ausgabe löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Ausgabe wird in den Papierkorb verschoben und kann später wiederhergestellt
              werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirmed}
              className="bg-danger text-white hover:bg-danger/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
