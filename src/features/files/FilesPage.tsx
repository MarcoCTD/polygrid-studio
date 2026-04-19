import { FolderOpen } from 'lucide-react';
import { PlaceholderPage } from '@/components/shared';

export function FilesPage() {
  return (
    <PlaceholderPage
      title="Dateien"
      description="OneDrive-Integration mit Ordnerstruktur und Dateiverknüpfungen. Wird in Modul 03 implementiert."
      icon={FolderOpen}
    />
  );
}
