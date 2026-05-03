import { useCallback, useEffect, useMemo, useState } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { AlertTriangle, FileUp, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatEUR } from '@/features/products/utils';
import { updateOrder } from '@/features/orders/services';
import {
  autoMapBankColumns,
  confirmMatch,
  confirmPayoutMatch,
  getBankTransactions,
  getImportBatches,
  getMatchSuggestions,
  getPayoutAllocations,
  hasRequiredBankMapping,
  ignoreTransaction,
  importBankCsv,
  isN26Csv,
  parseBankCsv,
  rejectMatch,
  runAutoMatching,
  type AutoMatchingResult,
  type BankColumnMapping,
  type BankField,
  type BankImportBatch,
  type BankImportResult,
  type BankTransaction,
  type BankTransactionFilter,
  type ConfirmMatchResult,
  type MatchSuggestion,
  type PayoutAllocation,
} from '../services';
import { StatusUpdateSuggestionDialog } from './StatusUpdateSuggestionDialog';

const FIELD_LABELS: Record<BankField, string> = {
  transaction_date: 'Buchungsdatum',
  value_date: 'Wertstellung',
  counterparty_name: 'Gegenpartei',
  counterparty_iban: 'IBAN',
  transaction_type: 'Typ',
  description: 'Verwendungszweck',
  account_name: 'Kontoname',
  amount: 'Betrag',
  ignore: 'Ignorieren',
};

const FIELD_OPTIONS: BankField[] = [
  'ignore',
  'transaction_date',
  'value_date',
  'counterparty_name',
  'counterparty_iban',
  'transaction_type',
  'description',
  'account_name',
  'amount',
];

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('de-DE').format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

function confidenceBadge(confidence: string | null) {
  const label = confidence ?? 'unmatched';
  const classes =
    label === 'high' || label === 'manual'
      ? 'border-emerald-300 bg-emerald-100 text-emerald-700'
      : label === 'medium'
        ? 'border-amber-300 bg-amber-100 text-amber-800'
        : label === 'low'
          ? 'border-orange-300 bg-orange-100 text-orange-700'
          : 'border-slate-300 bg-slate-100 text-slate-600';
  return (
    <Badge variant="outline" className={classes}>
      {label}
    </Badge>
  );
}

export function BanktransaktionenPanel() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedCsv, setParsedCsv] = useState<{ headers: string[]; rows: string[][] }>({
    headers: [],
    rows: [],
  });
  const [mapping, setMapping] = useState<BankColumnMapping>({});
  const [importResult, setImportResult] = useState<BankImportResult | null>(null);
  const [matchingResult, setMatchingResult] = useState<AutoMatchingResult | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [workbenchFilter, setWorkbenchFilter] = useState<BankTransactionFilter>('all');
  const [allFilterBatch, setAllFilterBatch] = useState<string>('all');
  const [allFilterStatus, setAllFilterStatus] = useState<string>('all');
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [workbenchTransactions, setWorkbenchTransactions] = useState<BankTransaction[]>([]);
  const [batches, setBatches] = useState<BankImportBatch[]>([]);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([]);
  const [pendingStatus, setPendingStatus] = useState<ConfirmMatchResult | null>(null);
  const [payoutDialog, setPayoutDialog] = useState<{
    transaction: BankTransaction;
    allocations: PayoutAllocation[];
  } | null>(null);

  const mappingValid = hasRequiredBankMapping(mapping);
  const selectedTransaction =
    workbenchTransactions.find((transaction) => transaction.id === selectedTransactionId) ?? null;
  const previewRows = parsedCsv.rows.slice(0, 5);

  const loadData = useCallback(async () => {
    const [loadedTransactions, loadedWorkbench, loadedBatches] = await Promise.all([
      getBankTransactions({
        batchId: allFilterBatch === 'all' ? null : allFilterBatch,
        matchStatus: allFilterStatus === 'all' ? null : allFilterStatus,
      }),
      getBankTransactions({ filter: workbenchFilter, onlyUnmatched: true }),
      getImportBatches(),
    ]);
    setTransactions(loadedTransactions);
    setWorkbenchTransactions(loadedWorkbench);
    setBatches(loadedBatches);
    setSelectedTransactionId((current) =>
      current && loadedWorkbench.some((transaction) => transaction.id === current)
        ? current
        : (loadedWorkbench[0]?.id ?? null),
    );
  }, [allFilterBatch, allFilterStatus, workbenchFilter]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadData().catch((error) => {
        toast.error(
          error instanceof Error ? error.message : 'Banktransaktionen konnten nicht geladen werden',
        );
      });
    });
  }, [loadData]);

  useEffect(() => {
    if (!selectedTransactionId) {
      queueMicrotask(() => setSuggestions([]));
      return;
    }
    let cancelled = false;
    void getMatchSuggestions(selectedTransactionId)
      .then((items) => {
        if (!cancelled) setSuggestions(items);
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : 'Match-Vorschläge konnten nicht geladen werden',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTransactionId]);

  async function handleSelectFile() {
    setIsReading(true);
    try {
      const selected = await openDialog({
        title: 'N26-CSV auswählen',
        multiple: false,
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      });
      if (!selected || Array.isArray(selected)) return;
      const content = await readTextFile(selected);
      const csv = parseBankCsv(content);
      if (csv.headers.length === 0) throw new Error('Die CSV-Datei enthält keine Spalten');
      setFileName(selected.split('/').pop() ?? 'n26.csv');
      setParsedCsv(csv);
      setMapping(autoMapBankColumns(csv.headers));
      setImportResult(null);
      setMatchingResult(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'CSV konnte nicht gelesen werden');
    } finally {
      setIsReading(false);
    }
  }

  async function handleImport() {
    if (!fileName) return;
    setIsImporting(true);
    try {
      const result = await importBankCsv({ fileName, csv: parsedCsv, mapping });
      setImportResult(result);
      toast.success(`${result.imported} Transaktionen importiert`);
      await loadData();

      setIsMatching(true);
      setMatchingResult(null);
      void runAutoMatching(result.batchId)
        .then(async (matchResult) => {
          setMatchingResult(matchResult);
          toast.success(`${matchResult.matched} Auto-Matches gefunden`);
          await loadData();
        })
        .catch((error) => {
          toast.error(error instanceof Error ? error.message : 'Auto-Matching fehlgeschlagen');
        })
        .finally(() => setIsMatching(false));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bankimport fehlgeschlagen');
    } finally {
      setIsImporting(false);
    }
  }

  async function handleConfirmSuggestion(suggestion: MatchSuggestion) {
    if (!selectedTransaction) return;
    if (suggestion.type === 'payout') {
      const allocations = await getPayoutAllocations(selectedTransaction.id);
      setPayoutDialog({ transaction: selectedTransaction, allocations });
      return;
    }

    try {
      const result = await confirmMatch(selectedTransaction.id, {
        orderId: suggestion.type === 'order' ? suggestion.id : undefined,
        expenseId: suggestion.type === 'expense' ? suggestion.id : undefined,
      });
      if (result.suggestPaidStatus) setPendingStatus(result);
      toast.success('Match bestätigt');
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Match konnte nicht bestätigt werden');
    }
  }

  async function handleRejectSelected() {
    if (!selectedTransaction) return;
    try {
      await rejectMatch(selectedTransaction.id);
      toast.success('Match abgelehnt');
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Match konnte nicht abgelehnt werden');
    }
  }

  async function handleIgnoreSelected() {
    if (!selectedTransaction) return;
    try {
      await ignoreTransaction(selectedTransaction.id);
      toast.success('Transaktion ignoriert');
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Transaktion konnte nicht ignoriert werden');
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border-subtle bg-bg-elevated p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">N26-CSV importieren</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Standard-Header werden automatisch erkannt, Mapping bleibt manuell anpassbar.
            </p>
          </div>
          <Button className="gap-2" onClick={() => void handleSelectFile()} disabled={isReading}>
            {isReading ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
            CSV-Datei auswählen
          </Button>
        </div>

        {fileName && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline">{fileName}</Badge>
              {isN26Csv(parsedCsv.headers) ? (
                <Badge className="bg-emerald-100 text-emerald-700">N26 erkannt</Badge>
              ) : (
                <Badge variant="outline">Custom Mapping</Badge>
              )}
              <span className="text-text-secondary">{parsedCsv.rows.length} Zeilen</span>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              {parsedCsv.headers.map((header) => (
                <div key={header} className="grid grid-cols-[1fr_220px] items-center gap-2">
                  <span className="truncate text-sm text-text-secondary">{header}</span>
                  <Select
                    value={mapping[header] ?? 'ignore'}
                    onValueChange={(value) =>
                      setMapping((current) => ({ ...current, [header]: value as BankField }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_OPTIONS.map((field) => (
                        <SelectItem key={field} value={field}>
                          {FIELD_LABELS[field]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto rounded-lg border border-border-subtle">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-bg-secondary text-left text-xs uppercase text-text-tertiary">
                  <tr>
                    {parsedCsv.headers.map((header) => (
                      <th key={header} className="px-3 py-2 font-medium">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {previewRows.map((row, index) => (
                    <tr key={index}>
                      {row.map((cell, cellIndex) => (
                        <td key={`${index}-${cellIndex}`} className="max-w-48 truncate px-3 py-2">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-text-secondary">
                Pflichtfelder: Buchungsdatum, Betrag, Verwendungszweck.
              </p>
              <Button disabled={!mappingValid || isImporting} onClick={() => void handleImport()}>
                {isImporting ? 'Import läuft...' : 'Import starten'}
              </Button>
            </div>
          </div>
        )}

        {(importResult || isMatching || matchingResult) && (
          <div className="mt-4 rounded-lg border border-border-subtle bg-bg-secondary p-3 text-sm">
            {importResult && (
              <p>
                {importResult.imported} importiert, {importResult.skipped} Duplikate übersprungen,
                {importResult.errors.length} Fehler.
              </p>
            )}
            {isMatching && (
              <p className="mt-1 flex items-center gap-2 text-text-secondary">
                <Loader2 className="size-3.5 animate-spin" />
                Auto-Matching läuft im Hintergrund. Die UI bleibt nutzbar.
              </p>
            )}
            {matchingResult && (
              <p className="mt-1 text-text-secondary">
                {matchingResult.matched} Auto-Matches gefunden, {matchingResult.payouts}{' '}
                Sammelauszahlungen erkannt, {matchingResult.unmatched} ohne Vorschlag.
              </p>
            )}
          </div>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <div className="rounded-lg border border-border-subtle bg-bg-elevated">
          <div className="border-b border-border-subtle p-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-text-primary">Match-Workbench</h2>
              <Select
                value={workbenchFilter}
                onValueChange={(value) => setWorkbenchFilter(value as BankTransactionFilter)}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  <SelectItem value="income">Eingänge</SelectItem>
                  <SelectItem value="expense">Ausgänge</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            {workbenchTransactions.length === 0 ? (
              <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-text-muted">
                <Search className="size-4" />
                Keine offenen Transaktionen
              </div>
            ) : (
              workbenchTransactions.map((transaction) => (
                <button
                  key={transaction.id}
                  type="button"
                  className={`block w-full border-b border-border-subtle px-3 py-3 text-left hover:bg-bg-secondary ${
                    selectedTransactionId === transaction.id ? 'bg-pg-accent-subtle/50' : ''
                  }`}
                  onClick={() => setSelectedTransactionId(transaction.id)}
                >
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-text-primary">
                      {transaction.counterparty_name ?? 'Keine Gegenpartei'}
                    </span>
                    <span
                      className={`font-semibold tabular-nums ${
                        transaction.amount >= 0 ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    >
                      {formatEUR(transaction.amount)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-text-secondary">
                    {formatDate(transaction.transaction_date)} · {transaction.description}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border-subtle bg-bg-elevated p-4">
          {!selectedTransaction ? (
            <div className="flex min-h-48 items-center justify-center text-sm text-text-muted">
              Wähle links eine Transaktion aus.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-text-primary">
                    {selectedTransaction.counterparty_name ?? 'Banktransaktion'}
                  </h3>
                  <p className="mt-1 text-sm text-text-secondary">
                    {formatDate(selectedTransaction.transaction_date)} ·{' '}
                    {formatEUR(selectedTransaction.amount)}
                  </p>
                  <p className="mt-1 text-sm text-text-tertiary">
                    {selectedTransaction.description}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => void handleRejectSelected()}>
                    Ablehnen
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void handleIgnoreSelected()}>
                    Ignorieren
                  </Button>
                </div>
              </div>

              {suggestions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border-subtle p-4 text-sm text-text-muted">
                  Keine Vorschläge gefunden.
                </div>
              ) : (
                <div className="space-y-2">
                  {suggestions.map((suggestion) => (
                    <div
                      key={`${suggestion.type}-${suggestion.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle p-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium text-text-primary">
                            {suggestion.label}
                          </p>
                          {confidenceBadge(suggestion.confidence)}
                        </div>
                        <p className="mt-1 truncate text-sm text-text-secondary">
                          {suggestion.subtitle} · {formatDate(suggestion.date)} ·{' '}
                          {formatEUR(suggestion.amount)}
                        </p>
                      </div>
                      <Button size="sm" onClick={() => void handleConfirmSuggestion(suggestion)}>
                        {suggestion.type === 'payout' ? 'Aufteilen' : 'Verknüpfen'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <AllTransactionsTable
        transactions={transactions}
        batches={batches}
        batchFilter={allFilterBatch}
        statusFilter={allFilterStatus}
        onBatchFilterChange={setAllFilterBatch}
        onStatusFilterChange={setAllFilterStatus}
      />

      <PayoutDialog
        value={payoutDialog}
        onOpenChange={(open) => {
          if (!open) setPayoutDialog(null);
        }}
        onConfirm={async (transactionId, allocations) => {
          const result = await confirmPayoutMatch(transactionId, allocations);
          toast.success(`${result.payoutOrderCount} Aufträge verknüpft`);
          setPayoutDialog(null);
          await loadData();
        }}
      />

      <StatusUpdateSuggestionDialog
        open={pendingStatus !== null}
        receiptNumber={pendingStatus?.receiptNumber ?? null}
        onOpenChange={(open) => {
          if (!open) setPendingStatus(null);
        }}
        onDecline={() => setPendingStatus(null)}
        onConfirm={() => {
          if (!pendingStatus?.orderId) return;
          void updateOrder(pendingStatus.orderId, { status: 'paid' })
            .then(() => {
              toast.success('Auftrag auf bezahlt gesetzt');
              setPendingStatus(null);
            })
            .catch((error) => {
              toast.error(error instanceof Error ? error.message : 'Status konnte nicht gesetzt werden');
            });
        }}
      />
    </div>
  );
}

function AllTransactionsTable({
  transactions,
  batches,
  batchFilter,
  statusFilter,
  onBatchFilterChange,
  onStatusFilterChange,
}: {
  transactions: BankTransaction[];
  batches: BankImportBatch[];
  batchFilter: string;
  statusFilter: string;
  onBatchFilterChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
}) {
  const columns = useMemo<ColumnDef<BankTransaction>[]>(
    () => [
      {
        accessorKey: 'transaction_date',
        header: 'Datum',
        cell: ({ row }) => formatDate(row.original.transaction_date),
      },
      {
        accessorKey: 'amount',
        header: 'Betrag',
        cell: ({ row }) => (
          <span
            className={`font-medium tabular-nums ${
              row.original.amount >= 0 ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {formatEUR(row.original.amount)}
          </span>
        ),
      },
      {
        accessorKey: 'counterparty_name',
        header: 'Gegenpartei',
        cell: ({ row }) => row.original.counterparty_name ?? '-',
      },
      {
        accessorKey: 'description',
        header: 'Verwendungszweck',
        cell: ({ row }) => <span className="line-clamp-2">{row.original.description}</span>,
      },
      {
        accessorKey: 'match_confidence',
        header: 'Match',
        cell: ({ row }) =>
          row.original.ignored ? (
            <Badge variant="outline">ignoriert</Badge>
          ) : (
            confidenceBadge(row.original.match_confidence)
          ),
      },
      {
        accessorKey: 'linked_label',
        header: 'Verknüpfung',
        cell: ({ row }) => row.original.linked_label ?? (row.original.is_payout ? 'Payout' : '-'),
      },
    ],
    [],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: transactions, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <section className="rounded-lg border border-border-subtle bg-bg-elevated">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle p-4">
        <h2 className="font-semibold text-text-primary">Alle Transaktionen</h2>
        <div className="flex gap-2">
          <Select
            value={batchFilter}
            onValueChange={(value) => {
              if (value) onBatchFilterChange(value);
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Import-Batches</SelectItem>
              {batches.map((batch) => (
                <SelectItem key={batch.id} value={batch.id}>
                  {batch.filename ?? batch.imported_at.slice(0, 10)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              if (value) onStatusFilterChange(value);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="unmatched">Unmatched</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-bg-secondary text-left text-xs uppercase text-text-tertiary">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-3 py-2 font-medium">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 align-top">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PayoutDialog({
  value,
  onOpenChange,
  onConfirm,
}: {
  value: { transaction: BankTransaction; allocations: PayoutAllocation[] } | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (
    transactionId: string,
    allocations: { orderId: string; allocatedAmount: number }[],
  ) => Promise<void>;
}) {
  const [allocations, setAllocations] = useState<PayoutAllocation[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setAllocations(value?.allocations ?? []));
  }, [value]);

  const total = allocations.reduce((sum, allocation) => sum + allocation.allocatedAmount, 0);
  const diff = value ? Math.abs(total - Math.abs(value.transaction.amount)) : 0;

  async function handleConfirm() {
    if (!value) return;
    setIsSaving(true);
    try {
      await onConfirm(
        value.transaction.id,
        allocations.map((allocation) => ({
          orderId: allocation.orderId,
          allocatedAmount: allocation.allocatedAmount,
        })),
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Sammelauszahlung konnte nicht bestätigt werden',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={value !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Sammelauszahlung aufteilen</DialogTitle>
          <DialogDescription>
            Allocated Amount ist mit Verkaufspreis minus Plattformgebühr vorausgefüllt.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-border-subtle">
          {allocations.map((allocation, index) => (
            <div
              key={allocation.orderId}
              className="grid grid-cols-[1fr_140px] items-center gap-3 border-b border-border-subtle px-3 py-2"
            >
              <div>
                <p className="font-medium text-text-primary">{allocation.receiptNumber}</p>
                <p className="text-sm text-text-secondary">
                  {allocation.productName ?? 'Kein Produkt'} · {formatDate(allocation.orderDate)}
                </p>
              </div>
              <Input
                type="number"
                step="0.01"
                value={allocation.allocatedAmount}
                onChange={(event) => {
                  const next = [...allocations];
                  next[index] = {
                    ...allocation,
                    allocatedAmount: Number(event.target.value),
                  };
                  setAllocations(next);
                }}
              />
            </div>
          ))}
        </div>

        <div className="space-y-2 rounded-lg border border-border-subtle bg-bg-secondary p-3 text-sm">
          <div className="flex justify-between">
            <span>Transaktionsbetrag</span>
            <span>{value ? formatEUR(Math.abs(value.transaction.amount)) : '-'}</span>
          </div>
          <div className="flex justify-between">
            <span>Summe Zuordnung</span>
            <span>{formatEUR(total)}</span>
          </div>
          {diff > 0.1 && (
            <div className="flex items-start gap-2 text-amber-700">
              <AlertTriangle className="mt-0.5 size-4" />
              Differenz ist größer als 0,10 €. Du kannst trotzdem bestätigen.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button type="button" disabled={isSaving} onClick={() => void handleConfirm()}>
            Bestätigen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
