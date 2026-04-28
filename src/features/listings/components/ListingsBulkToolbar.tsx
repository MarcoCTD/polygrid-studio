import { Archive, Pause, Play, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ListingsBulkToolbarProps {
  selectedCount: number;
  onPause: () => void;
  onActivate: () => void;
  onDelete: () => void;
  onClearSelection: () => void;
  onPriceChange: () => void;
}

export function ListingsBulkToolbar({
  selectedCount,
  onPause,
  onActivate,
  onDelete,
  onClearSelection,
  onPriceChange,
}: ListingsBulkToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-bg-secondary px-3 py-2 shadow-sm animate-in slide-in-from-top-2">
      <span className="mr-2 text-sm font-medium text-text-primary">
        {selectedCount} {selectedCount === 1 ? 'Listing' : 'Listings'} ausgewählt
      </span>

      <Button variant="ghost" size="sm" onClick={onPause} className="gap-1.5">
        <Pause size={14} />
        <span>Pausieren</span>
      </Button>
      <Button variant="ghost" size="sm" onClick={onActivate} className="gap-1.5">
        <Play size={14} />
        <span>Aktivieren</span>
      </Button>
      <Button variant="ghost" size="sm" onClick={onPriceChange} className="gap-1.5">
        <Archive size={14} />
        <span>Preis ändern</span>
      </Button>
      <Button variant="destructive" size="sm" onClick={onDelete} className="gap-1.5">
        <Trash2 size={14} />
        <span>Löschen</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={onClearSelection}
        className="ml-auto gap-1.5 text-text-secondary"
      >
        <X size={14} />
        <span>Auswahl aufheben</span>
      </Button>
    </div>
  );
}
