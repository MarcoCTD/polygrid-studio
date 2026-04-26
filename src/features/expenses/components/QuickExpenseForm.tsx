import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { MoreHorizontal, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } from '../constants';
import { createExpense, checkDuplicate } from '../services';
import { createExpenseSchema, type CreateExpense } from '../schemas';
import { todayISODate } from '../utils';
import { ProductCombobox } from './ProductCombobox';

interface QuickExpenseFormProps {
  onCreated: () => void;
  onMore: () => void;
}

export function QuickExpenseForm({ onCreated, onMore }: QuickExpenseFormProps) {
  const form = useForm<CreateExpense>({
    resolver: zodResolver(createExpenseSchema),
    defaultValues: {
      date: todayISODate(),
      amount_gross: 0,
      vendor: '',
      category: 'sonstiges',
      tax_relevant: true,
      receipt_attached: false,
      recurring: false,
      import_source: 'manual',
      product_id: null,
    },
  });

  async function handleSubmit(data: CreateExpense) {
    try {
      const duplicate = await checkDuplicate(data.date, data.amount_gross, data.vendor);
      if (duplicate) {
        toast.warning('Mögliches Duplikat gefunden');
      }

      await createExpense(data);
      toast.success('Ausgabe hinzugefügt');
      form.reset({
        date: todayISODate(),
        amount_gross: 0,
        vendor: '',
        category: 'sonstiges',
        tax_relevant: true,
        receipt_attached: false,
        recurring: false,
        import_source: 'manual',
        product_id: null,
      });
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ausgabe konnte nicht gespeichert werden');
    }
  }

  return (
    <form
      onSubmit={(event) => void form.handleSubmit(handleSubmit)(event)}
      className="rounded-lg border border-border-subtle bg-bg-elevated p-3 dark:border-transparent dark:shadow-md"
    >
      <div className="grid gap-2 xl:grid-cols-[140px_130px_minmax(180px,1fr)_190px_minmax(160px,1fr)_auto_auto]">
        <Input
          type="date"
          aria-label="Datum"
          {...form.register('date')}
          className={form.formState.errors.date ? 'border-danger' : undefined}
        />

        <Input
          type="number"
          step="0.01"
          min="0"
          placeholder="Betrag"
          aria-label="Betrag brutto"
          {...form.register('amount_gross', { valueAsNumber: true })}
          className={form.formState.errors.amount_gross ? 'border-danger' : undefined}
        />

        <Input
          placeholder="Händler"
          aria-label="Händler"
          {...form.register('vendor')}
          className={form.formState.errors.vendor ? 'border-danger' : undefined}
        />

        <Controller
          control={form.control}
          name="category"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(value) => {
                if (value) field.onChange(value);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {EXPENSE_CATEGORY_LABELS[category]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />

        <Controller
          control={form.control}
          name="product_id"
          render={({ field }) => (
            <ProductCombobox
              value={field.value ?? null}
              onChange={(productId) => field.onChange(productId)}
              placeholder="Produktbezug"
            />
          )}
        />

        <Button type="submit" disabled={form.formState.isSubmitting} className="gap-1.5">
          <Plus size={14} />
          Hinzufügen
        </Button>

        <Button type="button" variant="ghost" onClick={onMore} className="gap-1.5">
          <MoreHorizontal size={14} />
          Mehr...
        </Button>
      </div>
    </form>
  );
}
