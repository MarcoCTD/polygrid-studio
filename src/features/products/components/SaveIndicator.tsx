import { Check, Loader2, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { SaveStatus } from '../hooks/useAutoSave';

interface SaveIndicatorProps {
  status: SaveStatus;
  error: string | null;
  onRetry: () => void;
}

export function SaveIndicator({ status, error, onRetry }: SaveIndicatorProps) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {status === 'idle' && (
        <>
          <Check size={14} className="text-text-muted" />
          <span className="text-text-muted">Bereit</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <Check size={14} className="text-text-muted" />
          <span className="text-text-muted">Gespeichert</span>
        </>
      )}
      {status === 'saving' && (
        <>
          <Loader2 size={14} className="animate-spin text-text-secondary" />
          <span className="text-text-secondary">Speichert...</span>
        </>
      )}
      {status === 'validation-error' && (
        <>
          <AlertTriangle size={14} className="text-[var(--accent-warning)]" />
          <span className={cn('text-[var(--accent-warning)]')} title={error ?? undefined}>
            Nicht gespeichert
          </span>
        </>
      )}
      {status === 'error' && (
        <div className="flex items-center gap-1.5">
          <XCircle size={14} className="text-[var(--accent-danger)]" />
          <span className="text-[var(--accent-danger)]" title={error ?? undefined}>
            Fehler beim Speichern
          </span>
          <Button variant="ghost" size="sm" onClick={onRetry} className="h-6 gap-1 px-2 text-xs">
            <RefreshCw size={12} />
            Erneut
          </Button>
        </div>
      )}
    </div>
  );
}
