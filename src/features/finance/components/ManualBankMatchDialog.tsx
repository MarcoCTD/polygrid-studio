import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Search } from 'lucide-react';
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
import { formatEUR } from '@/features/products/utils';
import {
  confirmMatch,
  searchUnmatchedTransactions,
  type BankTransaction,
  type ConfirmMatchResult,
} from '../services';

interface ManualBankMatchDialogProps {
  open: boolean;
  orderId: string;
  onOpenChange: (open: boolean) => void;
  onMatched: (result: ConfirmMatchResult) => void;
}

export function ManualBankMatchDialog({
  open,
  orderId,
  onOpenChange,
  onMatched,
}: ManualBankMatchDialogProps) {
  const [description, setDescription] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [amount, setAmount] = useState('');
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    queueMicrotask(() => setIsLoading(true));
    const timeout = window.setTimeout(() => {
      void searchUnmatchedTransactions({
        description,
        counterparty,
        amount: amount.trim() ? Number(amount) : null,
      })
        .then((items) => {
          if (!cancelled) {
            setTransactions(items);
            setSelectedId((current) =>
              current && items.some((item) => item.id === current) ? current : null,
            );
          }
        })
        .catch((error) => {
          if (!cancelled) {
            toast.error(
              error instanceof Error
                ? error.message
                : 'Banktransaktionen konnten nicht geladen werden',
            );
          }
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [amount, counterparty, description, open]);

  async function handleConfirm() {
    if (!selectedId) return;
    setIsSaving(true);
    try {
      const result = await confirmMatch(selectedId, { orderId });
      onMatched(result);
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Banktransaktion konnte nicht verknüpft werden',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Banktransaktion manuell verknüpfen</DialogTitle>
          <DialogDescription>
            Suche getrennt nach Verwendungszweck, Gegenpartei und Betrag.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3">
          <Input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Verwendungszweck"
          />
          <Input
            value={counterparty}
            onChange={(event) => setCounterparty(event.target.value)}
            placeholder="Gegenpartei"
          />
          <Input
            type="number"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="Betrag"
          />
        </div>

        <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-border-subtle">
          {transactions.length === 0 ? (
            <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-text-muted">
              <Search className="size-4" />
              {isLoading ? 'Suche läuft...' : 'Keine ungematchten Transaktionen gefunden'}
            </div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {transactions.map((transaction) => (
                <button
                  key={transaction.id}
                  type="button"
                  className={`grid w-full grid-cols-[110px_100px_1fr] gap-3 px-3 py-2 text-left text-sm hover:bg-bg-secondary ${
                    selectedId === transaction.id ? 'bg-pg-accent-subtle/60' : ''
                  }`}
                  onClick={() => setSelectedId(transaction.id)}
                >
                  <span className="text-text-secondary">{transaction.transaction_date}</span>
                  <span className="text-right font-medium tabular-nums">
                    {formatEUR(transaction.amount)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-text-primary">
                      {transaction.counterparty_name ?? 'Keine Gegenpartei'}
                    </span>
                    <span className="block truncate text-xs text-text-tertiary">
                      {transaction.description}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            type="button"
            disabled={!selectedId || isSaving}
            onClick={() => void handleConfirm()}
          >
            Verknüpfen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
