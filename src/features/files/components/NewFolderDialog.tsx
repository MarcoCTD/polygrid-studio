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
import { validateFileName } from '../utils';

interface NewFolderDialogProps {
  open: boolean;
  parentPath: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (name: string) => Promise<void>;
}

export function NewFolderDialog({
  open,
  parentPath,
  onOpenChange,
  onConfirm,
}: NewFolderDialogProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setName('');
      setError(null);
    });
  }, [open, parentPath]);

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
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-bg-elevated text-text-primary">
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Neuer Ordner</DialogTitle>
            <DialogDescription className="text-text-secondary">
              Der Ordner wird im aktuell ausgewählten Verzeichnis erstellt.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ordnername"
              autoFocus
            />
            {error ? <p className="text-sm text-danger">{error}</p> : null}
          </div>

          <DialogFooter className="bg-bg-elevated">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Erstellt...' : 'Bestätigen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
