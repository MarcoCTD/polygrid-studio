import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExpenseDetailPanel } from '@/features/expenses/components/ExpenseDetailPanel';
import { NewListingModal } from '@/features/listings/components';
import { NewOrderModal } from '@/features/orders/components';
import { NewProductDialog } from '@/features/products/components/NewProductDialog';
import { useUIStore } from '@/stores';

interface QuickActionsProps {
  onActionComplete?: () => void;
}

export function QuickActions({ onActionComplete }: QuickActionsProps) {
  const navigate = useNavigate();
  const openDetailPanel = useUIStore((state) => state.openDetailPanel);
  const closeDetailPanel = useUIStore((state) => state.closeDetailPanel);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [listingModalOpen, setListingModalOpen] = useState(false);
  const [orderModalOpen, setOrderModalOpen] = useState(false);

  function handleNewExpense() {
    openDetailPanel(
      <ExpenseDetailPanel
        expense="new"
        onSaved={() => {
          onActionComplete?.();
          closeDetailPanel();
        }}
        onDeleted={() => {
          onActionComplete?.();
          closeDetailPanel();
        }}
        onRestored={() => {
          onActionComplete?.();
          closeDetailPanel();
        }}
      />,
    );
  }

  return (
    <section className="flex flex-wrap gap-2" aria-label="Schnellaktionen">
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 text-text-secondary"
        onClick={handleNewExpense}
      >
        <Plus className="size-4" />
        Neue Ausgabe
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 text-text-secondary"
        onClick={() => setProductModalOpen(true)}
      >
        <Plus className="size-4" />
        Neues Produkt
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 text-text-secondary"
        onClick={() => setListingModalOpen(true)}
      >
        <Plus className="size-4" />
        Neues Listing
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 text-text-secondary"
        onClick={() => setOrderModalOpen(true)}
      >
        <Plus className="size-4" />
        Neuer Auftrag
      </Button>

      <NewProductDialog
        open={productModalOpen}
        onOpenChange={setProductModalOpen}
        onCreated={onActionComplete}
      />
      <NewListingModal
        open={listingModalOpen}
        onOpenChange={setListingModalOpen}
        onCreated={(listing) => {
          onActionComplete?.();
          void navigate({ to: '/listings/$listingId', params: { listingId: listing.id } });
        }}
      />
      <NewOrderModal
        open={orderModalOpen}
        onOpenChange={setOrderModalOpen}
        onCreated={() => {
          onActionComplete?.();
          void navigate({ to: '/orders' });
        }}
      />
    </section>
  );
}
