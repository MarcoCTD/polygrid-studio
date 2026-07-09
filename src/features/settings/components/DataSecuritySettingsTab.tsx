import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { useNavigate } from '@tanstack/react-router';
import { ExternalLink, Loader2, Trash2, X } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { keychainDelete } from '@/features/ai-assistant/services/aiService';
import { cn } from '@/lib/utils';
import { getDatabase } from '@/services/database';
import {
  DEFAULTS,
  getSettingWithDefault,
  resetAllSettings,
  saveSetting,
} from '@/services/settings';
import { useAutoSave } from '../hooks/useAutoSave';
import { NumberField } from './NumberField';

interface BackupInfo {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

interface DataSecurityState {
  lastBackupAt: string;
  backupIntervalHours: number;
  backupMaxCount: number;
  backupDirectory: string;
  taxStatus: string;
  receiptNumberFormat: string;
  taxLockMonthly: boolean;
  taxLockYearly: boolean;
  bankCsvFormat: 'n26' | 'custom';
  bankMatchingAmountTolerance: number;
  bankMatchingOrderDays: number;
  bankMatchingExpenseDays: number;
  payoutKeywordsEtsy: string[];
  payoutKeywordsEbay: string[];
  archiveRetentionDays: number;
}

const DEFAULT_DATA_STATE: DataSecurityState = {
  lastBackupAt: DEFAULTS.last_backup_at,
  backupIntervalHours: DEFAULTS.backup_interval_hours,
  backupMaxCount: DEFAULTS.backup_max_count,
  backupDirectory: DEFAULTS.backup_directory,
  taxStatus: DEFAULTS.tax_status,
  receiptNumberFormat: DEFAULTS.receipt_number_format,
  taxLockMonthly: DEFAULTS.tax_lock_monthly,
  taxLockYearly: DEFAULTS.tax_lock_yearly,
  bankCsvFormat: DEFAULTS.bank_csv_format,
  bankMatchingAmountTolerance: DEFAULTS.bank_matching_amount_tolerance,
  bankMatchingOrderDays: DEFAULTS.bank_matching_order_days,
  bankMatchingExpenseDays: DEFAULTS.bank_matching_expense_days,
  payoutKeywordsEtsy: [...DEFAULTS.payout_keywords_etsy],
  payoutKeywordsEbay: [...DEFAULTS.payout_keywords_ebay],
  archiveRetentionDays: DEFAULTS.archive_retention_days,
};

const EXPORT_TABLES = [
  'products',
  'expenses',
  'orders',
  'order_items',
  'listings',
  'listing_overrides',
  'file_links',
  'tasks',
  'templates',
  'ai_jobs',
  'bank_transactions',
  'import_batches',
  'bank_payout_orders',
  'kpi_records',
  'app_settings',
] as const;

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-bg-elevated p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-text-primary">{title}</h2>
        {description ? <p className="mt-1 text-sm text-text-secondary">{description}</p> : null}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[220px_1fr] sm:items-start">
      <div className="space-y-1 pt-1">
        <Label className="text-sm font-medium text-text-primary">{label}</Label>
        {hint ? <p className="text-xs leading-5 text-text-secondary">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

function SwitchControl({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className="flex w-fit items-center gap-3 rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary transition-colors hover:bg-bg-hover"
    >
      <span
        className={cn(
          'relative h-5 w-9 rounded-full transition-colors',
          checked ? 'bg-pg-accent' : 'bg-bg-hover',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0.5',
          )}
        />
      </span>
      {label}
    </button>
  );
}

function splitTags(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function mutableTags(value: readonly string[]): string[] {
  return [...value];
}

function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState('');

  function addFromDraft() {
    const nextTags = splitTags(draft).filter((tag) => !value.includes(tag));
    if (nextTags.length === 0) return;
    onChange([...value, ...nextTags]);
    setDraft('');
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addFromDraft();
    }
  }

  return (
    <div className="space-y-2">
      <Input
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={addFromDraft}
        onKeyDown={handleKeyDown}
      />
      <div className="flex min-h-8 flex-wrap gap-2">
        {value.map((tag) => (
          <Badge key={tag} variant="outline" className="gap-1">
            {tag}
            <button
              type="button"
              aria-label={`${tag} entfernen`}
              onClick={() => onChange(value.filter((item) => item !== tag))}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
      </div>
    </div>
  );
}

function dateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateTime(value: string): string {
  if (!value) return 'Noch kein Backup';
  const seconds = Number(value);
  const date =
    Number.isFinite(seconds) && seconds > 1_000_000_000
      ? new Date(seconds * 1000)
      : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  return [
    headers.join(';'),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(';')),
  ].join('\n');
}

async function safeSelect(table: string): Promise<unknown[]> {
  try {
    return await getDatabase().select<unknown[]>(`SELECT * FROM ${table}`);
  } catch {
    return [];
  }
}

export function DataSecuritySettingsTab() {
  const navigate = useNavigate();
  const { scheduleSave } = useAutoSave();
  const [settings, setSettings] = useState<DataSecurityState>(DEFAULT_DATA_STATE);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackupRunning, setIsBackupRunning] = useState(false);
  const [resetWarningOpen, setResetWarningOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetInput, setResetInput] = useState('');

  async function loadBackups() {
    try {
      const [directory, backupRows] = await Promise.all([
        invoke<string>('get_backup_directory'),
        invoke<BackupInfo[]>('list_backups'),
      ]);
      setBackups(backupRows);
      setSettings((current) => ({
        ...current,
        backupDirectory: directory,
        lastBackupAt: current.lastBackupAt || backupRows[0]?.createdAt || '',
      }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Backups konnten nicht geladen werden');
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const [
          lastBackupAt,
          backupIntervalHours,
          backupMaxCount,
          taxStatus,
          receiptNumberFormat,
          legacyReceiptNumberFormat,
          taxLockMonthly,
          legacyTaxLockMonthly,
          taxLockYearly,
          legacyTaxLockYearly,
          bankCsvFormat,
          legacyBankCsvFormat,
          bankMatchingAmountTolerance,
          legacyBankMatchingAmountTolerance,
          bankMatchingOrderDays,
          legacyBankMatchingOrderDays,
          bankMatchingExpenseDays,
          legacyBankMatchingExpenseDays,
          payoutKeywordsEtsy,
          payoutKeywordsEbay,
          archiveRetentionDays,
        ] = await Promise.all([
          getSettingWithDefault('last_backup_at'),
          getSettingWithDefault('backup_interval_hours'),
          getSettingWithDefault('backup_max_count'),
          getSettingWithDefault('tax_status'),
          getSettingWithDefault('receipt_number_format'),
          getSettingWithDefault('receipt_number_prefix_format'),
          getSettingWithDefault('tax_lock_monthly'),
          getSettingWithDefault('tax_lock_default_for_monthly_export'),
          getSettingWithDefault('tax_lock_yearly'),
          getSettingWithDefault('tax_lock_default_for_yearly_export'),
          getSettingWithDefault('bank_csv_format'),
          getSettingWithDefault('bank_csv_format_default'),
          getSettingWithDefault('bank_matching_amount_tolerance'),
          getSettingWithDefault('bank_match_amount_tolerance_eur'),
          getSettingWithDefault('bank_matching_order_days'),
          getSettingWithDefault('bank_match_time_window_days_orders'),
          getSettingWithDefault('bank_matching_expense_days'),
          getSettingWithDefault('bank_match_time_window_days_expenses'),
          getSettingWithDefault('payout_keywords_etsy'),
          getSettingWithDefault('payout_keywords_ebay'),
          getSettingWithDefault('archive_retention_days'),
        ]);

        if (cancelled) return;
        setSettings((current) => ({
          ...current,
          lastBackupAt,
          backupIntervalHours,
          backupMaxCount,
          taxStatus,
          receiptNumberFormat:
            receiptNumberFormat === DEFAULTS.receipt_number_format
              ? legacyReceiptNumberFormat
              : receiptNumberFormat,
          taxLockMonthly:
            taxLockMonthly === DEFAULTS.tax_lock_monthly ? legacyTaxLockMonthly : taxLockMonthly,
          taxLockYearly:
            taxLockYearly === DEFAULTS.tax_lock_yearly ? legacyTaxLockYearly : taxLockYearly,
          bankCsvFormat:
            bankCsvFormat === DEFAULTS.bank_csv_format
              ? (legacyBankCsvFormat as 'n26' | 'custom')
              : bankCsvFormat,
          bankMatchingAmountTolerance:
            bankMatchingAmountTolerance === DEFAULTS.bank_matching_amount_tolerance
              ? legacyBankMatchingAmountTolerance
              : bankMatchingAmountTolerance,
          bankMatchingOrderDays:
            bankMatchingOrderDays === DEFAULTS.bank_matching_order_days
              ? legacyBankMatchingOrderDays
              : bankMatchingOrderDays,
          bankMatchingExpenseDays:
            bankMatchingExpenseDays === DEFAULTS.bank_matching_expense_days
              ? legacyBankMatchingExpenseDays
              : bankMatchingExpenseDays,
          payoutKeywordsEtsy: mutableTags(payoutKeywordsEtsy),
          payoutKeywordsEbay: mutableTags(payoutKeywordsEbay),
          archiveRetentionDays,
        }));
        await loadBackups();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Daten-Sicherheit konnte nicht laden');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  function update<K extends keyof DataSecurityState>(
    key: K,
    value: DataSecurityState[K],
    settingKey: string,
    aliases: string[] = [],
  ) {
    setSettings((current) => ({ ...current, [key]: value }));
    scheduleSave(settingKey, value, { aliases });
  }

  async function createBackup() {
    setIsBackupRunning(true);
    try {
      const path = await invoke<string>('create_backup');
      const now = new Date().toISOString();
      await saveSetting('last_backup_at', now);
      setSettings((current) => ({ ...current, lastBackupAt: now }));
      toast.success(`Backup erstellt: ${path}`);
      await loadBackups();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Backup konnte nicht erstellt werden');
    } finally {
      setIsBackupRunning(false);
    }
  }

  async function deleteBackup(filename: string) {
    if (!window.confirm('Backup wirklich löschen?')) return;
    try {
      await invoke<void>('delete_backup', { filename });
      toast.success('Backup gelöscht');
      await loadBackups();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Backup konnte nicht gelöscht werden');
    }
  }

  async function openBackupDirectory() {
    try {
      await invoke<void>('open_in_explorer', { path: settings.backupDirectory, basePath: null });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Backup-Verzeichnis konnte nicht öffnen',
      );
    }
  }

  async function exportJson() {
    try {
      const path = await save({
        defaultPath: `polygrid_export_${dateKey()}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (!path) return;
      const entries = await Promise.all(
        EXPORT_TABLES.map(async (table) => [table, await safeSelect(table)] as const),
      );
      await writeTextFile(path, JSON.stringify(Object.fromEntries(entries), null, 2));
      toast.success('JSON-Export erstellt');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'JSON-Export fehlgeschlagen');
    }
  }

  async function exportExpensesCsv() {
    try {
      const path = await save({
        defaultPath: `ausgaben_export_${dateKey()}.csv`,
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      });
      if (!path) return;
      const rows = await getDatabase().select<Record<string, unknown>[]>(
        'SELECT * FROM expenses ORDER BY date DESC',
      );
      await writeTextFile(path, `\uFEFF${toCsv(rows)}`);
      toast.success('Ausgaben-CSV exportiert');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'CSV-Export fehlgeschlagen');
    }
  }

  async function exportAiLogJson() {
    try {
      const path = await save({
        defaultPath: `ki_protokoll_${dateKey()}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (!path) return;
      const rows = await getDatabase().select<unknown[]>(
        'SELECT * FROM ai_jobs ORDER BY created_at DESC',
      );
      await writeTextFile(path, JSON.stringify(rows, null, 2));
      toast.success('KI-Protokoll exportiert');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'KI-Protokoll-Export fehlgeschlagen');
    }
  }

  async function resetSettings() {
    try {
      await resetAllSettings();
      await Promise.all([keychainDelete('claude_api_key'), keychainDelete('openai_api_key')]);
      toast.success('Einstellungen zurückgesetzt');
      window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Reset fehlgeschlagen');
    }
  }

  if (isLoading) {
    return <div className="text-sm text-text-secondary">Daten & Sicherheit wird geladen...</div>;
  }

  return (
    <div className="space-y-5">
      <Section title="Backup">
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={isBackupRunning} onClick={() => void createBackup()}>
            {isBackupRunning ? <Loader2 className="size-4 animate-spin" /> : null}
            Jetzt sichern
          </Button>
          <Button type="button" variant="outline" onClick={() => void loadBackups()}>
            Liste aktualisieren
          </Button>
        </div>
        <FieldRow label="Letztes Backup">
          <p className="pt-1 text-sm text-text-secondary">
            {formatDateTime(settings.lastBackupAt || backups[0]?.createdAt || '')}
          </p>
        </FieldRow>
        <FieldRow label="Backup-Intervall">
          <Select
            value={String(settings.backupIntervalHours)}
            items={{ '6': '6h', '12': '12h', '24': '24h', '48': '48h', '168': '7 Tage' }}
            onValueChange={(value) =>
              update('backupIntervalHours', Number(value), 'backup_interval_hours')
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6">6h</SelectItem>
              <SelectItem value="12">12h</SelectItem>
              <SelectItem value="24">24h</SelectItem>
              <SelectItem value="48">48h</SelectItem>
              <SelectItem value="168">7 Tage</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Max. Backups">
          <NumberField
            value={settings.backupMaxCount}
            min={1}
            max={365}
            step={1}
            aria-label="Maximale Anzahl Backups"
            className="max-w-44"
            onValueChange={(value) => update('backupMaxCount', value, 'backup_max_count')}
          />
        </FieldRow>
        <FieldRow label="Backup-Verzeichnis">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input value={settings.backupDirectory} readOnly />
            <Button type="button" variant="outline" onClick={() => void openBackupDirectory()}>
              Im Finder öffnen
            </Button>
          </div>
        </FieldRow>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-bg-secondary text-left text-xs uppercase tracking-wide text-text-secondary">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Datum</th>
                <th className="px-3 py-2 font-medium">Größe</th>
                <th className="w-16 px-3 py-2 text-right font-medium">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {backups.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-text-secondary">
                    Noch keine Backups vorhanden
                  </td>
                </tr>
              ) : (
                backups.map((backup) => (
                  <tr key={backup.filename}>
                    <td className="px-3 py-2 font-mono text-xs">{backup.filename}</td>
                    <td className="px-3 py-2">{formatDateTime(backup.createdAt)}</td>
                    <td className="px-3 py-2">{formatBytes(backup.sizeBytes)}</td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => void deleteBackup(backup.filename)}
                      >
                        <Trash2 className="size-4 text-danger" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Datenexport">
        <div className="grid gap-3 sm:grid-cols-2">
          <Button type="button" variant="outline" onClick={() => void exportJson()}>
            Alle Daten als JSON
          </Button>
          <Button type="button" variant="outline" onClick={() => void exportExpensesCsv()}>
            Ausgaben als CSV
          </Button>
          <Button type="button" variant="outline" onClick={() => void exportAiLogJson()}>
            KI-Protokoll als JSON
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void navigate({ to: '/orders' })}
          >
            <ExternalLink className="size-4" />
            EÜR-Export → Aufträge öffnen
          </Button>
        </div>
      </Section>

      <Section title="Finanzen & Steuer">
        <FieldRow label="Steuerstatus" hint="Kontaktiere deinen Steuerberater vor einer Änderung">
          <Badge variant="outline">
            {settings.taxStatus === 'regelbesteuert'
              ? 'Regelbesteuert'
              : 'Kleinunternehmer §19 UStG'}
          </Badge>
        </FieldRow>
        <FieldRow label="Belegnummern-Format">
          <Input
            value={settings.receiptNumberFormat}
            aria-label="Belegnummern-Format"
            onChange={(event) =>
              update('receiptNumberFormat', event.target.value, 'receipt_number_format', [
                'receipt_number_prefix_format',
              ])
            }
          />
        </FieldRow>
        <FieldRow label="Tax-Lock monatlich">
          <SwitchControl
            checked={settings.taxLockMonthly}
            label={settings.taxLockMonthly ? 'Aktiv' : 'Inaktiv'}
            onCheckedChange={(checked) =>
              update('taxLockMonthly', checked, 'tax_lock_monthly', [
                'tax_lock_default_for_monthly_export',
              ])
            }
          />
        </FieldRow>
        <FieldRow label="Tax-Lock jährlich">
          <SwitchControl
            checked={settings.taxLockYearly}
            label={settings.taxLockYearly ? 'Aktiv' : 'Inaktiv'}
            onCheckedChange={(checked) =>
              update('taxLockYearly', checked, 'tax_lock_yearly', [
                'tax_lock_default_for_yearly_export',
              ])
            }
          />
        </FieldRow>
        <FieldRow label="Bank-CSV-Format">
          <Select
            value={settings.bankCsvFormat}
            items={{ n26: 'N26', custom: 'Custom' }}
            onValueChange={(value) =>
              update('bankCsvFormat', value as 'n26' | 'custom', 'bank_csv_format', [
                'bank_csv_format_default',
              ])
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="n26">N26</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Bank-Matching Betragsdifferenz">
          <NumberField
            value={settings.bankMatchingAmountTolerance}
            min={0}
            max={10}
            step={0.01}
            unit="EUR"
            aria-label="Bank-Matching Betragsdifferenz"
            className="max-w-44"
            inputClassName="pr-12"
            onValueChange={(value) =>
              update('bankMatchingAmountTolerance', value, 'bank_matching_amount_tolerance', [
                'bank_match_amount_tolerance_eur',
              ])
            }
          />
        </FieldRow>
        <FieldRow label="Zeitfenster Aufträge">
          <NumberField
            value={settings.bankMatchingOrderDays}
            min={0}
            max={365}
            step={1}
            unit="Tage"
            aria-label="Zeitfenster Aufträge"
            className="max-w-44"
            inputClassName="pr-14"
            onValueChange={(value) =>
              update('bankMatchingOrderDays', value, 'bank_matching_order_days', [
                'bank_match_time_window_days_orders',
              ])
            }
          />
        </FieldRow>
        <FieldRow label="Zeitfenster Ausgaben">
          <NumberField
            value={settings.bankMatchingExpenseDays}
            min={0}
            max={365}
            step={1}
            unit="Tage"
            aria-label="Zeitfenster Ausgaben"
            className="max-w-44"
            inputClassName="pr-14"
            onValueChange={(value) =>
              update('bankMatchingExpenseDays', value, 'bank_matching_expense_days', [
                'bank_match_time_window_days_expenses',
              ])
            }
          />
        </FieldRow>
        <FieldRow label="Payout-Keywords Etsy">
          <TagInput
            value={settings.payoutKeywordsEtsy}
            placeholder="Keyword eingeben, Enter oder Komma"
            onChange={(next) => update('payoutKeywordsEtsy', next, 'payout_keywords_etsy')}
          />
        </FieldRow>
        <FieldRow label="Payout-Keywords eBay">
          <TagInput
            value={settings.payoutKeywordsEbay}
            placeholder="Keyword eingeben, Enter oder Komma"
            onChange={(next) => update('payoutKeywordsEbay', next, 'payout_keywords_ebay')}
          />
        </FieldRow>
      </Section>

      <Section title="Archiv">
        <FieldRow
          label="Aufbewahrungsdauer"
          hint="Archivierte Dateien werden nach dieser Frist endgültig gelöscht"
        >
          <NumberField
            value={settings.archiveRetentionDays}
            min={1}
            max={365}
            step={1}
            unit="Tage"
            aria-label="Aufbewahrungsdauer"
            className="max-w-44"
            inputClassName="pr-14"
            onValueChange={(value) =>
              update('archiveRetentionDays', value, 'archive_retention_days')
            }
          />
        </FieldRow>
      </Section>

      <Section
        title="Zurücksetzen"
        description="Setzt nur Einstellungen und API-Keys zurück. Geschäftsdaten bleiben erhalten."
      >
        <Button type="button" variant="destructive" onClick={() => setResetWarningOpen(true)}>
          Einstellungen zurücksetzen
        </Button>
      </Section>

      <AlertDialog open={resetWarningOpen} onOpenChange={setResetWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Einstellungen zurücksetzen?</AlertDialogTitle>
            <AlertDialogDescription>
              Alle Einstellungen werden auf die Standardwerte zurückgesetzt. Deine Daten (Produkte,
              Ausgaben, Aufträge etc.) bleiben erhalten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setResetWarningOpen(false);
                setResetConfirmOpen(true);
              }}
            >
              Fortfahren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Letzte Warnung</DialogTitle>
            <DialogDescription>Tippe ZURÜCKSETZEN um zu bestätigen</DialogDescription>
          </DialogHeader>
          <Input value={resetInput} onChange={(event) => setResetInput(event.target.value)} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setResetConfirmOpen(false)}>
              Abbrechen
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={resetInput !== 'ZURÜCKSETZEN'}
              onClick={() => void resetSettings()}
            >
              Bestätigen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
