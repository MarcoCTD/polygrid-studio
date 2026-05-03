import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface StatusUpdateSuggestionDialogProps {
  open: boolean;
  receiptNumber: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onDecline: () => void;
}

export function StatusUpdateSuggestionDialog({
  open,
  receiptNumber,
  onOpenChange,
  onConfirm,
  onDecline,
}: StatusUpdateSuggestionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Status aktualisieren?</DialogTitle>
          <DialogDescription>
            Auftrag {receiptNumber ?? ''} ist jetzt als bezahlt verknüpft. Soll der Status auf
            &quot;paid&quot; gesetzt werden?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDecline}>
            Nein, Status behalten
          </Button>
          <Button type="button" onClick={onConfirm}>
            Ja, auf paid setzen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
