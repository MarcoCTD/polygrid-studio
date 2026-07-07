import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { CopyPlus, FileText, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/stores';
import {
  DuplicateListingModal,
  ListingsBulkToolbar,
  ListingsTable,
  ListingsToolbar,
  NewListingModal,
} from './components';
import {
  bulkSoftDelete,
  bulkUpdatePrice,
  bulkUpdateStatus,
  type ListingListItem,
} from './listingsService';
import { useListingsStore, type ListingsFilterState } from './listingsStore';
import { parseCompletenessList, parseListingStatusList, type ListingsSearch } from './searchParams';

function hasActiveFilters(filters: ListingsFilterState) {
  return (
    filters.search.trim() !== '' ||
    filters.status.length > 0 ||
    filters.platform_status.length > 0 ||
    filters.inventory_mode.length > 0 ||
    filters.completeness.length > 0 ||
    filters.language.length > 0 ||
    filters.showDeleted
  );
}

export function ListingsPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as ListingsSearch;
  const { registerCommands, unregisterCommands } = useUIStore();
  const [isNewListingOpen, setIsNewListingOpen] = useState(false);
  const [isDuplicateListingOpen, setIsDuplicateListingOpen] = useState(false);
  const {
    listings,
    isLoading,
    error,
    activeFilters,
    selectedIds,
    loadListings,
    setFilter,
    toggleSelected,
    selectAll,
    clearSelection,
  } = useListingsStore();

  const selectedIdList = Array.from(selectedIds);
  const selectedListings = listings.filter((listing) => selectedIds.has(listing.id));
  const showFirstEmptyState =
    !isLoading && listings.length === 0 && !hasActiveFilters(activeFilters) && !error;

  // Filter aus der URL übernehmen (z.B. Smart Action "Vollständigkeit rot")
  useEffect(() => {
    const completeness = parseCompletenessList(search.completeness);
    if (completeness.length > 0) {
      setFilter('completeness', completeness);
    }
    const statuses = parseListingStatusList(search.status);
    if (statuses.length > 0) {
      setFilter('status', statuses);
    }
  }, [search.completeness, search.status, setFilter]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadListings();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [activeFilters, loadListings]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  useEffect(() => {
    const commandIds = ['listings:new', 'listings:open-list', 'listings:duplicate'];

    registerCommands([
      {
        id: 'listings:new',
        label: 'Neues Listing',
        icon: Plus,
        category: 'action',
        action: () => setIsNewListingOpen(true),
      },
      {
        id: 'listings:open-list',
        label: 'Listing-Liste öffnen',
        icon: FileText,
        category: 'navigation',
        action: () => void navigate({ to: '/listings' }),
      },
      {
        id: 'listings:duplicate',
        label: 'Listing duplizieren',
        icon: CopyPlus,
        category: 'action',
        action: () => setIsDuplicateListingOpen(true),
      },
    ]);

    return () => unregisterCommands(commandIds);
  }, [navigate, registerCommands, unregisterCommands]);

  const reloadAndClear = useCallback(async () => {
    clearSelection();
    await loadListings();
  }, [clearSelection, loadListings]);

  const handleOpenListing = useCallback(
    (listing: ListingListItem) => {
      void navigate({ to: '/listings/$listingId', params: { listingId: listing.id } });
    },
    [navigate],
  );

  const handlePause = useCallback(async () => {
    try {
      await bulkUpdateStatus(selectedIdList, 'paused');
      toast.success(`${selectedIdList.length} Listings pausiert`);
      await reloadAndClear();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Listings konnten nicht pausiert werden');
    }
  }, [reloadAndClear, selectedIdList]);

  const handleActivate = useCallback(async () => {
    try {
      await bulkUpdateStatus(selectedIdList, 'ready');
      toast.success(`${selectedIdList.length} Listings aktiviert`);
      await reloadAndClear();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Listings konnten nicht aktiviert werden');
    }
  }, [reloadAndClear, selectedIdList]);

  const handleDelete = useCallback(async () => {
    if (!window.confirm(`${selectedIdList.length} Listings löschen?`)) return;

    try {
      await bulkSoftDelete(selectedIdList);
      toast.success(`${selectedIdList.length} Listings gelöscht`);
      await reloadAndClear();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Listings konnten nicht gelöscht werden');
    }
  }, [reloadAndClear, selectedIdList]);

  const handlePriceChange = useCallback(
    async (changePercent: number) => {
      try {
        await bulkUpdatePrice(selectedIdList, changePercent);
        toast.success(`${selectedIdList.length} Listing-Preise aktualisiert`);
        await reloadAndClear();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Listing-Preise konnten nicht geändert werden',
        );
      }
    },
    [reloadAndClear, selectedIdList],
  );

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Listings</h1>
          <p className="text-sm text-text-secondary">
            Master-Listings, Plattformstatus und Verkaufsbereitschaft verwalten
          </p>
        </div>
        <FileText size={24} className="text-text-muted" />
      </div>

      {selectedIds.size > 0 ? (
        <ListingsBulkToolbar
          selectedListings={selectedListings}
          onPause={handlePause}
          onActivate={handleActivate}
          onDelete={handleDelete}
          onClearSelection={clearSelection}
          onPriceChange={handlePriceChange}
        />
      ) : (
        <ListingsToolbar
          filters={activeFilters}
          totalCount={listings.length}
          onSetFilter={setFilter}
          onNewListing={() => setIsNewListingOpen(true)}
          onDuplicateListing={() => setIsDuplicateListingOpen(true)}
        />
      )}

      {showFirstEmptyState ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-border-subtle bg-bg-elevated text-center dark:border-transparent">
          <div className="flex size-12 items-center justify-center rounded-full bg-bg-secondary text-text-muted">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">Noch keine Listings.</p>
            <p className="text-sm text-text-secondary">
              Erstelle dein erstes Listing für ein Produkt.
            </p>
          </div>
          <Button onClick={() => setIsNewListingOpen(true)} className="gap-1.5">
            <Plus size={14} />
            <span>Neues Listing</span>
          </Button>
        </div>
      ) : (
        <ListingsTable
          listings={listings}
          isLoading={isLoading}
          selectedIds={selectedIds}
          onToggleSelected={toggleSelected}
          onSelectAll={selectAll}
          onClearSelection={clearSelection}
          onOpenListing={handleOpenListing}
        />
      )}

      <NewListingModal
        open={isNewListingOpen}
        onOpenChange={setIsNewListingOpen}
        onCreated={(listing) => {
          void loadListings();
          void navigate({ to: '/listings/$listingId', params: { listingId: listing.id } });
        }}
      />
      <DuplicateListingModal
        open={isDuplicateListingOpen}
        onOpenChange={setIsDuplicateListingOpen}
        onCreated={(listing) => {
          void loadListings();
          void navigate({ to: '/listings/$listingId', params: { listingId: listing.id } });
        }}
      />
    </div>
  );
}
