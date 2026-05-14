import { useEffect, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { Eye, GitCompareArrows, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PLATFORM_LABELS } from '@/features/listings/constants';
import type { ListingSyncStatus } from '@/features/listings/schemas';
import { formatRelativeDate } from '../utils/format';
import { useSyncStore } from '../stores/sync-store';
import type { Platform } from '../providers/types';
import type { SyncListingItem } from '../services/sync-ui-service';
import { SyncStatusBadge } from './SyncStatusBadge';

const columnHelper = createColumnHelper<SyncListingItem>();

interface SyncOverviewProps {
  onShowDiff: (listing: SyncListingItem) => void;
  onShowConflict: (listing: SyncListingItem) => void;
  onOpenBatchPush: () => void;
  onOpenOrderPull: (platform?: Platform) => void;
}

export function SyncOverview({
  onShowDiff,
  onShowConflict,
  onOpenBatchPush,
  onOpenOrderPull,
}: SyncOverviewProps) {
  const navigate = useNavigate();
  const {
    listings,
    filters,
    isLoading,
    error,
    loadListings,
    setFilter,
  } = useSyncStore();

  useEffect(() => {
    void loadListings();
  }, [filters, loadListings]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const columns = useMemo(
    () =>
      [
        columnHelper.accessor('master_title', {
          header: 'Listing',
          cell: (info) => (
            <button
              className="max-w-full truncate text-left font-medium text-pg-accent hover:underline"
              onClick={() =>
                void navigate({
                  to: '/listings/$listingId',
                  params: { listingId: info.row.original.id },
                })
              }
            >
              {info.getValue()}
            </button>
          ),
        }),
        columnHelper.accessor('product_name', {
          header: 'Produkt',
          cell: (info) => (
            <span className="text-text-secondary">{info.getValue() ?? 'Unbekannt'}</span>
          ),
        }),
        columnHelper.accessor('syncPlatform', {
          header: 'Plattform',
          cell: (info) => <Badge variant="outline">{PLATFORM_LABELS[info.getValue()]}</Badge>,
        }),
        columnHelper.accessor('sync_status', {
          header: 'Sync-Status',
          cell: (info) => <SyncStatusBadge status={info.getValue()} />,
        }),
        columnHelper.accessor('last_synced_at', {
          header: 'Letzte Synchronisierung',
          cell: (info) => (
            <span className="text-text-secondary">{formatRelativeDate(info.getValue())}</span>
          ),
        }),
        columnHelper.display({
          id: 'actions',
          header: 'Aktionen',
          cell: ({ row }) => {
            const listing = row.original;
            return (
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Diff anzeigen"
                  onClick={() => onShowDiff(listing)}
                >
                  <GitCompareArrows size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Details öffnen"
                  onClick={() =>
                    void navigate({
                      to: '/listings/$listingId',
                      params: { listingId: listing.id },
                    })
                  }
                >
                  <Eye size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Push vorbereiten"
                  disabled={listing.status === 'draft'}
                  onClick={() =>
                    listing.sync_status === 'conflict'
                      ? onShowConflict(listing)
                      : onShowDiff(listing)
                  }
                >
                  <Send size={14} />
                </Button>
              </div>
            );
          },
        }),
      ] as ColumnDef<SyncListingItem, unknown>[],
    [navigate, onShowConflict, onShowDiff],
  );

  // TanStack Table follows the documented local-instance pattern.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: listings,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect
            value={filters.platform ?? 'all'}
            onChange={(value) => setFilter('platform', value as Platform | 'all')}
            options={[
              ['all', 'Alle Plattformen'],
              ['etsy', 'Etsy'],
              ['ebay', 'eBay'],
            ]}
          />
          <NativeSelect
            value={filters.status ?? 'all'}
            onChange={(value) => setFilter('status', value as ListingSyncStatus | 'all')}
            options={[
              ['all', 'Alle Status'],
              ['not_synced', 'Nicht synchronisiert'],
              ['pending', 'Ausstehend'],
              ['synced', 'Synchronisiert'],
              ['error', 'Fehler'],
              ['conflict', 'Konflikte'],
            ]}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenOrderPull()}>
            Bestellungen importieren
          </Button>
          <Button onClick={onOpenBatchPush}>Alle Änderungen pushen</Button>
        </div>
      </div>

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
                  Sync-Listings werden geladen...
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-text-muted">
                  Keine Sync-Listings gefunden.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-t border-border-subtle hover:bg-bg-hover">
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

function NativeSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 rounded-lg border border-input bg-bg-elevated px-3 text-sm text-text-primary"
    >
      {options.map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>
          {label}
        </option>
      ))}
    </select>
  );
}
