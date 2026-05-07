import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Link2, Package, Repeat, Save, ShoppingCart, Tag, Trash2 } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { useUIStore } from '@/stores';
import { listProducts, type Product } from '@/features/products';
import { getListings, PLATFORM_LABELS, type ListingListItem } from '@/features/listings';
import { getOrders } from '@/features/orders/services';
import type { OrderListItem } from '@/features/orders/types';
import type { RecurringRule, Task, TaskPriority, TaskStatus, TaskUpdate } from '../schemas';
import { taskUpdateSchema } from '../schemas';
import { getRecurringHistory, softDeleteTask, updateTask } from '../services';
import { PriorityBadge } from './PriorityBadge';
import { RecurringBadge } from './RecurringBadge';

type LinkType = 'none' | 'product' | 'order' | 'listing';

interface TaskDetailPanelProps {
  task: Task;
  onSaved: (task: Task) => void;
  onDeleted: () => void;
}

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'Offen' },
  { value: 'in_progress', label: 'In Arbeit' },
  { value: 'done', label: 'Erledigt' },
  { value: 'cancelled', label: 'Abgebrochen' },
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

function taskToFormValues(task: Task): TaskUpdate {
  return {
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    due_date: task.due_date,
    product_id: task.product_id,
    order_id: task.order_id,
    listing_id: task.listing_id,
    recurring_rule: task.recurring_rule,
    parent_task_id: task.parent_task_id,
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

function recurringLabel(rule: RecurringRule | null): string {
  if (!rule) return 'Nicht wiederkehrend';
  if (rule.interval === 'daily') return 'Täglich';
  if (rule.interval === 'weekly') {
    return `Wöchentlich${rule.day !== undefined ? ` · ${WEEKDAY_OPTIONS.find((option) => option.value === rule.day)?.label ?? rule.day}` : ''}`;
  }
  return `Monatlich${rule.day ? ` · Tag ${rule.day}` : ''}`;
}

export function TaskDetailPanel({ task, onSaved, onDeleted }: TaskDetailPanelProps) {
  const closeDetailPanel = useUIStore((state) => state.closeDetailPanel);
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [listings, setListings] = useState<ListingListItem[]>([]);
  const [history, setHistory] = useState<Task[]>([]);
  const [linkType, setLinkType] = useState<LinkType>(
    task.product_id ? 'product' : task.order_id ? 'order' : task.listing_id ? 'listing' : 'none',
  );
  const [entitySearch, setEntitySearch] = useState('');
  const [recurringEnabled, setRecurringEnabled] = useState(Boolean(task.recurring_rule));
  const [recurringInterval, setRecurringInterval] = useState<'daily' | 'weekly' | 'monthly'>(
    task.recurring_rule?.interval ?? 'weekly',
  );
  const [recurringDay, setRecurringDay] = useState<number | null>(task.recurring_rule?.day ?? 1);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<TaskUpdate>({
    resolver: zodResolver(taskUpdateSchema),
    defaultValues: taskToFormValues(task),
  });
  const watchedPriority = useWatch({ control: form.control, name: 'priority' }) ?? task.priority;
  const watchedStatus = useWatch({ control: form.control, name: 'status' }) ?? task.status;
  const selectedProductId = useWatch({ control: form.control, name: 'product_id' }) ?? null;
  const selectedOrderId = useWatch({ control: form.control, name: 'order_id' }) ?? null;
  const selectedListingId = useWatch({ control: form.control, name: 'listing_id' }) ?? null;

  useEffect(() => {
    queueMicrotask(() => {
      form.reset(taskToFormValues(task));
      setLinkType(
        task.product_id
          ? 'product'
          : task.order_id
            ? 'order'
            : task.listing_id
              ? 'listing'
              : 'none',
      );
      setRecurringEnabled(Boolean(task.recurring_rule));
      setRecurringInterval(task.recurring_rule?.interval ?? 'weekly');
      setRecurringDay(task.recurring_rule?.day ?? 1);
    });
  }, [form, task]);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      listProducts({ includeDeleted: false }),
      getOrders({ showDeleted: false }),
      getListings({ showDeleted: false }),
      getRecurringHistory(task.id),
    ])
      .then(([productItems, orderItems, listingItems, historyItems]) => {
        if (cancelled) return;
        setProducts(productItems);
        setOrders(orderItems);
        setListings(listingItems);
        setHistory(historyItems);
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : 'Aufgabendetails konnten nicht geladen werden',
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [task.id]);

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

  const completedHistory = useMemo(
    () =>
      history
        .filter((item) => item.id !== task.id && item.status === 'done' && item.completed_at)
        .slice()
        .sort((a, b) => (a.completed_at ?? '').localeCompare(b.completed_at ?? '')),
    [history, task.id],
  );
  const visibleHistory = showAllHistory ? completedHistory : completedHistory.slice(-10);
  const showHistory =
    task.recurring_rule !== null || task.parent_task_id !== null || history.length > 1;

  function clearLinks() {
    form.setValue('product_id', null);
    form.setValue('order_id', null);
    form.setValue('listing_id', null);
  }

  async function handleSave(values: TaskUpdate) {
    setIsSaving(true);
    try {
      const payload = taskUpdateSchema.parse({
        ...values,
        title: values.title?.trim(),
        description: textOrNull(values.description),
        due_date: values.due_date || null,
        recurring_rule: buildRecurringRule(recurringEnabled, recurringInterval, recurringDay),
      });
      const updated = await updateTask(task.id, payload);
      toast.success('Aufgabe gespeichert');
      onSaved(updated);
      form.reset(taskToFormValues(updated));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Aufgabe konnte nicht gespeichert werden',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await softDeleteTask(task.id);
      toast.success('Aufgabe gelöscht');
      setShowDeleteConfirm(false);
      onDeleted();
      closeDetailPanel();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Aufgabe konnte nicht gelöscht werden');
    }
  }

  async function handleStopRecurring() {
    setIsSaving(true);
    try {
      const updated = await updateTask(task.id, { recurring_rule: null });
      setRecurringEnabled(false);
      form.setValue('recurring_rule', null);
      toast.success('Wiederholung beendet');
      onSaved(updated);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Wiederholung konnte nicht beendet werden',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <form className="space-y-4" onSubmit={(event) => void form.handleSubmit(handleSave)(event)}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-2">
            <Input
              className="h-9 text-base font-semibold"
              aria-label="Aufgabentitel"
              {...form.register('title')}
            />
            <div className="flex flex-wrap items-center gap-2">
              <PriorityBadge priority={watchedPriority} />
              <Select
                value={watchedStatus}
                onValueChange={(value) => form.setValue('status', value as TaskStatus)}
              >
                <SelectTrigger size="sm" className="w-36">
                  <SelectValue>
                    {STATUS_OPTIONS.find((option) => option.value === watchedStatus)?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" size="sm" disabled={isSaving} className="gap-1.5">
            <Save className="size-4" />
            {isSaving ? 'Speichert...' : 'Speichern'}
          </Button>
        </div>

        <Field label="Beschreibung">
          <Textarea rows={4} {...form.register('description')} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Priorität">
            <Controller
              control={form.control}
              name="priority"
              render={({ field }) => (
                <Select
                  value={field.value ?? 'medium'}
                  onValueChange={(value) => field.onChange(value)}
                >
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
            <Input type="date" {...form.register('due_date')} />
          </Field>
        </div>

        <section className="space-y-3 rounded-lg border border-border-subtle p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
            <Link2 className="size-4" />
            Verknüpfung
          </div>
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
              <EntitySelector
                linkType={linkType}
                options={entityOptions}
                productId={selectedProductId}
                orderId={selectedOrderId}
                listingId={selectedListingId}
                onSelect={(value) => {
                  clearLinks();
                  if (linkType === 'product') form.setValue('product_id', value);
                  if (linkType === 'order') form.setValue('order_id', value);
                  if (linkType === 'listing') form.setValue('listing_id', value);
                }}
              />
              <LinkedEntityButton
                linkType={linkType}
                productId={selectedProductId}
                orderId={selectedOrderId}
                listingId={selectedListingId}
                onNavigate={(target) => void navigate(target)}
              />
            </div>
          ) : null}
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
          <div className="flex flex-wrap items-center gap-2">
            {buildRecurringRule(recurringEnabled, recurringInterval, recurringDay) ? (
              <RecurringBadge
                rule={buildRecurringRule(recurringEnabled, recurringInterval, recurringDay)!}
              />
            ) : (
              <p className="text-xs text-text-muted">{recurringLabel(null)}</p>
            )}
          </div>

          {recurringEnabled ? (
            <div className="space-y-3">
              <Select
                value={recurringInterval}
                onValueChange={(value) => setRecurringInterval(value as typeof recurringInterval)}
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
              {recurringInterval === 'weekly' ? (
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
              ) : null}
              {recurringInterval === 'monthly' ? (
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={recurringDay ?? 1}
                  onChange={(event) => setRecurringDay(Number(event.target.value))}
                />
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleStopRecurring()}
                disabled={isSaving}
              >
                Wiederholung beenden
              </Button>
            </div>
          ) : null}
        </section>

        {showHistory ? (
          <section className="space-y-2 rounded-lg border border-border-subtle p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-text-primary">Verlauf</h3>
              <span className="text-xs text-text-muted">{completedHistory.length} erledigt</span>
            </div>
            {visibleHistory.length > 0 ? (
              <div className="space-y-1">
                {visibleHistory.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 text-xs text-text-secondary"
                  >
                    <span className="truncate">{item.title}</span>
                    <span className="shrink-0">{item.completed_at?.slice(0, 10)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-muted">Noch keine erledigten Vorgänger.</p>
            )}
            {completedHistory.length > 10 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-0 text-xs"
                onClick={() => setShowAllHistory((value) => !value)}
              >
                {showAllHistory ? 'Weniger anzeigen' : 'Alle anzeigen'}
              </Button>
            ) : null}
          </section>
        ) : null}

        <div className="flex items-center justify-between border-t border-border-subtle pt-4">
          <Button
            type="button"
            variant="destructive"
            className="gap-1.5"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className="size-4" />
            Löschen
          </Button>
          <Button type="button" variant="outline" onClick={closeDetailPanel}>
            Abbrechen
          </Button>
        </div>
      </form>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aufgabe löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Aufgabe wird in den Papierkorb verschoben und kann später wiederhergestellt
              werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-white hover:bg-danger/90"
              onClick={() => void handleDelete()}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function EntitySelector({
  linkType,
  options,
  productId,
  orderId,
  listingId,
  onSelect,
}: {
  linkType: LinkType;
  options: Array<{ id: string; label: string }>;
  productId: string | null;
  orderId: string | null;
  listingId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const value = linkType === 'product' ? productId : linkType === 'order' ? orderId : listingId;
  return (
    <Select
      value={value ?? 'none'}
      onValueChange={(next) => onSelect(next === 'none' ? null : next)}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Auswählen">
          {options.find((option) => option.id === value)?.label ?? 'Auswählen'}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Keine Auswahl</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function LinkedEntityButton({
  linkType,
  productId,
  orderId,
  listingId,
  onNavigate,
}: {
  linkType: LinkType;
  productId: string | null;
  orderId: string | null;
  listingId: string | null;
  onNavigate: (
    target:
      | { to: '/products/$productId'; params: { productId: string } }
      | { to: '/orders' }
      | { to: '/listings/$listingId'; params: { listingId: string } },
  ) => void;
}) {
  if (linkType === 'product' && productId) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-1.5"
        onClick={() => onNavigate({ to: '/products/$productId', params: { productId } })}
      >
        <Package className="size-4" />
        Produkt öffnen
      </Button>
    );
  }
  if (linkType === 'order' && orderId) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-1.5"
        onClick={() => onNavigate({ to: '/orders' })}
      >
        <ShoppingCart className="size-4" />
        Aufträge öffnen
      </Button>
    );
  }
  if (linkType === 'listing' && listingId) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-1.5"
        onClick={() => onNavigate({ to: '/listings/$listingId', params: { listingId } })}
      >
        <Tag className="size-4" />
        Listing öffnen
      </Button>
    );
  }
  return <Badge variant="outline">Keine Verknüpfung gewählt</Badge>;
}
