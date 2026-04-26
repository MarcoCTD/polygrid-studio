import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Download, Plus, Receipt } from 'lucide-react';
import { PlaceholderPage } from '@/components/shared';
import { useUIStore } from '@/stores';

export function ExpensesPage() {
  const navigate = useNavigate();
  const { registerCommands, unregisterCommands } = useUIStore();

  useEffect(() => {
    const commandIds = ['expenses:new', 'expenses:csv-export'];

    registerCommands([
      {
        id: 'expenses:new',
        label: 'Neue Ausgabe',
        icon: Plus,
        category: 'action',
        action: () => void navigate({ to: '/expenses' }),
      },
      {
        id: 'expenses:csv-export',
        label: 'Ausgaben exportieren',
        icon: Download,
        category: 'action',
        action: () => void navigate({ to: '/expenses' }),
      },
    ]);

    return () => unregisterCommands(commandIds);
  }, [navigate, registerCommands, unregisterCommands]);

  return (
    <PlaceholderPage
      title="Ausgaben"
      description="Geschäftsausgaben mit Kategorisierung und Belegverknüpfung. Wird in Modul 04 implementiert."
      icon={Receipt}
    />
  );
}
