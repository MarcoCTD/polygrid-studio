import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuickActionsProps {
  onNewExpense: () => void;
  onNewProduct: () => void;
  onNewListing: () => void;
  onNewOrder: () => void;
}

export function QuickActions({
  onNewExpense,
  onNewProduct,
  onNewListing,
  onNewOrder,
}: QuickActionsProps) {
  return (
    <section className="flex flex-wrap gap-2" aria-label="Schnellaktionen">
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 text-text-secondary"
        onClick={onNewExpense}
      >
        <Plus className="size-4" />
        Neue Ausgabe
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 text-text-secondary"
        onClick={onNewProduct}
      >
        <Plus className="size-4" />
        Neues Produkt
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 text-text-secondary"
        onClick={onNewListing}
      >
        <Plus className="size-4" />
        Neues Listing
      </Button>
      <Button variant="ghost" size="sm" className="gap-2 text-text-secondary" onClick={onNewOrder}>
        <Plus className="size-4" />
        Neuer Auftrag
      </Button>
    </section>
  );
}
