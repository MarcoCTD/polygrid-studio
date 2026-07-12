import { useCallback, useMemo, useRef, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { InlineStatusBadge } from '@/components/shared';
import { formatEUR, formatRelativeDate } from '@/features/products/utils';
import { softDeleteOrder, updateOrder } from '../services';
import {
  ORDER_STATUS_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  type OrderListItem,
  type OrderStatus,
  type PaymentStatus,
} from '../types';
import {
  OrderPlatformIcon,
  OrderStatusBadge,
  PaymentStatusBadge,
  TaxLockedIcon,
} from './OrderBadges';

/**
 * Tax-Lock wie im Detail-Panel: gesperrte Aufträge dürfen nur noch
 * storniert werden, stornierte gar nicht mehr wechseln.
 */
function inlineStatusOptions(order: OrderListItem): { value: OrderStatus; label: string }[] {
  if (!order.tax_locked) return ORDER_STATUS_OPTIONS;
  return ORDER_STATUS_OPTIONS.filter(
    (option) => option.value === order.status || option.value === 'cancelled',
  );
}

interface OrdersTableProps {
  orders: OrderListItem[];
  isLoading: boolean;
  onOpenOrder: (order: OrderListItem) => void;
  onChanged: () => void;
}

export function OrdersTable({ orders, isLoading, onOpenOrder, onChanged }: OrdersTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'order_date', desc: true }]);
  const [orderToDelete, setOrderToDelete] = useState<OrderListItem | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleStatusSelect = useCallback(
    async (order: OrderListItem, status: OrderStatus) => {
      try {
        // Zentraler Service-Pfad: updateOrder feuert die Playbook-Engine.
        await updateOrder(order.id, { status });
        toast.success(
          `Status geändert: ${ORDER_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status}`,
        );
        onChanged();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Status konnte nicht geändert werden',
        );
      }
    },
    [onChanged],
  );

  const handlePaymentSelect = useCallback(
    async (order: OrderListItem, paymentStatus: PaymentStatus) => {
      try {
        // Zentraler Service-Pfad (kein Direktschreiben): updateOrder pflegt
        // payment_received_date passend zum payment_status (Modul 08).
        await updateOrder(order.id, { payment_status: paymentStatus });
        toast.success(
          `Zahlung geändert: ${PAYMENT_STATUS_OPTIONS.find((o) => o.value === paymentStatus)?.label ?? paymentStatus}`,
        );
        onChanged();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Zahlung konnte nicht geändert werden',
        );
      }
    },
    [onChanged],
  );

  const columns = useMemo<ColumnDef<OrderListItem>[]>(
    () => [
      {
        accessorKey: 'receipt_number',
        header: 'Belegnr.',
        cell: ({ row }) => <span className="font-medium">{row.original.receipt_number}</span>,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <InlineStatusBadge
            value={row.original.status}
            options={inlineStatusOptions(row.original)}
            renderBadge={(status) => <OrderStatusBadge status={status} />}
            onSelect={(status) => handleStatusSelect(row.original, status)}
            ariaLabel={`Status von ${row.original.receipt_number} ändern`}
          />
        ),
      },
      {
        accessorKey: 'platform',
        header: 'Plattform',
        cell: ({ row }) => <OrderPlatformIcon platform={row.original.platform} />,
      },
      {
        accessorKey: 'product_name',
        header: 'Produkt',
        cell: ({ row }) => (
          <div className="max-w-56 truncate">
            {row.original.product_name ?? row.original.variant ?? 'Freitextauftrag'}
          </div>
        ),
      },
      {
        accessorKey: 'customer_name',
        header: 'Kunde',
        cell: ({ row }) => row.original.customer_name || '-',
      },
      {
        accessorKey: 'sale_price',
        header: () => <div className="text-right">Verkaufspreis</div>,
        cell: ({ row }) => (
          <div className="text-right tabular-nums">{formatEUR(row.original.sale_price)}</div>
        ),
      },
      {
        accessorKey: 'order_date',
        header: 'Bestelldatum',
        cell: ({ row }) => (
          <span title={row.original.order_date}>{formatRelativeDate(row.original.order_date)}</span>
        ),
      },
      {
        accessorKey: 'payment_status',
        header: 'Zahlung',
        cell: ({ row }) => (
          <InlineStatusBadge
            value={row.original.payment_status}
            options={PAYMENT_STATUS_OPTIONS}
            renderBadge={(status) => <PaymentStatusBadge status={status} />}
            onSelect={(status) => handlePaymentSelect(row.original, status)}
            disabled={row.original.tax_locked || row.original.has_paid_invoice === true}
            disabledTitle={
              row.original.has_paid_invoice
                ? 'Über die verknüpfte Rechnung gesteuert, dort stornieren um zu ändern'
                : 'Steuerlich gesperrt – Zahlung kann nicht geändert werden'
            }
            ariaLabel={`Zahlung von ${row.original.receipt_number} ändern`}
          />
        ),
      },
      {
        accessorKey: 'tax_locked',
        header: 'Lock',
        cell: ({ row }) => <TaxLockedIcon locked={row.original.tax_locked} />,
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onOpenOrder(row.original)}>Öffnen</DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                disabled={row.original.tax_locked}
                title={
                  row.original.tax_locked
                    ? 'Steuerlich gesperrt - kann nicht gelöscht werden'
                    : undefined
                }
                onClick={() => setOrderToDelete(row.original)}
              >
                <Trash2 className="size-4" />
                Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [onOpenOrder, handleStatusSelect, handlePaymentSelect],
  );

  // TanStack Table exposes callback-heavy APIs that trigger the React Compiler lint rule.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: orders,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 56,
    overscan: 10,
  });

  async function handleDelete() {
    if (!orderToDelete) return;
    try {
      await softDeleteOrder(orderToDelete.id);
      toast.success('Auftrag gelöscht');
      setOrderToDelete(null);
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Auftrag konnte nicht gelöscht werden');
    }
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-text-secondary">Aufträge werden geladen...</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="flex min-h-72 items-center justify-center p-8 text-center">
        <div>
          <p className="font-medium text-text-primary">Noch keine Aufträge vorhanden.</p>
          <p className="mt-1 text-sm text-text-secondary">
            Erstelle den ersten Auftrag über den Button oben rechts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden">
        <div className="grid border-b border-border-subtle bg-bg-secondary text-xs font-medium uppercase tracking-wide text-text-tertiary">
          {table.getHeaderGroups().map((headerGroup) => (
            <div
              key={headerGroup.id}
              className="grid grid-cols-[110px_130px_120px_1.6fr_1fr_130px_120px_150px_60px_44px]"
            >
              {headerGroup.headers.map((header) => (
                <button
                  key={header.id}
                  type="button"
                  className="px-3 py-2 text-left disabled:cursor-default"
                  disabled={!header.column.getCanSort()}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div ref={scrollRef} className="h-[calc(100vh-270px)] overflow-auto">
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              return (
                <div
                  key={row.id}
                  className="absolute left-0 grid w-full grid-cols-[110px_130px_120px_1.6fr_1fr_130px_120px_150px_60px_44px] border-b border-border-subtle text-sm hover:bg-bg-hover"
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                  onClick={() => onOpenOrder(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <div
                      key={cell.id}
                      className="flex min-h-14 items-center px-3"
                      onClick={(event) => {
                        if (cell.column.id === 'actions') event.stopPropagation();
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <AlertDialog
        open={orderToDelete !== null}
        onOpenChange={(open) => !open && setOrderToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Auftrag wirklich löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Der Auftrag {orderToDelete?.receipt_number} wird per Soft-Delete ausgeblendet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void handleDelete()}>
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
