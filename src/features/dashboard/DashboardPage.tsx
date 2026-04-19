import { LayoutDashboard } from 'lucide-react';
import { PlaceholderPage } from '@/components/shared';

export function DashboardPage() {
  return (
    <PlaceholderPage
      title="Dashboard"
      description="Übersicht über KPIs, aktuelle Aufträge und Aktivitäten. Wird in Modul 10 implementiert."
      icon={LayoutDashboard}
    />
  );
}
