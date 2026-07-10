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
import { ExternalLink, MoreHorizontal, Trash2 } from 'lucide-react';
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
import { formatEUR } from '@/features/products/utils';
import { softDeleteWebsiteProject } from '../services';
import type { WebsiteProjectListItem } from '../schemas';
import { ProjectStatusBadge } from './WebsiteBadges';

const GRID_COLUMNS = 'grid-cols-[1fr_1.4fr_120px_110px_120px_1fr_44px]';

interface ProjectsTabProps {
  projects: WebsiteProjectListItem[];
  isLoading: boolean;
  onOpenProject: (project: WebsiteProjectListItem) => void;
  onChanged: () => void;
}

export function ProjectsTab({ projects, isLoading, onOpenProject, onChanged }: ProjectsTabProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [projectToDelete, setProjectToDelete] = useState<WebsiteProjectListItem | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const columns = useMemo<ColumnDef<WebsiteProjectListItem>[]>(
    () => [
      {
        accessorKey: 'client_name',
        header: 'Kunde',
        cell: ({ row }) => <div className="truncate">{row.original.client_name}</div>,
      },
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <div className="truncate font-medium text-text-primary">{row.original.name}</div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <ProjectStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'price',
        header: () => <div className="text-right">Preis</div>,
        cell: ({ row }) => (
          <div className="w-full text-right tabular-nums">
            {row.original.price !== null ? formatEUR(row.original.price) : '-'}
          </div>
        ),
      },
      {
        accessorKey: 'deadline',
        header: 'Deadline',
        cell: ({ row }) => row.original.deadline ?? '-',
      },
      {
        accessorKey: 'url',
        header: 'URL',
        cell: ({ row }) =>
          row.original.url ? (
            <span className="inline-flex max-w-full items-center gap-1 truncate text-text-secondary">
              <ExternalLink className="size-3.5 shrink-0" />
              <span className="truncate">{row.original.url}</span>
            </span>
          ) : (
            '-'
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
              <DropdownMenuItem onClick={() => onOpenProject(row.original)}>
                Öffnen
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setProjectToDelete(row.original)}
              >
                <Trash2 className="size-4" />
                Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [onOpenProject],
  );

  // TanStack Table exposes callback-heavy APIs that trigger the React Compiler lint rule.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: projects,
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
    if (!projectToDelete) return;
    try {
      await softDeleteWebsiteProject(projectToDelete.id);
      toast.success('Projekt gelöscht');
      setProjectToDelete(null);
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Projekt konnte nicht gelöscht werden');
    }
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-text-secondary">Projekte werden geladen...</div>;
  }

  if (projects.length === 0) {
    return (
      <div className="flex min-h-72 items-center justify-center p-8 text-center">
        <div>
          <p className="font-medium text-text-primary">Noch keine Website-Projekte.</p>
          <p className="mt-1 text-sm text-text-secondary">
            Lege das erste Projekt über „Neues Projekt“ an.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden" data-testid="projects-table">
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
                  onClick={() => onOpenProject(row.original)}
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
        open={projectToDelete !== null}
        onOpenChange={(open) => !open && setProjectToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Projekt wirklich löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{projectToDelete?.name}“ wird per Soft-Delete ausgeblendet.
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
