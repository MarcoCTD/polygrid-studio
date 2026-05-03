import { useEffect, useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { formatEUR } from '@/features/products/utils';
import { cn } from '@/lib/utils';
import { loadFinanceBookings, type FinanceBooking } from '../services';

type BookingKindFilter = 'all' | 'income' | 'expense';

function currentYearRange(): { dateFrom: string; dateTo: string } {
  const year = new Date().getFullYear();
  return { dateFrom: `${year}-01-01`, dateTo: `${year}-12-31` };
}

export function BeleguebersichtPanel() {
  const defaultRange = currentYearRange();
  const [dateFrom, setDateFrom] = useState(defaultRange.dateFrom);
  const [dateTo, setDateTo] = useState(defaultRange.dateTo);
  const [kind, setKind] = useState<BookingKindFilter>('all');
  const [missingReceiptOnly, setMissingReceiptOnly] = useState(false);
  const [missingMatchOnly, setMissingMatchOnly] = useState(false);
  const [bookings, setBookings] = useState<FinanceBooking[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: true }]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void loadFinanceBookings(dateFrom, dateTo)
      .then((items) => {
        if (!cancelled) setBookings(items);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dateFrom, dateTo]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      if (kind === 'income' && booking.type !== 'Einnahme') return false;
      if (kind === 'expense' && booking.type !== 'Ausgabe') return false;
      if (missingReceiptOnly && booking.receiptAttached) return false;
      if (missingMatchOnly && booking.bankMatchId) return false;
      return true;
    });
  }, [bookings, kind, missingMatchOnly, missingReceiptOnly]);

  const columns = useMemo<ColumnDef<FinanceBooking>[]>(
    () => [
      {
        accessorKey: 'date',
        header: 'Datum',
        cell: ({ row }) => row.original.date,
      },
      {
        accessorKey: 'receiptNumber',
        header: 'Beleg-Nr.',
      },
      {
        accessorKey: 'type',
        header: 'Art',
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={cn(
              row.original.type === 'Einnahme'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                : 'border-amber-300 bg-amber-50 text-amber-800',
            )}
          >
            {row.original.type}
          </Badge>
        ),
      },
      {
        accessorKey: 'bookingText',
        header: 'Buchungstext',
        cell: ({ row }) => <span className="line-clamp-1">{row.original.bookingText}</span>,
      },
      {
        accessorKey: 'amount',
        header: () => <div className="text-right">Betrag</div>,
        cell: ({ row }) => (
          <div
            className={cn(
              'text-right tabular-nums',
              row.original.amount >= 0 ? 'text-emerald-700' : 'text-red-700',
            )}
          >
            {formatEUR(row.original.amount)}
          </div>
        ),
      },
      {
        accessorKey: 'receiptAttached',
        header: 'Beleg',
        cell: ({ row }) =>
          row.original.receiptAttached ? (
            <CheckCircle2 className="size-4 text-emerald-600" />
          ) : (
            <AlertCircle className="size-4 text-amber-600" />
          ),
      },
      {
        accessorKey: 'bankMatchId',
        header: 'Bank-Match',
        cell: ({ row }) =>
          row.original.bankMatchId ? (
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <CheckCircle2 className="size-4" />
              {row.original.bankMatchConfidence ?? 'match'}
            </span>
          ) : (
            <AlertCircle className="size-4 text-amber-600" />
          ),
      },
    ],
    [],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredBookings,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border-subtle bg-bg-elevated p-3">
        <Input
          type="date"
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
          className="w-40"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(event) => setDateTo(event.target.value)}
          className="w-40"
        />
        <Button
          variant={kind === 'all' ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setKind('all')}
        >
          Alle
        </Button>
        <Button
          variant={kind === 'income' ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setKind('income')}
        >
          Einnahmen
        </Button>
        <Button
          variant={kind === 'expense' ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setKind('expense')}
        >
          Ausgaben
        </Button>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={missingReceiptOnly} onCheckedChange={setMissingReceiptOnly} />
          Beleg fehlt
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={missingMatchOnly} onCheckedChange={setMissingMatchOnly} />
          Match fehlt
        </label>
      </div>

      <div className="overflow-hidden rounded-lg border border-border-subtle bg-bg-elevated">
        <table className="w-full text-sm">
          <thead className="bg-bg-secondary text-left text-xs uppercase tracking-wide text-text-tertiary">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-3 py-2">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-text-muted">
                  Belege werden geladen...
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-text-muted">
                  Keine Belege im Zeitraum.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-t border-border-subtle">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
