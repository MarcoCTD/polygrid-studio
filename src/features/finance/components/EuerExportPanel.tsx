import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { generateEuerExport, getEuerExportPreview, type EuerExportPreview } from '../services';

type PeriodMode = 'month' | 'quarter' | 'year' | 'custom';
type ExportFormat = 'csv' | 'xlsx' | 'both';

function currentYear(): number {
  return new Date().getFullYear();
}

function toISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function quarterRange(year: number, quarter: number): { dateFrom: string; dateTo: string } {
  const startMonth = (quarter - 1) * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0);
  return { dateFrom: toISODate(start), dateTo: toISODate(end) };
}

function monthRange(month: string): { dateFrom: string; dateTo: string } {
  const [year, monthNumber] = month.split('-').map(Number);
  return {
    dateFrom: `${year}-${String(monthNumber).padStart(2, '0')}-01`,
    dateTo: toISODate(new Date(year, monthNumber, 0)),
  };
}

function yearRange(year: number): { dateFrom: string; dateTo: string } {
  return { dateFrom: `${year}-01-01`, dateTo: `${year}-12-31` };
}

export function EuerExportPanel() {
  const [periodMode, setPeriodMode] = useState<PeriodMode>('year');
  const [year, setYear] = useState(currentYear());
  const [month, setMonth] = useState(
    `${currentYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
  );
  const [quarter, setQuarter] = useState(1);
  const [customFrom, setCustomFrom] = useState(`${currentYear()}-01-01`);
  const [customTo, setCustomTo] = useState(`${currentYear()}-12-31`);
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [setTaxLock, setSetTaxLock] = useState(true);
  const [preview, setPreview] = useState<EuerExportPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const range = useMemo(() => {
    if (periodMode === 'month') return monthRange(month);
    if (periodMode === 'quarter') return quarterRange(year, quarter);
    if (periodMode === 'custom') return { dateFrom: customFrom, dateTo: customTo };
    return yearRange(year);
  }, [customFrom, customTo, month, periodMode, quarter, year]);

  useEffect(() => {
    queueMicrotask(() => setSetTaxLock(periodMode === 'year'));
  }, [periodMode]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      setIsLoadingPreview(true);
      setPreviewError(null);
    });
    void getEuerExportPreview(range.dateFrom, range.dateTo)
      .then((result) => {
        if (!cancelled) setPreview(result);
      })
      .catch((error) => {
        if (!cancelled) {
          setPreview({
            incomeCount: 0,
            expenseCount: 0,
            incomeTotal: 0,
            expenseTotal: 0,
          });
          setPreviewError(error instanceof Error ? error.message : 'Vorschau konnte nicht geladen werden');
          toast.error(
            error instanceof Error ? error.message : 'Vorschau konnte nicht geladen werden',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPreview(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range.dateFrom, range.dateTo]);

  async function handleExport() {
    setIsExporting(true);
    try {
      const result = await generateEuerExport({
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
        format,
        setTaxLock,
      });
      if (result.cancelled) {
        toast.info('Export abgebrochen');
        return;
      }
      toast.success(
        `${result.exportedFiles.length} Datei${result.exportedFiles.length === 1 ? '' : 'en'} exportiert`,
      );
      if (setTaxLock) {
        toast.info(
          `${result.lockedOrders} Aufträge und ${result.lockedExpenses} Ausgaben gesperrt`,
        );
      }
      const nextPreview = await getEuerExportPreview(range.dateFrom, range.dateTo);
      setPreview(nextPreview);
      setPreviewError(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'EÜR-Export fehlgeschlagen');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border-subtle bg-bg-elevated p-4">
        <div className="grid gap-4 lg:grid-cols-4">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-text-secondary">Zeitraum</span>
            <Select
              value={periodMode}
              onValueChange={(value) => setPeriodMode(value as PeriodMode)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Monat</SelectItem>
                <SelectItem value="quarter">Quartal</SelectItem>
                <SelectItem value="year">Jahr</SelectItem>
                <SelectItem value="custom">Benutzerdefiniert</SelectItem>
              </SelectContent>
            </Select>
          </label>

          {periodMode === 'month' && (
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-text-secondary">Monat</span>
              <Input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
              />
            </label>
          )}

          {(periodMode === 'year' || periodMode === 'quarter') && (
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-text-secondary">Jahr</span>
              <Input
                type="number"
                value={year}
                min="2020"
                max="2100"
                onChange={(event) => setYear(Number(event.target.value))}
              />
            </label>
          )}

          {periodMode === 'quarter' && (
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-text-secondary">Quartal</span>
              <Select value={String(quarter)} onValueChange={(value) => setQuarter(Number(value))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Q1</SelectItem>
                  <SelectItem value="2">Q2</SelectItem>
                  <SelectItem value="3">Q3</SelectItem>
                  <SelectItem value="4">Q4</SelectItem>
                </SelectContent>
              </Select>
            </label>
          )}

          {periodMode === 'custom' && (
            <>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium text-text-secondary">Von</span>
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium text-text-secondary">Bis</span>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(event) => setCustomTo(event.target.value)}
                />
              </label>
            </>
          )}

          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-text-secondary">Format</span>
            <Select value={format} onValueChange={(value) => setFormat(value as ExportFormat)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="xlsx">Excel</SelectItem>
                <SelectItem value="both">Beides</SelectItem>
              </SelectContent>
            </Select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={setTaxLock} onCheckedChange={setSetTaxLock} />
            Nach Export steuerlich sperren
          </label>
          <Button disabled={isExporting || isLoadingPreview} onClick={() => void handleExport()}>
            Export starten
          </Button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <PreviewTile label="Einnahmen" value={preview?.incomeCount ?? 0} />
        <PreviewTile label="Ausgaben" value={preview?.expenseCount ?? 0} />
        <PreviewTile
          label="Summe Einnahmen"
          value={`${(preview?.incomeTotal ?? 0).toFixed(2)} EUR`}
        />
        <PreviewTile
          label="Summe Ausgaben"
          value={`${(preview?.expenseTotal ?? 0).toFixed(2)} EUR`}
        />
      </section>

      {previewError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Vorschau konnte nicht vollständig geladen werden: {previewError}
        </div>
      )}

      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        Diese Auswertung unterstützt die Erfassung deiner Einnahmen und Ausgaben. Sie ersetzt keine
        steuerliche Buchführung. Bitte konsultiere deinen Steuerberater oder prüfe alle Werte vor
        Abgabe sorgfältig.
      </div>
    </div>
  );
}

function PreviewTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-elevated p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">{label}</p>
      <p className="mt-2 text-xl font-semibold text-text-primary">{value}</p>
    </div>
  );
}
