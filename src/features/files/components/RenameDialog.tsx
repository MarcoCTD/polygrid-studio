import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { formatUnknownError, getBaseName, validateFileName } from '../utils';

interface RenameDialogProps {
  open: boolean;
  path: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (newName: string) => Promise<void>;
}

export function RenameDialog({ open, path, onOpenChange, onConfirm }: RenameDialogProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open || !path) return;
    queueMicrotask(() => {
      setName(getBaseName(path));
      setError(null);
    });
  }, [open, path]);

  async function handleSubmit(event?: React.FormEvent) {
    event?.preventDefault();
    const validation = validateFileName(name);
    if (validation) {
      setError(validation);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onConfirm(name.trim());
      onOpenChange(false);
    } catch (err) {
      setError(formatUnknownError(err));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-bg-elevated text-text-primary">
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Umbenennen</DialogTitle>
            <DialogDescription className="text-text-secondary">
              Gib einen neuen Namen ein. Schrägstriche sind nicht erlaubt.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Input value={name} onChange={(event) => setName(event.target.value)} autoFocus />
            {error ? <p className="text-sm text-danger">{error}</p> : null}
          </div>

          <DialogFooter className="bg-bg-elevated">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Speichert...' : 'Bestätigen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
