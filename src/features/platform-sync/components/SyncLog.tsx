import { useEffect, useMemo, useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getRecentSyncJobs } from '../services/sync-jobs-service';
import type { SyncJob } from '../db/sync-jobs-schema';
import { formatDuration, formatPayload } from '../utils/format';

const columnHelper = createColumnHelper<SyncJob>();

const STATUS_CLASSES: Record<SyncJob['status'], string> = {
  pending: 'border-zinc-200 bg-zinc-100 text-zinc-600',
  running: 'border-sky-200 bg-sky-100 text-sky-700',
  retrying: 'border-amber-200 bg-amber-100 text-amber-700',
  success: 'border-emerald-200 bg-emerald-100 text-emerald-700',
  error: 'border-red-200 bg-red-100 text-red-700',
};

export function SyncLog() {
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getRecentSyncJobs(50)
      .then((data) => {
        if (!cancelled) setJobs(data);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const columns = useMemo(
    () =>
      [
        columnHelper.display({
          id: 'expand',
          header: '',
          cell: ({ row }) => (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() =>
                setExpandedId((current) => (current === row.original.id ? null : row.original.id))
              }
            >
              {expandedId === row.original.id ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
            </Button>
          ),
        }),
        columnHelper.accessor('started_at', {
          header: 'Zeitpunkt',
          cell: (info) => new Date(info.getValue()).toLocaleString('de-DE'),
        }),
        columnHelper.accessor('platform', {
          header: 'Plattform',
          cell: (info) => <Badge variant="outline">{info.getValue()}</Badge>,
        }),
        columnHelper.accessor('operation', {
          header: 'Operation',
          cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
        }),
        columnHelper.accessor('status', {
          header: 'Status',
          cell: (info) => (
            <Badge variant="outline" className={STATUS_CLASSES[info.getValue()]}>
              {info.getValue()}
            </Badge>
          ),
        }),
        columnHelper.accessor('listing_id', {
          header: 'Listing/Auftrag',
          cell: ({ row }) => (
            <span className="font-mono text-xs text-text-secondary">
              {row.original.listing_id ?? row.original.order_id ?? '-'}
            </span>
          ),
        }),
        columnHelper.display({
          id: 'duration',
          header: 'Dauer',
          cell: ({ row }) => formatDuration(row.original.started_at, row.original.completed_at),
        }),
      ] as ColumnDef<SyncJob, unknown>[],
    [expandedId],
  );

  // TanStack Table follows the documented local-instance pattern.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: jobs,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border-subtle bg-bg-elevated dark:border-transparent">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="sticky top-0 bg-bg-secondary text-xs text-text-secondary">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="px-3 py-2 text-left font-medium">
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
                Sync-Log wird geladen...
              </td>
            </tr>
          ) : table.getRowModel().rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-text-muted">
                Noch keine Sync-Jobs vorhanden.
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <>
                <tr key={row.id} className="border-t border-border-subtle hover:bg-bg-hover">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
                {expandedId === row.original.id && (
                  <tr key={`${row.id}-details`} className="border-t border-border-subtle">
                    <td colSpan={columns.length} className="space-y-2 bg-bg-secondary px-4 py-3">
                      <Payload label="Request" value={row.original.request_payload} />
                      <Payload label="Response" value={row.original.response_payload} />
                      {row.original.error_message && (
                        <Payload label="Fehler" value={row.original.error_message} />
                      )}
                    </td>
                  </tr>
                )}
              </>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function Payload({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-text-secondary">{label}</p>
      <pre className="overflow-auto rounded-md bg-bg-elevated p-2 text-xs text-text-secondary">
        {formatPayload(value)}
      </pre>
    </div>
  );
}
