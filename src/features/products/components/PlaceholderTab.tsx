import { FolderOpen, Tag, Sparkles } from 'lucide-react';
import type { ComponentType } from 'react';

interface PlaceholderTabProps {
  type: 'files' | 'listings' | 'ai';
}

const PLACEHOLDER_CONFIG: Record<
  PlaceholderTabProps['type'],
  { icon: ComponentType<{ size?: number; className?: string }>; title: string; lines: string[] }
> = {
  files: {
    icon: FolderOpen,
    title: 'Dateien',
    lines: [
      'Der Dateimanager wird in Modul 03 implementiert.',
      'Hier werden dann STL-Dateien, Slicer-Dateien und Bilder',
      'verwaltet und per Knopfdruck im passenden Programm geöffnet.',
    ],
  },
  listings: {
    icon: Tag,
    title: 'Listings',
    lines: [
      'Die Listing-Verwaltung wird in Modul 05 implementiert.',
      'Hier werden dann Listings für Etsy, eBay und Kleinanzeigen',
      'erstellt und verwaltet.',
    ],
  },
  ai: {
    icon: Sparkles,
    title: 'KI-Assistent',
    lines: [
      'KI-Funktionen werden in Modul 06 implementiert.',
      'Hier werden dann Titel, Beschreibungen und Tags',
      'automatisch generiert.',
    ],
  },
};

export function PlaceholderTab({ type }: PlaceholderTabProps) {
  const config = PLACEHOLDER_CONFIG[type];
  const Icon = config.icon;

  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3 text-text-muted">
      <Icon size={32} />
      <h3 className="text-sm font-medium text-text-secondary">{config.title}</h3>
      <div className="text-center text-xs leading-relaxed">
        {config.lines.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
    </div>
  );
}
