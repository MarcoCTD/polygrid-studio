import { useMemo, useRef, useState } from 'react';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatEUR } from '@/features/products/utils';
import { softDeleteWebsiteService, updateWebsiteService } from '../services';
import { WEBSITE_SERVICE_INTERVAL_LABELS, type WebsiteServiceListItem } from '../schemas';
import { ServiceTypeIcon } from './WebsiteBadges';

const GRID_COLUMNS = 'grid-cols-[130px_1.4fr_1fr_100px_100px_100px_110px_110px_70px_44px]';

interface ServicesTabProps {
  services: WebsiteServiceListItem[];
  isLoading: boolean;
  onOpenService: (service: WebsiteServiceListItem) => void;
  onChanged: () => void;
}

export function ServicesTab({ services, isLoading, onOpenService, onChanged }: ServicesTabProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [serviceToDelete, setServiceToDelete] = useState<WebsiteServiceListItem | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function toggleActive(service: WebsiteServiceListItem, active: boolean) {
    try {
      await updateWebsiteService(service.id, { active });
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Posten konnte nicht geändert werden');
    }
  }

  const columns = useMemo<ColumnDef<WebsiteServiceListItem>[]>(
    () => [
      {
        accessorKey: 'type',
        header: 'Typ',
        cell: ({ row }) => <ServiceTypeIcon type={row.original.type} />,
      },
      {
        accessorKey: 'label',
        header: 'Label',
        cell: ({ row }) => (
          <div className="truncate font-medium text-text-primary">{row.original.label}</div>
        ),
      },
      {
        accessorKey: 'client_name',
        header: 'Kunde',
        cell: ({ row }) => <div className="truncate">{row.original.client_name}</div>,
      },
      {
        accessorKey: 'cost_out',
        header: () => <div className="text-right">Kosten</div>,
        cell: ({ row }) => (
          <div className="w-full text-right tabular-nums">
            {row.original.cost_out !== null ? formatEUR(row.original.cost_out) : '-'}
          </div>
        ),
      },
      {
        accessorKey: 'price_in',
        header: () => <div className="text-right">Einnahme</div>,
        cell: ({ row }) => (
          <div className="w-full text-right tabular-nums">
            {row.original.price_in !== null ? formatEUR(row.original.price_in) : '-'}
          </div>
        ),
      },
      {
        accessorKey: 'interval',
        header: 'Intervall',
        cell: ({ row }) => WEBSITE_SERVICE_INTERVAL_LABELS[row.original.interval],
      },
      {
        accessorKey: 'next_due',
        header: 'Fällig',
        cell: ({ row }) => row.original.next_due,
      },
      {
        accessorKey: 'expires_at',
        header: 'Ablauf',
        cell: ({ row }) => row.original.expires_at ?? '-',
      },
      {
        accessorKey: 'active',
        header: 'Aktiv',
        enableSorting: false,
        cell: ({ row }) => (
          <Checkbox
            checked={row.original.active}
            aria-label={`${row.original.label} aktiv`}
            onCheckedChange={(checked) => void toggleActive(row.original, checked === true)}
          />
        ),
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
              <DropdownMenuItem onClick={() => onOpenService(row.original)}>
                Öffnen
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setServiceToDelete(row.original)}
              >
                <Trash2 className="size-4" />
                Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    // toggleActive ist stabil genug (nutzt nur onChanged aus den Props)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onOpenService, onChanged],
  );

  // TanStack Table exposes callback-heavy APIs that trigger the React Compiler lint rule.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: services,
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
    estimateSize: () => 52,
    overscan: 10,
  });

  async function handleDelete() {
    if (!serviceToDelete) return;
    try {
      await softDeleteWebsiteService(serviceToDelete.id);
      toast.success('Posten gelöscht');
      setServiceToDelete(null);
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Posten konnte nicht gelöscht werden');
    }
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-text-secondary">Posten werden geladen...</div>;
  }

  if (services.length === 0) {
    return (
      <div className="flex min-h-72 items-center justify-center p-8 text-center">
        <div>
          <p className="font-medium text-text-primary">Noch keine laufenden Posten.</p>
          <p className="mt-1 text-sm text-text-secondary">
            Lege den ersten Posten über „Neuer Posten“ an – z.B. Hosting oder eine Domain.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden" data-testid="services-table">
        <div className="grid border-b border-border-subtle bg-bg-secondary text-xs font-medium uppercase tracking-wide text-text-tertiary">
          {table.getHeaderGroups().map((headerGroup) => (
            <div key={headerGroup.id} className={`grid ${GRID_COLUMNS}`}>
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

        <div ref={scrollRef} className="h-[calc(100vh-330px)] overflow-auto">
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              return (
                <div
                  key={row.id}
                  className={`absolute left-0 grid w-full ${GRID_COLUMNS} border-b border-border-subtle text-sm hover:bg-bg-hover`}
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                  onClick={() => onOpenService(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <div
                      key={cell.id}
                      className="flex min-h-13 items-center px-3"
                      onClick={(event) => {
                        if (cell.column.id === 'actions' || cell.column.id === 'active') {
                          event.stopPropagation();
                        }
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
        open={serviceToDelete !== null}
        onOpenChange={(open) => !open && setServiceToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Posten wirklich löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{serviceToDelete?.label}“ wird per Soft-Delete ausgeblendet. Es werden keine weiteren
              Ausgaben oder Aufträge mehr erzeugt.
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
