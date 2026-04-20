import { useState } from 'react';
import { Copy, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { statusEnum, type Status } from '../schema';
import { STATUS_LABELS } from '../labels';
import { bulkDeleteProducts, bulkUpdateStatus, bulkDuplicateProducts } from '../db';

interface BulkToolbarProps {
  selectedCount: number;
  selectedIds: string[];
  onClearSelection: () => void;
  onActionComplete: () => void;
}

export function BulkToolbar({
  selectedCount,
  selectedIds,
  onClearSelection,
  onActionComplete,
}: BulkToolbarProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  if (selectedCount === 0) return null;

  async function handleStatusChange(status: string | null) {
    if (!status) return;
    setIsBusy(true);
    try {
      await bulkUpdateStatus(selectedIds, status as Status);
      onClearSelection();
      onActionComplete();
    } catch (err) {
      console.error('Bulk status update failed:', err);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDuplicate() {
    setIsBusy(true);
    try {
      await bulkDuplicateProducts(selectedIds);
      onClearSelection();
      onActionComplete();
    } catch (err) {
      console.error('Bulk duplicate failed:', err);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDelete() {
    setIsBusy(true);
    try {
      await bulkDeleteProducts(selectedIds);
      onClearSelection();
      onActionComplete();
    } catch (err) {
      console.error('Bulk delete failed:', err);
    } finally {
      setIsBusy(false);
      setShowDeleteConfirm(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 rounded-lg border border-pg-accent/30 bg-accent-subtle px-4 py-2">
        <span className="text-sm font-medium text-text-primary">{selectedCount} ausgewählt</span>

        <div className="h-4 w-px bg-border-subtle" />

        {/* Status ändern */}
        <Select onValueChange={handleStatusChange} disabled={isBusy}>
          <SelectTrigger className="h-7 w-auto gap-1.5 border-none bg-transparent px-2 text-sm">
            <SelectValue placeholder="Status ändern" />
          </SelectTrigger>
          <SelectContent>
            {statusEnum.options.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Duplizieren */}
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={handleDuplicate}
          disabled={isBusy}
        >
          <Copy size={14} />
          Duplizieren
        </Button>

        {/* Löschen */}
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-accent-danger hover:text-accent-danger"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={isBusy}
        >
          <Trash2 size={14} />
          Löschen
        </Button>

        <div className="ml-auto">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={onClearSelection}>
            <X size={14} />
            Auswahl aufheben
          </Button>
        </div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedCount} {selectedCount === 1 ? 'Produkt' : 'Produkte'} löschen?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedCount === 1
                ? 'Das Produkt wird in den Papierkorb verschoben.'
                : `Die ${selectedCount} Produkte werden in den Papierkorb verschoben.`}{' '}
              Du kannst sie innerhalb von 30 Tagen wiederherstellen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-accent-danger text-white hover:bg-accent-danger/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
