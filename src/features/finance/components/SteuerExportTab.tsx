import { useCallback, useEffect, useState } from 'react';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { EuerYearReport } from '../services/euerYear';
import {
  exportEuerYear,
  getEuerYearReport,
  getEuerYearsWithData,
  isOneDriveExportAvailable,
  type EuerExportTarget,
} from '../services/euerYearService';
import { KleinunternehmerGrenzeCard } from './KleinunternehmerGrenzeCard';

const TARGET_LABELS: Record<EuerExportTarget, string> = {
  dialog: 'Speichern-Dialog',
  onedrive: 'OneDrive: /01_Finanzen/Exporte/',
};

function formatEUR(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
}

/**
 * Steuer-Export-Tab (Modul 14): Jahresauswahl, Summen-Vorschau mit
 * Warnhinweisen, Excel-Export mit Zielauswahl. Platzierung unter /analytics
 * gemäß docs/decisions/ENTSCHEIDUNGEN_MODUL_14.md (Entscheidung 3).
 */
export function SteuerExportTab() {
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState<number>(() => new Date().getFullYear());
  const [report, setReport] = useState<EuerYearReport | null>(null);
  const [target, setTarget] = useState<EuerExportTarget>('dialog');
  const [oneDriveAvailable, setOneDriveAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      Promise.all([getEuerYearsWithData(), isOneDriveExportAvailable()])
        .then(([loadedYears, available]) => {
          if (cancelled) return;
          setYears(loadedYears);
          setOneDriveAvailable(available);
        })
        .catch((error) => {
          if (!cancelled) {
            toast.error(
              error instanceof Error ? error.message : 'Jahresliste konnte nicht geladen werden',
            );
          }
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, []);

  const loadReport = useCallback(async (selectedYear: number) => {
    setIsLoading(true);
    try {
      setReport(await getEuerYearReport(selectedYear));
    } catch (error) {
      setReport(null);
      toast.error(
        error instanceof Error ? error.message : 'EÜR-Vorschau konnte nicht geladen werden',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (!cancelled) void loadReport(year);
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [loadReport, year]);

  async function handleExport() {
    setIsExporting(true);
    try {
      const outcome = await exportEuerYear(year, target);
      if (outcome.cancelled) {
        toast.info('Export abgebrochen');
        return;
      }
      const path = outcome.path ?? outcome.filename;
      toast.success(`EÜR ${year} exportiert`, {
        description: path,
        action: {
          label: 'Öffnen',
          onClick: () => {
            revealItemInDir(path).catch((error: unknown) => {
              toast.error(
                error instanceof Error ? error.message : 'Datei konnte nicht angezeigt werden',
              );
            });
          },
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'EÜR-Export fehlgeschlagen');
    } finally {
      setIsExporting(false);
    }
  }

  const warnings: string[] = [];
  if (report) {
    if (report.warnings.expensesWithoutReceipt > 0) {
      warnings.push(`${report.warnings.expensesWithoutReceipt} Ausgabe(n) ohne Beleg`);
    }
    if (report.warnings.ordersWithFallbackDate > 0) {
      warnings.push(
        `${report.warnings.ordersWithFallbackDate} Auftrag/Aufträge ohne Zahlungsdatum – Bestelldatum als Fallback verwendet`,
      );
    }
    if (report.warnings.completedNotPaid > 0) {
      warnings.push(
        `${report.warnings.completedNotPaid} abgeschlossene(r) Auftrag/Aufträge ohne Zahlungsstatus „bezahlt“ (Dateninkonsistenz)`,
      );
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border-subtle bg-bg-elevated p-4">
        <div className="grid gap-4 lg:grid-cols-3">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-text-secondary">Jahr</span>
            <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
              <SelectTrigger className="w-full" aria-label="Jahr wählen">
                <SelectValue>{year}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(years.length > 0 ? years : [year]).map((availableYear) => (
                  <SelectItem key={availableYear} value={String(availableYear)}>
                    {availableYear}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-text-secondary">Ziel</span>
            <Select value={target} onValueChange={(value) => setTarget(value as EuerExportTarget)}>
              <SelectTrigger className="w-full" aria-label="Export-Ziel wählen">
                <SelectValue>{TARGET_LABELS[target]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dialog">{TARGET_LABELS.dialog}</SelectItem>
                <SelectItem value="onedrive" disabled={!oneDriveAvailable}>
                  {TARGET_LABELS.onedrive}
                  {oneDriveAvailable ? '' : ' (nicht konfiguriert)'}
                </SelectItem>
              </SelectContent>
            </Select>
          </label>

          <div className="flex items-end">
            <Button
              className="w-full"
              disabled={isExporting || isLoading || !report}
              onClick={() => void handleExport()}
            >
              {isExporting ? 'Exportiere …' : 'Excel exportieren'}
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3" data-testid="euer-vorschau">
        <PreviewTile
          label={`Einnahmen (${report?.incomeLines.length ?? 0} Aufträge)`}
          value={formatEUR(report?.incomeTotal ?? 0)}
          testId="euer-einnahmen"
        />
        <PreviewTile
          label={`Ausgaben (${
            report ? report.expenseGroups.reduce((sum, group) => sum + group.lines.length, 0) : 0
          } steuerrelevant)`}
          value={formatEUR(report?.expenseTotal ?? 0)}
          testId="euer-ausgaben"
        />
        <PreviewTile
          label="Überschuss"
          value={formatEUR(report?.surplus ?? 0)}
          testId="euer-ueberschuss"
        />
      </section>

      {warnings.length > 0 ? (
        <div
          data-testid="euer-warnungen"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          <p className="font-medium">Bitte vor dem Export prüfen:</p>
          <ul className="mt-1 list-disc pl-5">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {report && (report.excludedIncome.length > 0 || report.nonTaxRelevantLines.length > 0) ? (
        <p className="text-sm text-text-secondary" data-testid="euer-nicht-enthalten">
          Nachrichtlich, nicht in den Summen: {report.excludedIncome.length} refundierte/strittige
          Aufträge ({formatEUR(report.excludedIncomeTotal)}), {report.nonTaxRelevantLines.length}{' '}
          nicht steuerrelevante Ausgaben ({formatEUR(report.nonTaxRelevantTotal)}). Beide werden im
          Excel gesondert ausgewiesen.
        </p>
      ) : null}

      <KleinunternehmerGrenzeCard />

      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
        Ersetzt keine steuerliche Beratung. Der Export bereitet die Einnahmen-Überschuss-Rechnung
        (§19 UStG, Bruttobeträge) für die Steuererklärung bzw. den Steuerberater vor – alle Werte
        bitte vor Abgabe prüfen.
      </div>
    </div>
  );
}

function PreviewTile({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-elevated p-4" data-testid={testId}>
      <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">{label}</p>
      <p className="mt-2 text-xl font-semibold text-text-primary">{value}</p>
    </div>
  );
}
