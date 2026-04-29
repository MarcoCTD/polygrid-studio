import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { FileText, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ListingsBulkToolbar, ListingsTable, ListingsToolbar, NewListingModal } from './components';
import { softDeleteListings, updateListingsStatus, type ListingListItem } from './listingsService';
import { useListingsStore, type ListingsFilterState } from './listingsStore';

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
  const [isNewListingOpen, setIsNewListingOpen] = useState(false);
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
  const showFirstEmptyState =
    !isLoading && listings.length === 0 && !hasActiveFilters(activeFilters) && !error;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadListings();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [activeFilters, loadListings]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

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
      await updateListingsStatus(selectedIdList, 'paused');
      toast.success('Listings pausiert');
      await reloadAndClear();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Listings konnten nicht pausiert werden');
    }
  }, [reloadAndClear, selectedIdList]);

  const handleActivate = useCallback(async () => {
    try {
      await updateListingsStatus(selectedIdList, 'online');
      toast.success('Listings aktiviert');
      await reloadAndClear();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Listings konnten nicht aktiviert werden');
    }
  }, [reloadAndClear, selectedIdList]);

  const handleDelete = useCallback(async () => {
    if (!window.confirm('Ausgewählte Listings in den Papierkorb verschieben?')) return;

    try {
      await softDeleteListings(selectedIdList);
      toast.success('Listings gelöscht');
      await reloadAndClear();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Listings konnten nicht gelöscht werden');
    }
  }, [reloadAndClear, selectedIdList]);

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
          selectedCount={selectedIds.size}
          onPause={handlePause}
          onActivate={handleActivate}
          onDelete={handleDelete}
          onClearSelection={clearSelection}
          onPriceChange={() => toast.info('Preisänderung folgt in Sub-Session 5.8')}
        />
      ) : (
        <ListingsToolbar
          filters={activeFilters}
          totalCount={listings.length}
          onSetFilter={setFilter}
          onNewListing={() => setIsNewListingOpen(true)}
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
    </div>
  );
}
