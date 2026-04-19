import { ShoppingCart } from 'lucide-react';
import { PlaceholderPage } from '@/components/shared';

export function OrdersPage() {
  return (
    <PlaceholderPage
      title="Aufträge"
      description="Auftragsverwaltung mit Kanban-Board und Status-Workflow. Wird in Modul 08 implementiert."
      icon={ShoppingCart}
    />
  );
}
