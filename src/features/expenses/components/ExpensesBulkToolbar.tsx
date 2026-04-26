import { useState } from 'react';
import { Check, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
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
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from '../constants';
import { softDeleteExpense, updateExpense } from '../services';

interface ExpensesBulkToolbarProps {
  selectedIds: string[];
  onClearSelection: () => void;
  onActionComplete: () => void;
}

export function ExpensesBulkToolbar({
  selectedIds,
  onClearSelection,
  onActionComplete,
}: ExpensesBulkToolbarProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const selectedCount = selectedIds.length;

  if (selectedCount === 0) return null;

  async function applyBulkUpdate(update: { category?: ExpenseCategory; tax_relevant?: boolean }) {
    setIsBusy(true);
    try {
      await Promise.all(selectedIds.map((id) => updateExpense(id, update)));
      toast.success('Ausgaben aktualisiert');
      onClearSelection();
      onActionComplete();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Ausgaben konnten nicht aktualisiert werden',
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDelete() {
    setIsBusy(true);
    try {
      await Promise.all(selectedIds.map((id) => softDeleteExpense(id)));
      toast.success('Ausgaben gelöscht');
      onClearSelection();
      onActionComplete();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ausgaben konnten nicht gelöscht werden');
    } finally {
      setIsBusy(false);
      setShowDeleteConfirm(false);
    }
  }

  return (
    <>
      <div className="animate-in slide-in-from-top-2 flex items-center gap-3 rounded-lg border border-pg-accent/30 bg-accent-subtle px-4 py-2">
        <span className="text-sm font-medium text-text-primary">
          {selectedCount} {selectedCount === 1 ? 'Eintrag' : 'Einträge'} ausgewählt
        </span>

        <div className="h-4 w-px bg-border-subtle" />

        <Select
          disabled={isBusy}
          onValueChange={(value) => {
            if (value) void applyBulkUpdate({ category: value as ExpenseCategory });
          }}
        >
          <SelectTrigger className="h-7 w-auto gap-1.5 border-none bg-transparent px-2 text-sm">
            <SelectValue placeholder="Kategorie setzen" />
          </SelectTrigger>
          <SelectContent>
            {EXPENSE_CATEGORIES.map((category) => (
              <SelectItem key={category} value={category}>
                {EXPENSE_CATEGORY_LABELS[category]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          disabled={isBusy}
          onValueChange={(value) => {
            if (value) void applyBulkUpdate({ tax_relevant: value === 'yes' });
          }}
        >
          <SelectTrigger className="h-7 w-auto gap-1.5 border-none bg-transparent px-2 text-sm">
            <SelectValue placeholder="Steuerrelevant" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="yes">
              <Check size={14} />
              Ja
            </SelectItem>
            <SelectItem value="no">
              <X size={14} />
              Nein
            </SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-danger hover:text-danger"
          disabled={isBusy}
          onClick={() => setShowDeleteConfirm(true)}
        >
          <Trash2 size={14} />
          Löschen
        </Button>

        <div className="ml-auto">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            disabled={isBusy}
            onClick={onClearSelection}
          >
            <X size={14} />
            Auswahl aufheben
          </Button>
        </div>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedCount} {selectedCount === 1 ? 'Ausgabe' : 'Ausgaben'} löschen?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Die ausgewählten Ausgaben werden in den Papierkorb verschoben.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-danger text-white">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
