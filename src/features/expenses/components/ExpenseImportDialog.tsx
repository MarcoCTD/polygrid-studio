import { useCallback, useEffect, useMemo, useState } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { AlertTriangle, Check, FileUp, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { checkDuplicate } from '../services';
import type { CreateExpense } from '../schemas';
import {
  autoMapColumns,
  hasRequiredMapping,
  importExpenses,
  mapRowToExpense,
  parseCSV,
  type ColumnMapping,
  type ExpenseField,
  type ImportResult,
  type ParsedCSV,
} from '../utils';

interface ExpenseImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (result: ImportResult) => void;
}

interface PreviewExpense {
  rowNumber: number;
  expense: CreateExpense | null;
  error: string | null;
}

const FIELD_LABELS: Record<ExpenseField, string> = {
  date: 'Datum',
  amount_gross: 'Betrag Brutto',
  vendor: 'Händler',
  category: 'Kategorie',
  subcategory: 'Unterkategorie',
  purpose: 'Verwendungszweck',
  notes: 'Notizen',
  ignore: 'Ignorieren',
};

const FIELD_OPTIONS: ExpenseField[] = [
  'ignore',
  'date',
  'amount_gross',
  'vendor',
  'category',
  'subcategory',
  'purpose',
  'notes',
];

const STEPS = ['Datei', 'Mapping', 'Vorschau'] as const;

export function ExpenseImportDialog({ open, onOpenChange, onImported }: ExpenseImportDialogProps) {
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedCsv, setParsedCsv] = useState<ParsedCSV>({ headers: [], rows: [] });
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [duplicateRows, setDuplicateRows] = useState<Set<number>>(new Set());
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const isMappingValid = hasRequiredMapping(mapping);
  const previewExpenses = useMemo(
    () =>
      parsedCsv.rows.map<PreviewExpense>((row, index) => {
        const rowNumber = index + 2;
        try {
          return {
            rowNumber,
            expense: mapRowToExpense(row, mapping, rowNumber),
            error: null,
          };
        } catch (error) {
          return {
            rowNumber,
            expense: null,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }),
    [mapping, parsedCsv.rows],
  );

  const validPreviewExpenses = useMemo(
    () =>
      previewExpenses.filter(
        (item): item is PreviewExpense & { expense: CreateExpense } => item.expense !== null,
      ),
    [previewExpenses],
  );
  const duplicateCount = validPreviewExpenses.filter((item) =>
    duplicateRows.has(item.rowNumber),
  ).length;
  const importableCount = skipDuplicates
    ? validPreviewExpenses.length - duplicateCount
    : validPreviewExpenses.length;

  const resetDialog = useCallback(() => {
    setStep(1);
    setFileName(null);
    setParsedCsv({ headers: [], rows: [] });
    setMapping({});
    setDuplicateRows(new Set());
    setSkipDuplicates(true);
    setIsReadingFile(false);
    setIsCheckingDuplicates(false);
    setIsImporting(false);
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen);
      if (!nextOpen) {
        queueMicrotask(resetDialog);
      }
    },
    [onOpenChange, resetDialog],
  );

  useEffect(() => {
    if (!open || step !== 3 || validPreviewExpenses.length === 0) {
      queueMicrotask(() => setDuplicateRows(new Set()));
      return;
    }

    let cancelled = false;
    queueMicrotask(() => setIsCheckingDuplicates(true));

    Promise.all(
      validPreviewExpenses.map(async (item) => {
        const duplicate = await checkDuplicate(
          item.expense.date,
          item.expense.amount_gross,
          item.expense.vendor,
        );
        return duplicate ? item.rowNumber : null;
      }),
    )
      .then((rows) => {
        if (!cancelled) {
          setDuplicateRows(new Set(rows.filter((row): row is number => row !== null)));
        }
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : 'Duplikatprüfung konnte nicht ausgeführt werden',
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsCheckingDuplicates(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, step, validPreviewExpenses]);

  async function handleSelectFile() {
    setIsReadingFile(true);

    try {
      const selected = await openDialog({
        title: 'CSV-Datei auswählen',
        multiple: false,
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      });

      if (!selected || Array.isArray(selected)) {
        return;
      }

      const content = await readTextFile(selected);
      const parsed = parseCSV(content);

      if (parsed.headers.length === 0) {
        throw new Error('Die CSV-Datei enthält keine erkennbaren Spalten');
      }

      setFileName(extractFileName(selected));
      setParsedCsv(parsed);
      setMapping(autoMapColumns(parsed.headers));
      setStep(1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'CSV-Datei konnte nicht gelesen werden');
    } finally {
      setIsReadingFile(false);
    }
  }

  function handleMappingChange(header: string, field: ExpenseField) {
    setMapping((current) => ({ ...current, [header]: field }));
  }

  async function handleImport() {
    setIsImporting(true);

    try {
      const expensesToImport = validPreviewExpenses.map((item) => item.expense);
      const result = await importExpenses(expensesToImport, { skipDuplicates });

      onImported(result);
      handleOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Ausgaben konnten nicht importiert werden',
      );
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Ausgaben importieren</DialogTitle>
          <DialogDescription>
            CSV-Datei einlesen, Spalten zuordnen und Ausgaben als Import markieren.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          {STEPS.map((label, index) => {
            const stepNumber = index + 1;
            const isActive = step === stepNumber;
            const isDone = step > stepNumber;
            return (
              <div key={label} className="flex min-w-0 flex-1 items-center gap-2">
                <div
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium',
                    isActive && 'border-pg-accent bg-pg-accent text-white',
                    isDone && 'border-emerald-600 bg-emerald-600 text-white',
                    !isActive && !isDone && 'border-border-subtle text-text-muted',
                  )}
                >
                  {isDone ? <Check size={14} /> : stepNumber}
                </div>
                <span
                  className={cn(
                    'truncate text-xs font-medium',
                    isActive ? 'text-text-primary' : 'text-text-secondary',
                  )}
                >
                  {label}
                </span>
                {stepNumber < STEPS.length && <div className="h-px flex-1 bg-border-subtle" />}
              </div>
            );
          })}
        </div>

        <div className="min-h-[420px] overflow-hidden rounded-lg border border-border-subtle">
          {step === 1 && (
            <FileStep
              fileName={fileName}
              parsedCsv={parsedCsv}
              isReadingFile={isReadingFile}
              onSelectFile={handleSelectFile}
            />
          )}

          {step === 2 && (
            <MappingStep
              headers={parsedCsv.headers}
              mapping={mapping}
              onMappingChange={handleMappingChange}
            />
          )}

          {step === 3 && (
            <PreviewStep
              previewExpenses={previewExpenses}
              duplicateRows={duplicateRows}
              duplicateCount={duplicateCount}
              importableCount={importableCount}
              skipDuplicates={skipDuplicates}
              isCheckingDuplicates={isCheckingDuplicates}
              onSkipDuplicatesChange={setSkipDuplicates}
            />
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Abbrechen
          </Button>

          {step > 1 && (
            <Button type="button" variant="ghost" onClick={() => setStep((current) => current - 1)}>
              Zurück
            </Button>
          )}

          {step < 3 ? (
            <Button
              type="button"
              onClick={() => setStep((current) => current + 1)}
              disabled={step === 1 ? parsedCsv.headers.length === 0 : !isMappingValid}
            >
              Weiter
            </Button>
          ) : (
            <Button
              type="button"
              className="gap-1.5"
              onClick={() => void handleImport()}
              disabled={isImporting || isCheckingDuplicates || importableCount === 0}
            >
              {isImporting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Importieren
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FileStep({
  fileName,
  parsedCsv,
  isReadingFile,
  onSelectFile,
}: {
  fileName: string | null;
  parsedCsv: ParsedCSV;
  isReadingFile: boolean;
  onSelectFile: () => void;
}) {
  const previewRows = parsedCsv.rows.slice(0, 3);

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-text-primary">Datei auswählen</p>
          <p className="text-xs text-text-muted">{fileName ?? 'Keine CSV-Datei ausgewählt'}</p>
        </div>
        <Button type="button" className="gap-1.5" onClick={onSelectFile} disabled={isReadingFile}>
          {isReadingFile ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}
          CSV-Datei auswählen
        </Button>
      </div>

      {parsedCsv.headers.length > 0 && (
        <div className="overflow-auto rounded-md border border-border-subtle">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead className="bg-bg-secondary text-text-secondary">
              <tr>
                {parsedCsv.headers.map((header) => (
                  <th key={header} className="px-3 py-2 font-medium">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-t border-border-subtle">
                  {parsedCsv.headers.map((header, columnIndex) => (
                    <td key={`${header}-${columnIndex}`} className="px-3 py-2 text-text-secondary">
                      {row[columnIndex]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MappingStep({
  headers,
  mapping,
  onMappingChange,
}: {
  headers: string[];
  mapping: ColumnMapping;
  onMappingChange: (header: string, field: ExpenseField) => void;
}) {
  return (
    <div className="h-full overflow-auto p-4">
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-text-secondary">
          <tr>
            <th className="pb-2 font-medium">CSV-Spalte</th>
            <th className="pb-2 font-medium">Zuordnung</th>
          </tr>
        </thead>
        <tbody>
          {headers.map((header) => (
            <tr key={header} className="border-t border-border-subtle">
              <td className="py-2 pr-3 text-text-primary">{header}</td>
              <td className="py-2">
                <Select
                  value={mapping[header] ?? 'ignore'}
                  onValueChange={(value) => onMappingChange(header, value as ExpenseField)}
                >
                  <SelectTrigger className="w-56">
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!hasRequiredMapping(mapping) && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle size={14} />
          Datum, Betrag Brutto und Händler müssen zugeordnet sein.
        </div>
      )}
    </div>
  );
}

function PreviewStep({
  previewExpenses,
  duplicateRows,
  duplicateCount,
  importableCount,
  skipDuplicates,
  isCheckingDuplicates,
  onSkipDuplicatesChange,
}: {
  previewExpenses: PreviewExpense[];
  duplicateRows: Set<number>;
  duplicateCount: number;
  importableCount: number;
  skipDuplicates: boolean;
  isCheckingDuplicates: boolean;
  onSkipDuplicatesChange: (checked: boolean) => void;
}) {
  const previewRows = previewExpenses.slice(0, 10);

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <Checkbox
            checked={skipDuplicates}
            onCheckedChange={(checked) => onSkipDuplicatesChange(checked === true)}
          />
          Duplikate überspringen
        </label>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          {isCheckingDuplicates && <Loader2 size={13} className="animate-spin" />}
          {importableCount} Einträge werden importiert, {skipDuplicates ? duplicateCount : 0}{' '}
          Duplikate übersprungen
        </div>
      </div>

      <div className="overflow-auto rounded-md border border-border-subtle">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="bg-bg-secondary text-text-secondary">
            <tr>
              <th className="px-3 py-2 font-medium">Zeile</th>
              <th className="px-3 py-2 font-medium">Datum</th>
              <th className="px-3 py-2 text-right font-medium">Betrag</th>
              <th className="px-3 py-2 font-medium">Händler</th>
              <th className="px-3 py-2 font-medium">Kategorie</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {previewRows.map((item) => {
              const isDuplicate = duplicateRows.has(item.rowNumber);
              return (
                <tr
                  key={item.rowNumber}
                  className={cn(
                    'border-t border-border-subtle',
                    isDuplicate && 'bg-amber-50 dark:bg-amber-950/20',
                    item.error && 'bg-danger-subtle',
                  )}
                >
                  <td className="px-3 py-2 text-text-muted">{item.rowNumber}</td>
                  <td className="px-3 py-2">{item.expense?.date ?? '-'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {item.expense?.amount_gross.toFixed(2) ?? '-'}
                  </td>
                  <td className="px-3 py-2">{item.expense?.vendor ?? '-'}</td>
                  <td className="px-3 py-2">{item.expense?.category ?? '-'}</td>
                  <td className="px-3 py-2">
                    {item.error ? (
                      <Badge variant="destructive">{item.error}</Badge>
                    ) : isDuplicate ? (
                      <Badge className="border-amber-200 bg-amber-100 text-amber-800">
                        Mögliches Duplikat
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Bereit</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function extractFileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}
