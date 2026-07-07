import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FlaskConical, MinusCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
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
import { Label } from '@/components/ui/label';
import { getDatabase } from '@/services/database';
import type { ActionResult, Playbook } from '../schemas';
import { runPlaybookDryRun } from '../services/playbookEngine';
import { ACTION_TYPE_LABELS } from './shared';

interface OrderOption {
  id: string;
  receipt_number: string | null;
  external_order_id: string | null;
  customer_name: string | null;
  platform: string | null;
}

function orderLabel(order: OrderOption): string {
  const number = order.external_order_id?.trim() || order.receipt_number || order.id;
  const extra = [order.customer_name, order.platform].filter(Boolean).join(' · ');
  return extra ? `${number} (${extra})` : number;
}

function ResultIcon({ status }: { status: ActionResult['status'] }) {
  if (status === 'success') return <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />;
  if (status === 'skipped') return <MinusCircle className="size-4 shrink-0 text-amber-600" />;
  return <XCircle className="size-4 shrink-0 text-red-600" />;
}

interface DryRunDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playbook: Playbook | null;
  onFinished: () => void;
}

export function DryRunDialog({ open, onOpenChange, playbook, onFinished }: DryRunDialogProps) {
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [query, setQuery] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [results, setResults] = useState<ActionResult[] | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setQuery('');
      setSelectedOrderId(null);
      setResults(null);
    }
    onOpenChange(nextOpen);
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getDatabase()
      .select<OrderOption[]>(
        `SELECT id, receipt_number, external_order_id, customer_name, platform
         FROM orders
         WHERE deleted_at IS NULL
         ORDER BY order_date DESC
         LIMIT 200`,
      )
      .then((rows) => {
        if (!cancelled) setOrders(rows);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : 'Aufträge konnten nicht geladen werden',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const filteredOrders = useMemo(() => {
    const term = query.trim().toLowerCase();
    const list = term
      ? orders.filter((order) => orderLabel(order).toLowerCase().includes(term))
      : orders;
    return list.slice(0, 15);
  }, [orders, query]);

  const selectedOrder = orders.find((order) => order.id === selectedOrderId) ?? null;

  async function handleRun() {
    if (!playbook || !selectedOrderId) return;
    setIsRunning(true);
    try {
      const summary = await runPlaybookDryRun(playbook, selectedOrderId);
      setResults(summary.results);
      onFinished();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Dry-Run fehlgeschlagen');
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="size-5" />
            Dry-Run: {playbook?.name ?? ''}
          </DialogTitle>
          <DialogDescription>
            Testet das Playbook gegen einen Auftrag. Es wird nichts erstellt – die Vorschau
            zeigt, was passieren würde. Der Lauf wird im Log als Dry-Run vermerkt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="dry-run-order-search">Auftrag wählen</Label>
            <Input
              id="dry-run-order-search"
              placeholder="Auftrag suchen (Nummer, Kunde, Plattform)"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedOrderId(null);
                setResults(null);
              }}
            />
            {selectedOrder ? (
              <p className="text-sm text-text-secondary">
                Ausgewählt: <span className="font-medium text-text-primary">{orderLabel(selectedOrder)}</span>
              </p>
            ) : (
              <ul className="max-h-48 divide-y divide-border-subtle overflow-y-auto rounded-lg border border-border">
                {filteredOrders.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-text-muted">Keine Treffer</li>
                ) : (
                  filteredOrders.map((order) => (
                    <li key={order.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-hover"
                        onClick={() => {
                          setSelectedOrderId(order.id);
                          setResults(null);
                        }}
                      >
                        {orderLabel(order)}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>

          {results ? (
            <div className="space-y-2 rounded-lg border border-border bg-bg-secondary p-3" data-testid="dry-run-results">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Ergebnis-Vorschau
              </p>
              <ul className="space-y-2">
                {results.map((result, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <ResultIcon status={result.status} />
                    <div>
                      <p className="text-text-primary">
                        {result.preview ?? ACTION_TYPE_LABELS[result.action_type]}
                      </p>
                      {result.message ? (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-amber-700">
                          <AlertTriangle className="size-3" />
                          {result.message}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Schließen
          </Button>
          <Button
            type="button"
            disabled={!selectedOrderId || isRunning}
            onClick={() => void handleRun()}
          >
            {isRunning ? 'Läuft…' : 'Dry-Run ausführen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
