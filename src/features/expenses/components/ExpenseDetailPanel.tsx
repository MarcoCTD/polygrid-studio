import { useEffect, useState } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { openPath } from '@tauri-apps/plugin-opener';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, type UseFormReturn } from 'react-hook-form';
import { FileImage, FileText, FileWarning, Paperclip, RotateCcw, Save, Trash2 } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useUIStore } from '@/stores';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_SUBCATEGORIES,
  EXPENSE_SUBCATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  type ExpenseSubcategory,
  type PaymentMethod,
} from '../constants';
import {
  calculateNextRecurringDate,
  createExpense,
  restoreExpense,
  softDeleteExpense,
  updateExpense,
} from '../services';
import {
  createExpenseSchema,
  updateExpenseSchema,
  type CreateExpense,
  type Expense,
  type ExpenseUpdateWithId,
  type RecurringInterval,
  type UpdateExpense,
} from '../schemas';
import { todayISODate } from '../utils';
import { ProductCombobox } from './ProductCombobox';

type DetailMode = Expense | 'new';

interface ExpenseDetailPanelProps {
  expense: DetailMode;
  onSaved: (expense: Expense) => void;
  onDeleted: () => void;
  onRestored: () => void;
}

function createDefaultValues(expense: DetailMode): ExpenseUpdateWithId {
  if (expense === 'new') {
    return {
      id: crypto.randomUUID(),
      date: todayISODate(),
      amount_gross: 0,
      amount_net: null,
      tax_amount: null,
      vendor: '',
      category: 'sonstiges',
      subcategory: null,
      payment_method: null,
      purpose: null,
      product_id: null,
      order_id: null,
      receipt_attached: false,
      receipt_file_path: null,
      tax_relevant: true,
      recurring: false,
      recurring_interval: null,
      recurring_next_date: null,
      import_source: 'manual',
      import_ref: null,
      notes: null,
    };
  }

  return {
    id: expense.id,
    date: expense.date,
    amount_gross: expense.amount_gross,
    amount_net: expense.amount_net,
    tax_amount: expense.tax_amount,
    vendor: expense.vendor,
    category: expense.category,
    subcategory: expense.subcategory,
    payment_method: expense.payment_method,
    purpose: expense.purpose,
    product_id: expense.product_id,
    order_id: expense.order_id,
    receipt_attached: expense.receipt_attached,
    receipt_file_path: expense.receipt_file_path,
    tax_relevant: expense.tax_relevant,
    recurring: expense.recurring,
    recurring_interval: expense.recurring_interval,
    recurring_next_date: expense.recurring_next_date,
    import_source: expense.import_source,
    import_ref: expense.import_ref,
    notes: expense.notes,
  };
}

export function ExpenseDetailPanel({
  expense,
  onSaved,
  onDeleted,
  onRestored,
}: ExpenseDetailPanelProps) {
  const closeDetailPanel = useUIStore((state) => state.closeDetailPanel);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isNew = expense === 'new';

  const form = useForm<ExpenseUpdateWithId>({
    resolver: zodResolver(updateExpenseSchema),
    defaultValues: createDefaultValues(expense),
  });

  useEffect(() => {
    const values = createDefaultValues(expense);
    queueMicrotask(() => form.reset(values));
  }, [expense, form]);

  async function handleSave(values: ExpenseUpdateWithId) {
    setIsSaving(true);
    try {
      const recurringValues = normalizeRecurringValues(values);

      if (isNew) {
        const createInput: CreateExpense = createExpenseSchema.parse({
          date: values.date,
          amount_gross: values.amount_gross,
          amount_net: values.amount_net,
          tax_amount: values.tax_amount,
          vendor: values.vendor,
          category: values.category,
          subcategory: values.subcategory,
          payment_method: values.payment_method,
          purpose: values.purpose,
          product_id: values.product_id,
          order_id: values.order_id,
          receipt_attached: values.receipt_attached,
          receipt_file_path: values.receipt_file_path,
          tax_relevant: values.tax_relevant,
          recurring: recurringValues.recurring,
          recurring_interval: recurringValues.recurring_interval,
          recurring_next_date: recurringValues.recurring_next_date,
          import_source: values.import_source,
          import_ref: values.import_ref,
          notes: values.notes,
        });
        const created = await createExpense(createInput);
        toast.success('Ausgabe erstellt');
        onSaved(created);
        closeDetailPanel();
      } else {
        const updateInput: UpdateExpense = {
          date: values.date,
          amount_gross: values.amount_gross,
          amount_net: values.amount_net,
          tax_amount: values.tax_amount,
          vendor: values.vendor,
          category: values.category,
          subcategory: values.subcategory,
          payment_method: values.payment_method,
          purpose: values.purpose,
          product_id: values.product_id,
          order_id: values.order_id,
          receipt_attached: values.receipt_attached,
          receipt_file_path: values.receipt_file_path,
          tax_relevant: values.tax_relevant,
          recurring: recurringValues.recurring,
          recurring_interval: recurringValues.recurring_interval,
          recurring_next_date: recurringValues.recurring_next_date,
          import_source: values.import_source,
          import_ref: values.import_ref,
          notes: values.notes,
        };
        const updated = await updateExpense(expense.id, updateInput);
        toast.success('Ausgabe gespeichert');
        onSaved(updated);
        form.reset(createDefaultValues(updated));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ausgabe konnte nicht gespeichert werden');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (isNew) return;

    try {
      await softDeleteExpense(expense.id);
      toast.success('Ausgabe gelöscht');
      setShowDeleteConfirm(false);
      onDeleted();
      closeDetailPanel();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ausgabe konnte nicht gelöscht werden');
    }
  }

  async function handleRestore() {
    if (isNew) return;

    try {
      await restoreExpense(expense.id);
      toast.success('Ausgabe wiederhergestellt');
      onRestored();
      closeDetailPanel();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Ausgabe konnte nicht wiederhergestellt werden',
      );
    }
  }

  return (
    <>
      <form
        onSubmit={(event) => void form.handleSubmit(handleSave)(event)}
        className="flex min-h-[calc(100vh-86px)] flex-col"
      >
        <div className="-mx-4 -mt-4 flex items-center justify-between gap-2 border-b border-border-subtle px-4 py-3 dark:border-transparent">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-text-primary">
              {isNew ? 'Neue Ausgabe' : expense.vendor || 'Ausgabe bearbeiten'}
            </h2>
            <p className="text-xs text-text-muted">Ausgabenverwaltung</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={closeDetailPanel}>
              Abbrechen
            </Button>
            <Button type="submit" size="sm" className="gap-1.5" disabled={isSaving}>
              <Save size={14} />
              Speichern
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="mt-4 flex flex-1 flex-col overflow-hidden">
          <TabsList variant="line" className="w-full justify-start">
            <TabsTrigger value="overview">Übersicht</TabsTrigger>
            <TabsTrigger value="receipt">Beleg</TabsTrigger>
          </TabsList>

          <div className="mt-4 flex-1 overflow-auto">
            <TabsContent value="overview">
              <OverviewTab form={form} />
            </TabsContent>

            <TabsContent value="receipt">
              <ReceiptTab
                form={form}
                expenseId={isNew ? null : expense.id}
                onSaved={(updated) => {
                  onSaved(updated);
                  form.reset(createDefaultValues(updated));
                }}
              />
            </TabsContent>
          </div>
        </Tabs>

        <div className="mt-4 border-t border-border-subtle pt-4 dark:border-transparent">
          {!isNew && expense.deleted_at ? (
            <Button
              type="button"
              variant="secondary"
              className="w-full gap-1.5"
              onClick={() => void handleRestore()}
            >
              <RotateCcw size={14} />
              Wiederherstellen
            </Button>
          ) : null}

          {!isNew ? (
            <Button
              type="button"
              variant="destructive"
              className="mt-2 w-full gap-1.5"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 size={14} />
              Löschen
            </Button>
          ) : null}
        </div>
      </form>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ausgabe löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Ausgabe wird in den Papierkorb verschoben und kann später wiederhergestellt
              werden.
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

function normalizeRecurringValues(values: ExpenseUpdateWithId): {
  recurring: boolean;
  recurring_interval: RecurringInterval | null;
  recurring_next_date: string | null;
} {
  if (!values.recurring) {
    return {
      recurring: false,
      recurring_interval: null,
      recurring_next_date: null,
    };
  }

  const interval = values.recurring_interval ?? 'monthly';
  const date = values.date ?? todayISODate();
  return {
    recurring: true,
    recurring_interval: interval,
    recurring_next_date: calculateNextRecurringDate(date, interval),
  };
}

function OverviewTab({ form }: { form: UseFormReturn<ExpenseUpdateWithId> }) {
  const {
    register,
    setValue,
    watch,
    control,
    formState: { errors },
  } = form;

  const category = watch('category') ?? 'sonstiges';
  // Fallback fuer unbekannte Kategorie-Werte aus der DB (z.B. Altdaten/Import):
  // ohne Guard wuerde ein einziger invalider Datensatz die ganze App crashen.
  const subcategories = EXPENSE_SUBCATEGORIES[category] ?? EXPENSE_SUBCATEGORIES.sonstiges;
  const paymentMethod = watch('payment_method');
  const subcategory = watch('subcategory');
  const productId = watch('product_id');
  const taxRelevant = watch('tax_relevant') ?? true;
  const recurring = watch('recurring') === true;
  const recurringInterval = watch('recurring_interval');
  const expenseDate = watch('date') ?? todayISODate();
  const recurringNextDate =
    recurring && recurringInterval
      ? calculateNextRecurringDate(expenseDate, recurringInterval)
      : null;

  return (
    <div className="space-y-4">
      <FormField label="Datum *" error={errors.date?.message}>
        <Input type="date" {...register('date')} />
      </FormField>

      <FormField label="Betrag brutto *" error={errors.amount_gross?.message}>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={String(watch('amount_gross') ?? '')}
          onChange={(event) =>
            setValue('amount_gross', Number(event.target.value), { shouldDirty: true })
          }
        />
      </FormField>

      <FormField label="Händler *" error={errors.vendor?.message}>
        <Input {...register('vendor')} placeholder="Händler" />
      </FormField>

      <FormField label="Kategorie *" error={errors.category?.message}>
        <Controller
          control={control}
          name="category"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(value) => {
                if (!value) return;
                field.onChange(value);
                setValue('subcategory', null, { shouldDirty: true });
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue>{EXPENSE_CATEGORY_LABELS[field.value ?? 'sonstiges']}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {EXPENSE_CATEGORY_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </FormField>

      <FormField label="Unterkategorie">
        <Select
          value={subcategory ?? 'none'}
          onValueChange={(value) =>
            setValue('subcategory', value === 'none' ? null : (value as ExpenseSubcategory), {
              shouldDirty: true,
            })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              {subcategory ? EXPENSE_SUBCATEGORY_LABELS[subcategory] : 'Keine'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Keine</SelectItem>
            {subcategories.map((item) => (
              <SelectItem key={item} value={item}>
                {EXPENSE_SUBCATEGORY_LABELS[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      <FormField label="Zahlungsmethode">
        <Select
          value={paymentMethod ?? 'none'}
          onValueChange={(value) =>
            setValue('payment_method', value === 'none' ? null : (value as PaymentMethod), {
              shouldDirty: true,
            })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              {paymentMethod ? PAYMENT_METHOD_LABELS[paymentMethod] : 'Keine'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Keine</SelectItem>
            {PAYMENT_METHODS.map((method) => (
              <SelectItem key={method} value={method}>
                {PAYMENT_METHOD_LABELS[method]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      <FormField label="Verwendungszweck">
        <Input {...register('purpose')} placeholder="Optional" />
      </FormField>

      <FormField label="Produktzuordnung">
        <ProductCombobox
          value={productId ?? null}
          onChange={(nextProductId) => setValue('product_id', nextProductId, { shouldDirty: true })}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex items-center gap-2 rounded-lg border border-border-subtle p-3 text-sm">
          <Checkbox
            checked={taxRelevant}
            onCheckedChange={(checked) =>
              setValue('tax_relevant', Boolean(checked), { shouldDirty: true })
            }
          />
          Steuerrelevant
        </label>

        <label className="flex items-center gap-2 rounded-lg border border-border-subtle p-3 text-sm">
          <Checkbox
            checked={recurring}
            onCheckedChange={(checked) => {
              const isChecked = checked === true;
              setValue('recurring', isChecked, { shouldDirty: true });
              if (isChecked) {
                const nextInterval = recurringInterval ?? 'monthly';
                setValue('recurring_interval', nextInterval, { shouldDirty: true });
                setValue(
                  'recurring_next_date',
                  calculateNextRecurringDate(expenseDate, nextInterval),
                  {
                    shouldDirty: true,
                  },
                );
              } else {
                setValue('recurring_interval', null, { shouldDirty: true });
                setValue('recurring_next_date', null, { shouldDirty: true });
              }
            }}
          />
          Wiederkehrend
        </label>
      </div>

      {recurring ? (
        <div className="space-y-3 rounded-lg border border-border-subtle bg-bg-primary p-3">
          <FormField label="Intervall">
            <Select
              value={recurringInterval ?? 'monthly'}
              onValueChange={(value) => {
                const interval = value as RecurringInterval;
                setValue('recurring_interval', interval, { shouldDirty: true });
                setValue('recurring_next_date', calculateNextRecurringDate(expenseDate, interval), {
                  shouldDirty: true,
                });
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {recurringInterval === 'quarterly'
                    ? 'Quartalsweise'
                    : recurringInterval === 'yearly'
                      ? 'Jährlich'
                      : 'Monatlich'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monatlich</SelectItem>
                <SelectItem value="quarterly">Quartalsweise</SelectItem>
                <SelectItem value="yearly">Jährlich</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Nächste Fälligkeit">
            <Input value={recurringNextDate ?? ''} readOnly className="bg-bg-secondary" />
          </FormField>
        </div>
      ) : null}

      <FormField label="Notizen">
        <Textarea {...register('notes')} rows={4} placeholder="Optional" />
      </FormField>
    </div>
  );
}

function ReceiptTab({
  form,
  expenseId,
  onSaved,
}: {
  form: UseFormReturn<ExpenseUpdateWithId>;
  expenseId: string | null;
  onSaved: (expense: Expense) => void;
}) {
  const receiptPath = form.watch('receipt_file_path');

  async function updateReceipt(path: string | null) {
    form.setValue('receipt_file_path', path, { shouldDirty: true });
    form.setValue('receipt_attached', Boolean(path), { shouldDirty: true });

    if (!expenseId) {
      return;
    }

    const updated = await updateExpense(expenseId, {
      receipt_file_path: path,
      receipt_attached: Boolean(path),
    });
    onSaved(updated);
  }

  async function handlePickReceipt() {
    try {
      const selected = await openDialog({
        title: 'Beleg verknüpfen',
        directory: false,
        multiple: false,
        filters: [
          {
            name: 'Belege',
            extensions: ['pdf', 'png', 'jpg', 'jpeg', 'webp'],
          },
        ],
      });

      if (typeof selected === 'string') {
        await updateReceipt(selected);
        toast.success('Beleg verknüpft');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Beleg konnte nicht verknüpft werden');
    }
  }

  async function handleOpenReceipt() {
    if (!receiptPath) return;
    try {
      await openPath(receiptPath);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Beleg konnte nicht geöffnet werden');
    }
  }

  async function handleRemoveReceipt() {
    try {
      await updateReceipt(null);
      toast.success('Beleg-Verknüpfung entfernt');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Verknüpfung konnte nicht entfernt werden');
    }
  }

  return (
    <div className="space-y-4">
      {receiptPath ? (
        <div className="rounded-lg border border-border-subtle bg-bg-primary p-3">
          <div className="flex items-center gap-3">
            <ReceiptIcon path={receiptPath} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-primary">
                {fileNameFromPath(receiptPath)}
              </p>
              <p className="truncate text-xs text-text-muted">{receiptPath}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void handleOpenReceipt()}
            >
              Öffnen
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => void handleRemoveReceipt()}
            >
              Verknüpfung entfernen
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border-subtle bg-bg-primary p-6 text-center">
          <Paperclip size={22} className="mx-auto mb-2 text-text-muted" />
          <p className="text-sm text-text-secondary">Noch kein Beleg verknüpft</p>
        </div>
      )}

      <Button type="button" className="w-full gap-1.5" onClick={() => void handlePickReceipt()}>
        <Paperclip size={14} />
        Beleg verknüpfen
      </Button>

      <p className="rounded-lg bg-info-subtle p-3 text-xs text-text-secondary">
        Für erweiterte Dateiverknüpfungen nutze den Dateimanager (Modul 03).
      </p>
    </div>
  );
}

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1.5 text-xs text-text-secondary">{label}</Label>
      {children}
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}

function fileNameFromPath(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : path;
}

function ReceiptIcon({ path }: { path: string }) {
  const parts = path.split('.');
  const extension = parts.length > 0 ? parts[parts.length - 1]?.toLowerCase() : undefined;
  if (extension === 'pdf') {
    return <FileText size={22} className="shrink-0 text-danger" />;
  }
  if (extension === 'png' || extension === 'jpg' || extension === 'jpeg' || extension === 'webp') {
    return <FileImage size={22} className="shrink-0 text-info" />;
  }
  return <FileWarning size={22} className="shrink-0 text-text-muted" />;
}
