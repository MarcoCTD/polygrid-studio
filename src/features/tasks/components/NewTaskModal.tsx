import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { CalendarDays, Link2, Repeat } from 'lucide-react';
import { toast } from 'sonner';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { listProducts, type Product } from '@/features/products';
import { getListings, PLATFORM_LABELS, type ListingListItem } from '@/features/listings';
import { getOrders } from '@/features/orders/services';
import type { OrderListItem } from '@/features/orders/types';
import type { RecurringRule, TaskCreate, TaskPriority } from '../schemas';
import { taskCreateSchema } from '../schemas';
import { createTask } from '../services';

type LinkType = 'none' | 'product' | 'order' | 'listing';

interface NewTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Montag' },
  { value: 2, label: 'Dienstag' },
  { value: 3, label: 'Mittwoch' },
  { value: 4, label: 'Donnerstag' },
  { value: 5, label: 'Freitag' },
  { value: 6, label: 'Samstag' },
  { value: 0, label: 'Sonntag' },
];

function defaultValues(): TaskCreate {
  return {
    title: '',
    description: null,
    priority: 'medium',
    status: 'todo',
    due_date: null,
    product_id: null,
    order_id: null,
    listing_id: null,
    recurring_rule: null,
    parent_task_id: null,
  };
}

function textOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function buildRecurringRule(
  enabled: boolean,
  interval: string,
  day: number | null,
): RecurringRule | null {
  if (!enabled) return null;
  if (interval === 'weekly') return { interval: 'weekly', day: day ?? 1 };
  if (interval === 'monthly') return { interval: 'monthly', day: day ?? 1 };
  return { interval: 'daily' };
}

export function NewTaskModal({ open, onOpenChange, onCreated }: NewTaskModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [listings, setListings] = useState<ListingListItem[]>([]);
  const [linkType, setLinkType] = useState<LinkType>('none');
  const [entitySearch, setEntitySearch] = useState('');
  const [recurringEnabled, setRecurringEnabled] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState<'daily' | 'weekly' | 'monthly'>(
    'weekly',
  );
  const [recurringDay, setRecurringDay] = useState<number | null>(1);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<TaskCreate>({
    resolver: zodResolver(taskCreateSchema),
    defaultValues: defaultValues(),
  });
  const selectedProductId = useWatch({ control: form.control, name: 'product_id' }) ?? null;
  const selectedOrderId = useWatch({ control: form.control, name: 'order_id' }) ?? null;
  const selectedListingId = useWatch({ control: form.control, name: 'listing_id' }) ?? null;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    Promise.all([
      listProducts({ includeDeleted: false }),
      getOrders({ showDeleted: false }),
      getListings({ showDeleted: false }),
    ])
      .then(([productItems, orderItems, listingItems]) => {
        if (cancelled) return;
        setProducts(productItems);
        setOrders(orderItems);
        setListings(listingItems);
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : 'Verknüpfungen konnten nicht geladen werden',
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        form.reset(defaultValues());
        setLinkType('none');
        setEntitySearch('');
        setRecurringEnabled(false);
        setRecurringInterval('weekly');
        setRecurringDay(1);
      });
    }
  }, [form, open]);

  const entityOptions = useMemo(() => {
    const query = entitySearch.trim().toLowerCase();
    if (linkType === 'product') {
      return products
        .filter((product) => product.name.toLowerCase().includes(query))
        .map((product) => ({ id: product.id, label: product.name }));
    }
    if (linkType === 'order') {
      return orders
        .filter((order) =>
          `${order.receipt_number} ${order.customer_name ?? ''}`.toLowerCase().includes(query),
        )
        .map((order) => ({
          id: order.id,
          label: `${order.receipt_number}${order.customer_name ? ` · ${order.customer_name}` : ''}`,
        }));
    }
    if (linkType === 'listing') {
      return listings
        .filter((listing) => listing.master_title.toLowerCase().includes(query))
        .map((listing) => ({
          id: listing.id,
          label: `${listing.master_title} · ${listing.overrides.map((item) => PLATFORM_LABELS[item.platform]).join(', ')}`,
        }));
    }
    return [];
  }, [entitySearch, linkType, listings, orders, products]);

  function clearLinks() {
    form.setValue('product_id', null);
    form.setValue('order_id', null);
    form.setValue('listing_id', null);
  }

  async function handleSubmit(values: TaskCreate) {
    setIsSaving(true);
    try {
      const input = taskCreateSchema.parse({
        ...values,
        title: values.title.trim(),
        description: textOrNull(values.description),
        due_date: values.due_date || null,
        recurring_rule: buildRecurringRule(recurringEnabled, recurringInterval, recurringDay),
      });
      await createTask(input);
      toast.success('Aufgabe erstellt');
      onCreated();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Aufgabe konnte nicht erstellt werden');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Neue Aufgabe</DialogTitle>
          <DialogDescription>
            Aufgabe planen, priorisieren und optional mit Produkt, Auftrag oder Listing verknüpfen.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => void form.handleSubmit(handleSubmit)(event)}
        >
          <Field label="Titel" error={form.formState.errors.title?.message}>
            <Input autoFocus {...form.register('title')} />
          </Field>

          <Field label="Beschreibung">
            <Textarea rows={3} {...form.register('description')} />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Priorität">
              <Controller
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(value) => field.onChange(value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {PRIORITY_OPTIONS.find((option) => option.value === field.value)?.label}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Fälligkeitsdatum">
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-2.5 top-2 size-4 text-text-muted" />
                <Input type="date" className="pl-8" {...form.register('due_date')} />
              </div>
            </Field>
          </div>

          <section className="space-y-3 rounded-lg border border-border-subtle p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
              <Link2 className="size-4" />
              Verknüpfung
            </div>
            <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
              <Select
                value={linkType}
                onValueChange={(value) => {
                  setLinkType(value as LinkType);
                  setEntitySearch('');
                  clearLinks();
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {linkType === 'none'
                      ? 'Keine'
                      : linkType === 'product'
                        ? 'Produkt'
                        : linkType === 'order'
                          ? 'Auftrag'
                          : 'Listing'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine</SelectItem>
                  <SelectItem value="product">Produkt</SelectItem>
                  <SelectItem value="order">Auftrag</SelectItem>
                  <SelectItem value="listing">Listing</SelectItem>
                </SelectContent>
              </Select>

              {linkType !== 'none' ? (
                <div className="space-y-2">
                  <Input
                    value={entitySearch}
                    onChange={(event) => setEntitySearch(event.target.value)}
                    placeholder="Suchen..."
                  />
                  <Select
                    value={
                      linkType === 'product'
                        ? (selectedProductId ?? 'none')
                        : linkType === 'order'
                          ? (selectedOrderId ?? 'none')
                          : (selectedListingId ?? 'none')
                    }
                    onValueChange={(value) => {
                      clearLinks();
                      const next = value === 'none' ? null : value;
                      if (linkType === 'product') form.setValue('product_id', next);
                      if (linkType === 'order') form.setValue('order_id', next);
                      if (linkType === 'listing') form.setValue('listing_id', next);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Auswählen">
                        {entityOptions.find(
                          (option) =>
                            option.id ===
                            (linkType === 'product'
                              ? selectedProductId
                              : linkType === 'order'
                                ? selectedOrderId
                                : selectedListingId),
                        )?.label ?? 'Auswählen'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Keine Auswahl</SelectItem>
                      {entityOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
          </section>

          <section className="space-y-3 rounded-lg border border-border-subtle p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-text-primary">
              <Checkbox
                checked={recurringEnabled}
                onCheckedChange={(checked) => setRecurringEnabled(Boolean(checked))}
              />
              <Repeat className="size-4" />
              Wiederkehrend
            </label>

            {recurringEnabled ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Intervall">
                  <Select
                    value={recurringInterval}
                    onValueChange={(value) =>
                      setRecurringInterval(value as typeof recurringInterval)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {recurringInterval === 'daily'
                          ? 'Täglich'
                          : recurringInterval === 'weekly'
                            ? 'Wöchentlich'
                            : 'Monatlich'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Täglich</SelectItem>
                      <SelectItem value="weekly">Wöchentlich</SelectItem>
                      <SelectItem value="monthly">Monatlich</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {recurringInterval === 'weekly' ? (
                  <Field label="Wochentag">
                    <Select
                      value={String(recurringDay ?? 1)}
                      onValueChange={(value) => setRecurringDay(Number(value))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {WEEKDAY_OPTIONS.find((option) => option.value === recurringDay)?.label}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {WEEKDAY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={String(option.value)}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                ) : null}
                {recurringInterval === 'monthly' ? (
                  <Field label="Tag im Monat">
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      value={recurringDay ?? 1}
                      onChange={(event) => setRecurringDay(Number(event.target.value))}
                    />
                  </Field>
                ) : null}
              </div>
            ) : null}
          </section>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Erstelle...' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
