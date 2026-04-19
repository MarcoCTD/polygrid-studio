import { CheckSquare } from 'lucide-react';
import { PlaceholderPage } from '@/components/shared';

export function TasksPage() {
  return (
    <PlaceholderPage
      title="Aufgaben"
      description="Aufgabenverwaltung mit Wochenansicht und Verknüpfungen. Wird in Modul 09 implementiert."
      icon={CheckSquare}
    />
  );
}
