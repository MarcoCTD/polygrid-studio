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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { softDeleteClient } from '../services';
import type { ClientListItem } from '../schemas';

const GRID_COLUMNS = 'grid-cols-[1.4fr_1.4fr_110px_110px_44px]';

interface ClientsTabProps {
  clients: ClientListItem[];
  isLoading: boolean;
  onOpenClient: (client: ClientListItem) => void;
  onChanged: () => void;
}

export function ClientsTab({ clients, isLoading, onOpenClient, onChanged }: ClientsTabProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [clientToDelete, setClientToDelete] = useState<ClientListItem | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const columns = useMemo<ColumnDef<ClientListItem>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <div className="truncate font-medium text-text-primary">{row.original.name}</div>
        ),
      },
      {
        id: 'contact',
        header: 'Kontakt',
        cell: ({ row }) => {
          const parts = [
            row.original.contact_person,
            row.original.email,
            row.original.phone,
          ].filter(Boolean);
          return <div className="truncate text-text-secondary">{parts.join(' · ') || '-'}</div>;
        },
      },
      {
        accessorKey: 'project_count',
        header: () => <div className="text-right">Projekte</div>,
        cell: ({ row }) => (
          <div className="w-full text-right tabular-nums">{row.original.project_count}</div>
        ),
      },
      {
        accessorKey: 'service_count',
        header: () => <div className="text-right">Posten</div>,
        cell: ({ row }) => (
          <div className="w-full text-right tabular-nums">{row.original.service_count}</div>
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
              <DropdownMenuItem onClick={() => onOpenClient(row.original)}>Öffnen</DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setClientToDelete(row.original)}
              >
                <Trash2 className="size-4" />
                Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [onOpenClient],
  );

  // TanStack Table exposes callback-heavy APIs that trigger the React Compiler lint rule.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: clients,
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
    if (!clientToDelete) return;
    try {
      await softDeleteClient(clientToDelete.id);
      toast.success('Kunde gelöscht');
      setClientToDelete(null);
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Kunde konnte nicht gelöscht werden');
    }
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-text-secondary">Kunden werden geladen...</div>;
  }

  if (clients.length === 0) {
    return (
      <div className="flex min-h-72 items-center justify-center p-8 text-center">
        <div>
          <p className="font-medium text-text-primary">Noch keine Kunden.</p>
          <p className="mt-1 text-sm text-text-secondary">
            Lege den ersten Kunden über „Neuer Kunde“ an.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden" data-testid="clients-table">
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
                  onClick={() => onOpenClient(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <div
                      key={cell.id}
                      className="flex min-h-13 items-center px-3"
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
        open={clientToDelete !== null}
        onOpenChange={(open) => !open && setClientToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kunde wirklich löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{clientToDelete?.name}“ wird per Soft-Delete ausgeblendet. Kunden mit aktiven
              Projekten oder Posten können nicht gelöscht werden.
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
