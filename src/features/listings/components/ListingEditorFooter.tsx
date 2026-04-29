import { ArrowLeft, CheckCircle, CircleAlert, Loader2, Rocket, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PLATFORM_LABELS, PLATFORMS } from '../constants';
import type { CompletenessStatus } from '../listingsService';
import type { Platform } from '../schemas';

export type SaveStatus = 'saved' | 'saving' | 'unsaved';

const SAVE_STATUS_LABELS: Record<SaveStatus, string> = {
  saved: 'Gespeichert',
  saving: 'Wird gespeichert...',
  unsaved: 'Ungesicherte Änderungen',
};

const COMPLETENESS_CLASSES: Record<CompletenessStatus, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-400',
  red: 'bg-red-500',
};

interface ListingEditorFooterProps {
  saveStatus: SaveStatus;
  completeness: Record<Platform, CompletenessStatus>;
  onBack: () => void;
  onSave: () => void;
}

export function ListingEditorFooter({
  saveStatus,
  completeness,
  onBack,
  onSave,
}: ListingEditorFooterProps) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-4 border-t border-border-subtle bg-bg-elevated px-6 py-3 dark:border-transparent">
      <div className="flex min-w-48 items-center gap-2 text-sm text-text-secondary">
        {saveStatus === 'saving' ? (
          <Loader2 size={15} className="animate-spin text-pg-accent" />
        ) : saveStatus === 'saved' ? (
          <CheckCircle size={15} className="text-emerald-600" />
        ) : (
          <CircleAlert size={15} className="text-amber-500" />
        )}
        <span>{SAVE_STATUS_LABELS[saveStatus]}</span>
      </div>

      <div className="flex items-center gap-2">
        {PLATFORMS.map((platform) => (
          <span
            key={platform}
            title={`${PLATFORM_LABELS[platform]}: ${completeness[platform]}`}
            className={cn('size-2.5 rounded-full', COMPLETENESS_CLASSES[completeness[platform]])}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft size={14} />
          <span>Zurück zur Liste</span>
        </Button>
        <Button variant="default" size="sm" onClick={onSave} className="gap-1.5">
          <Save size={14} />
          <span>Speichern</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled
          title="Wird in Modul 12 verfügbar"
          className="gap-1.5"
        >
          <Rocket size={14} />
          <span>Push to Platforms</span>
        </Button>
      </div>
    </div>
  );
}
