import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { CheckCircle2, Clock3, Link2Off, PackageCheck, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { formatEUR } from '@/features/products/utils';
import { numberOrNull } from '@/utils';
import { TemplateSuggestionBanner } from '@/features/playbooks/components';
import { ManualBankMatchDialog } from '@/features/finance/components';
import type { ConfirmMatchResult } from '@/features/finance/services';
import { cn } from '@/lib/utils';
import {
  getBankTransactionMatch,
  getOrderEvents,
  softDeleteOrder,
  updateOrder,
  type BankTransactionMatch,
} from '../services';
import {
  PAYMENT_STATUS_LABELS,
  UpdateOrderSchema,
  type Order,
  type OrderEvent,
  type OrderListItem,
  type OrderStatus,
  type PaymentStatus,
  type ShippingStatus,
  type UpdateOrderInput,
} from '../types';
import {
  OrderPlatformIcon,
  OrderStatusBadge,
  PaymentStatusBadge,
  TaxLockedIcon,
} from './OrderBadges';

interface OrderDetailPanelProps {
  order: OrderListItem;
  onClose: () => void;
  onChanged: () => void;
}

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'inquiry', label: 'Anfrage' },
  { value: 'ordered', label: 'Bestellt' },
  { value: 'confirmed', label: 'Angenommen' },
  { value: 'in_production', label: 'In Produktion' },
  { value: 'shipped', label: 'Versendet' },
  { value: 'completed', label: 'Abgeschlossen' },
  { value: 'issue', label: 'Problem' },
  { value: 'cancelled', label: 'Storniert' },
];

const PAYMENT_OPTIONS: { value: PaymentStatus; label: string }[] = [
  { value: 'pending', label: 'Offen' },
  { value: 'paid', label: 'Bezahlt' },
  { value: 'refunded', label: 'Erstattet' },
  { value: 'disputed', label: 'Klärung' },
];

const SHIPPING_OPTIONS: { value: ShippingStatus; label: string }[] = [
  { value: 'not_shipped', label: 'Nicht versendet' },
  { value: 'shipped', label: 'Versendet' },
  { value: 'delivered', label: 'Zugestellt' },
  { value: 'returned', label: 'Retoure' },
];

function textOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function toInputDate(value: string | null): string {
  return value?.slice(0, 10) ?? '';
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function statusLabel(value: string | null): string {
  return STATUS_OPTIONS.find((option) => option.value === value)?.label ?? value ?? '-';
}

function eventText(event: OrderEvent): string {
  if (event.event_type === 'status_change') {
    return `Status geändert: ${statusLabel(event.from_value)} -> ${statusLabel(event.to_value)}`;
  }
  if (event.event_type === 'tracking_added') {
    return `Tracking aktualisiert: ${event.from_value || '-'} -> ${event.to_value || '-'}`;
  }
  return 'Notizen aktualisiert';
}

function marginColor(percent: number): string {
  if (percent >= 50) return 'text-emerald-700';
  if (percent >= 30) return 'text-amber-700';
  if (percent >= 15) return 'text-orange-700';
  return 'text-red-700';
}

export function OrderDetailPanel({ order, onClose, onChanged }: OrderDetailPanelProps) {
  const [currentOrder, setCurrentOrder] = useState<OrderListItem>(order);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [bankMatch, setBankMatch] = useState<BankTransactionMatch | null>(null);
  const [manualMatchOpen, setManualMatchOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const form = useForm<UpdateOrderInput>({
    defaultValues: orderToFormValues(order),
  });

  useEffect(() => {
    queueMicrotask(() => {
      setCurrentOrder(order);
      form.reset(orderToFormValues(order));
    });
  }, [form, order]);

  useEffect(() => {
    let cancelled = false;
    void getOrderEvents(currentOrder.id)
      .then((items) => {
        if (!cancelled) setEvents(items);
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : 'Timeline konnte nicht geladen werden',
          );
        }
      });

    if (currentOrder.bank_match_id) {
      void getBankTransactionMatch(currentOrder.bank_match_id)
        .then((match) => {
          if (!cancelled) setBankMatch(match);
        })
        .catch((error) => {
          if (!cancelled) {
            toast.error(
              error instanceof Error ? error.message : 'Bank-Match konnte nicht geladen werden',
            );
          }
        });
    } else {
      queueMicrotask(() => setBankMatch(null));
    }

    return () => {
      cancelled = true;
    };
  }, [currentOrder.id, currentOrder.bank_match_id]);

  const isLocked = currentOrder.tax_locked;

  async function reloadEvents() {
    setEvents(await getOrderEvents(currentOrder.id));
  }

  async function handleSave(values: UpdateOrderInput) {
    const payload = normalizePayload(values, currentOrder);
    const parsed = UpdateOrderSchema.safeParse({
      ...payload,
      id: currentOrder.id,
      tax_locked: currentOrder.tax_locked,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Auftrag konnte nicht validiert werden');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateOrder(currentOrder.id, payload);
      // has_paid_invoice ändert sich nicht durch ein Auftrags-Update (nur durch
      // Rechnungsaktionen), bleibt also erhalten.
      const merged = {
        ...updated,
        product_name: currentOrder.product_name,
        has_paid_invoice: currentOrder.has_paid_invoice,
      };
      setCurrentOrder(merged);
      form.reset(orderToFormValues(merged));
      await reloadEvents();
      onChanged();
      toast.success('Auftrag gespeichert');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Auftrag konnte nicht gespeichert werden',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (currentOrder.tax_locked || !window.confirm('Auftrag wirklich löschen?')) return;

    setIsDeleting(true);
    try {
      await softDeleteOrder(currentOrder.id);
      toast.success('Auftrag gelöscht');
      onChanged();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Auftrag konnte nicht gelöscht werden');
    } finally {
      setIsDeleting(false);
    }
  }

  async function unlinkBankMatch() {
    try {
      const updated = await updateOrder(currentOrder.id, { bank_match_id: null });
      setCurrentOrder({
        ...updated,
        product_name: currentOrder.product_name,
        has_paid_invoice: currentOrder.has_paid_invoice,
      });
      setBankMatch(null);
      onChanged();
      toast.success('Bank-Match entfernt');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Bank-Match konnte nicht entfernt werden',
      );
    }
  }

  const hasPaidInvoice = currentOrder.has_paid_invoice === true;
  // Stiller Widerspruch (Modul 08): verknüpfte Rechnung bezahlt, Auftrag aber
  // nicht auf bezahlt (z.B. Altdaten). Korrektur setzt payment_status='paid'
  // über den zentralen updateOrder-Pfad.
  const paymentMismatch = hasPaidInvoice && currentOrder.payment_status !== 'paid';

  async function handleFixPaymentMismatch() {
    try {
      const updated = await updateOrder(currentOrder.id, { payment_status: 'paid' });
      const merged = {
        ...updated,
        product_name: currentOrder.product_name,
        has_paid_invoice: currentOrder.has_paid_invoice,
      };
      setCurrentOrder(merged);
      form.reset(orderToFormValues(merged));
      await reloadEvents();
      onChanged();
      toast.success('Zahlung auf bezahlt gesetzt');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Zahlung konnte nicht gesetzt werden');
    }
  }

  async function handleManualMatched(result: ConfirmMatchResult) {
    const refreshed = await getBankTransactionMatch(result.transactionId);
    setCurrentOrder({
      ...currentOrder,
      bank_match_id: result.transactionId,
      payment_received_date: refreshed?.transaction_date ?? currentOrder.payment_received_date,
      payment_status: 'paid',
    });
    setBankMatch(refreshed);
    onChanged();
    toast.success('Banktransaktion verknüpft');
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border-subtle p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
              Auftrag
            </p>
            <h2 className="mt-1 truncate text-lg font-semibold text-text-primary">
              {currentOrder.receipt_number}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <OrderStatusBadge status={currentOrder.status} />
              <PaymentStatusBadge status={currentOrder.payment_status} />
              <OrderPlatformIcon platform={currentOrder.platform} />
              <TaxLockedIcon locked={currentOrder.tax_locked} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Abbrechen
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSaving}
              onClick={() => void form.handleSubmit(handleSave)()}
            >
              Speichern
            </Button>
          </div>
        </div>

        {isLocked && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Steuerlich gesperrt - nur Notizen, Tracking, Bank-Match und Storno können noch
            bearbeitet werden.
          </div>
        )}

        {paymentMismatch && (
          <div className="mt-3 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <div className="min-w-0">
              <p className="font-medium">Widerspruch zur verknüpften Rechnung</p>
              <p className="mt-0.5">
                Die verknüpfte Rechnung ist bezahlt, der Auftrag steht aber auf „
                {PAYMENT_STATUS_LABELS[currentOrder.payment_status]}“.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              className="shrink-0"
              onClick={() => void handleFixPaymentMismatch()}
            >
              Auf bezahlt setzen
            </Button>
          </div>
        )}
      </header>

      <TemplateSuggestionBanner order={currentOrder} />

      <Tabs defaultValue="overview" className="flex flex-1 flex-col overflow-hidden">
        <TabsList variant="line" className="w-full justify-start px-4 pt-3">
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="costs">Kosten</TabsTrigger>
          <TabsTrigger value="bank">Bank-Match</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto p-4">
          <TabsContent value="overview">
            <OverviewTab
              form={form}
              order={currentOrder}
              isLocked={isLocked}
              onDelete={() => void handleDelete()}
              isDeleting={isDeleting}
            />
          </TabsContent>

          <TabsContent value="timeline">
            <TimelineTab events={events} currentStatus={currentOrder.status} />
          </TabsContent>

          <TabsContent value="costs">
            <CostsTab order={currentOrder} />
          </TabsContent>

          <TabsContent value="bank">
            <BankMatchTab
              bankMatch={bankMatch}
              hasMatch={currentOrder.bank_match_id !== null}
              onUnlink={() => void unlinkBankMatch()}
              onManualMatch={() => setManualMatchOpen(true)}
            />
          </TabsContent>
        </div>
      </Tabs>

      <ManualBankMatchDialog
        open={manualMatchOpen}
        orderId={currentOrder.id}
        onOpenChange={setManualMatchOpen}
        onMatched={(result) => {
          void handleManualMatched(result).catch((error) => {
            toast.error(
              error instanceof Error ? error.message : 'Bank-Match konnte nicht geladen werden',
            );
          });
        }}
      />
    </div>
  );
}

function orderToFormValues(order: Order): UpdateOrderInput {
  return {
    external_order_id: order.external_order_id,
    customer_name: order.customer_name,
    variant: order.variant,
    quantity: order.quantity,
    sale_price: order.sale_price,
    shipping_revenue: order.shipping_revenue,
    shipping_cost: order.shipping_cost,
    material_cost: order.material_cost,
    platform_fee: order.platform_fee,
    payout_amount: order.payout_amount,
    status: order.status,
    payment_status: order.payment_status,
    payment_received_date: toInputDate(order.payment_received_date),
    shipping_status: order.shipping_status,
    tracking_number: order.tracking_number,
    order_date: toInputDate(order.order_date),
    notes: order.notes,
    bank_match_id: order.bank_match_id,
  };
}

function normalizePayload(values: UpdateOrderInput, order: Order): UpdateOrderInput {
  const payload: UpdateOrderInput = order.tax_locked
    ? {
        notes: textOrNull(values.notes),
        tracking_number: textOrNull(values.tracking_number),
        bank_match_id: values.bank_match_id ?? null,
      }
    : {
        ...values,
        external_order_id: textOrNull(values.external_order_id),
        customer_name: textOrNull(values.customer_name),
        variant: textOrNull(values.variant),
        quantity: values.quantity,
        sale_price: values.sale_price,
        shipping_revenue: numberOrNull(values.shipping_revenue),
        shipping_cost: numberOrNull(values.shipping_cost),
        material_cost: numberOrNull(values.material_cost),
        platform_fee: numberOrNull(values.platform_fee),
        payout_amount: numberOrNull(values.payout_amount),
        payment_received_date: textOrNull(values.payment_received_date),
        shipping_status: values.shipping_status ?? null,
        tracking_number: textOrNull(values.tracking_number),
        notes: textOrNull(values.notes),
        bank_match_id: values.bank_match_id ?? null,
      };

  if (order.tax_locked && values.status === 'cancelled' && order.status !== 'cancelled') {
    payload.status = 'cancelled';
  } else if (!order.tax_locked) {
    payload.status = values.status;
    payload.payment_status = values.payment_status;
    payload.order_date = values.order_date;
  }

  return payload;
}

function OverviewTab({
  form,
  order,
  isLocked,
  onDelete,
  isDeleting,
}: {
  form: ReturnType<typeof useForm<UpdateOrderInput>>;
  order: OrderListItem;
  isLocked: boolean;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const editable = !isLocked;

  return (
    <form className="space-y-4">
      <ReadonlyField label="Plattform" value={order.platform} />
      <ReadonlyField label="Produkt" value={order.product_name ?? 'Kein Produkt verknüpft'} />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Variante">
          <Input disabled={!editable} {...form.register('variant')} />
        </Field>
        <Field label="Menge">
          <Input
            type="number"
            min="1"
            disabled={!editable}
            {...form.register('quantity', { valueAsNumber: true })}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Verkaufspreis">
          <Input
            type="number"
            min="0"
            step="0.01"
            disabled={!editable}
            {...form.register('sale_price', { valueAsNumber: true })}
          />
        </Field>
        <Field label="Versanderlös">
          <Input
            type="number"
            min="0"
            step="0.01"
            disabled={!editable}
            {...form.register('shipping_revenue', {
              // numberOrNull statt Number(): RHF reicht auch den Default
              // null durch setValueAs, Number(null) wäre 0.
              setValueAs: numberOrNull,
            })}
          />
        </Field>
      </div>

      <Field label="Externe Bestell-ID">
        <Input disabled={!editable} {...form.register('external_order_id')} />
      </Field>
      <Field label="Kundenname">
        <Input disabled={!editable} {...form.register('customer_name')} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Bestelldatum">
          <Input type="date" disabled={!editable} {...form.register('order_date')} />
        </Field>
        <Field label="Zahlungseingang">
          <Input
            type="date"
            disabled={!editable}
            defaultValue={toInputDate(order.payment_received_date)}
            {...form.register('payment_received_date', {
              setValueAs: (value: string) => (value === '' ? null : value),
            })}
          />
        </Field>
      </div>

      <SelectField
        label="Versandstatus"
        value={form.watch('shipping_status') ?? 'not_shipped'}
        disabled={!editable}
        options={SHIPPING_OPTIONS}
        onChange={(value) => {
          if (value) form.setValue('shipping_status', value as ShippingStatus);
        }}
      />

      <Field label="Tracking-Nummer">
        <Input {...form.register('tracking_number')} />
      </Field>

      <SelectField
        label="Status"
        value={form.watch('status') ?? order.status}
        disabled={isLocked && order.status === 'cancelled'}
        options={isLocked ? lockedStatusOptions(order.status) : STATUS_OPTIONS}
        onChange={(value) => {
          if (value) form.setValue('status', value as OrderStatus);
        }}
      />

      <SelectField
        label="Payment-Status"
        value={form.watch('payment_status') ?? order.payment_status}
        disabled={!editable || order.has_paid_invoice === true}
        hint={
          order.has_paid_invoice
            ? 'Über die verknüpfte Rechnung gesteuert, dort stornieren um zu ändern'
            : undefined
        }
        options={PAYMENT_OPTIONS}
        onChange={(value) => {
          if (value) form.setValue('payment_status', value as PaymentStatus);
        }}
      />

      <Field label="Notizen">
        <Textarea rows={4} {...form.register('notes')} />
      </Field>

      <Separator />

      <Button
        type="button"
        variant="destructive"
        className="w-full gap-2"
        disabled={isLocked || isDeleting}
        title={isLocked ? 'Steuerlich gesperrt - kann nicht gelöscht werden' : undefined}
        onClick={onDelete}
      >
        <Trash2 className="size-4" />
        Löschen
      </Button>
    </form>
  );
}

function TimelineTab({
  events,
  currentStatus,
}: {
  events: OrderEvent[];
  currentStatus: OrderStatus;
}) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border-subtle p-4 text-sm text-text-muted">
        Noch keine Timeline-Einträge.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event, index) => {
        const isLatest = index === events.length - 1;
        return (
          <div
            key={event.id}
            className={cn(
              'flex gap-3 rounded-lg border border-border-subtle bg-bg-elevated p-3',
              isLatest &&
                event.to_value === currentStatus &&
                'border-pg-accent bg-pg-accent-subtle/40',
            )}
          >
            <div className="mt-0.5">
              {event.event_type === 'status_change' ? (
                <CheckCircle2 className="size-4 text-emerald-600" />
              ) : event.event_type === 'tracking_added' ? (
                <PackageCheck className="size-4 text-blue-600" />
              ) : (
                <Clock3 className="size-4 text-text-tertiary" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary">{eventText(event)}</p>
              <p className="mt-1 text-xs text-text-tertiary">{formatDateTime(event.created_at)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CostsTab({ order }: { order: Order }) {
  const shippingRevenue = order.shipping_revenue ?? 0;
  const materialCost = order.material_cost ?? 0;
  const shippingCost = order.shipping_cost ?? 0;
  const platformFee = order.platform_fee ?? 0;
  const grossRevenue = order.sale_price + shippingRevenue;
  const costs = materialCost + shippingCost + platformFee;
  const margin = grossRevenue - costs;
  const marginPercent = grossRevenue > 0 ? (margin / grossRevenue) * 100 : 0;

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-elevated p-4">
      <CostRow label="Verkaufspreis" value={order.sale_price} />
      {shippingRevenue > 0 && <CostRow label="Versanderlös" value={shippingRevenue} prefix="+" />}
      <Separator className="my-3" />
      <CostRow label="Brutto-Einnahme" value={grossRevenue} strong />
      <div className="my-4" />
      {materialCost > 0 && <CostRow label="Materialkosten" value={materialCost} negative />}
      {shippingCost > 0 && <CostRow label="Versandkosten" value={shippingCost} negative />}
      {platformFee > 0 && <CostRow label="Plattformgebühr" value={platformFee} negative />}
      <Separator className="my-3" />
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-text-primary">Marge</span>
        <span className={cn('font-semibold tabular-nums', marginColor(marginPercent))}>
          {formatEUR(margin)} ({marginPercent.toFixed(1).replace('.', ',')}%)
        </span>
      </div>
    </div>
  );
}

function BankMatchTab({
  bankMatch,
  hasMatch,
  onUnlink,
  onManualMatch,
}: {
  bankMatch: BankTransactionMatch | null;
  hasMatch: boolean;
  onUnlink: () => void;
  onManualMatch: () => void;
}) {
  if (hasMatch && bankMatch) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-border-subtle bg-bg-elevated p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-medium text-text-primary">Verknüpfte Banktransaktion</p>
            {bankMatch.match_confidence && (
              <Badge variant="outline">{bankMatch.match_confidence}</Badge>
            )}
          </div>
          <dl className="space-y-2 text-sm">
            <InfoRow label="Datum" value={bankMatch.transaction_date.slice(0, 10)} />
            <InfoRow label="Betrag" value={formatEUR(bankMatch.amount)} />
            <InfoRow label="Gegenseite" value={bankMatch.counterparty_name ?? '-'} />
            <InfoRow label="Verwendungszweck" value={bankMatch.description} />
          </dl>
        </div>
        <Button type="button" variant="outline" className="gap-2" onClick={onUnlink}>
          <Link2Off className="size-4" />
          Verknüpfung aufheben
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-dashed border-border-subtle p-4">
      <div>
        <p className="font-medium text-text-primary">Noch kein Bank-Match</p>
        <p className="mt-1 text-sm text-text-secondary">
          Verknüpfe eine importierte N26-Banktransaktion manuell mit diesem Auftrag.
        </p>
      </div>
      <Button type="button" variant="outline" onClick={onManualMatch}>
        Manuell verknüpfen
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium text-text-secondary">{label}</span>
      {children}
    </label>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5 text-sm">
      <span className="font-medium text-text-secondary">{label}</span>
      <div className="rounded-lg border border-border-subtle bg-bg-secondary px-3 py-2 text-text-primary">
        {value}
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  disabled,
  hint,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  /** Kleiner Hinweis unter dem Feld, z.B. warum es gesperrt ist. */
  hint?: string;
  onChange: (value: string | null) => void;
}) {
  const selectedLabel = options.find((option) => option.value === value)?.label ?? 'Auswählen';

  return (
    <div className="space-y-1.5 text-sm">
      <span className="font-medium text-text-secondary">{label}</span>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-full" title={disabled ? hint : undefined}>
          <SelectValue>{selectedLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint ? <p className="text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
}

function lockedStatusOptions(status: OrderStatus): { value: OrderStatus; label: string }[] {
  if (status === 'cancelled') return [{ value: 'cancelled', label: 'Storniert' }];
  const current = STATUS_OPTIONS.find((option) => option.value === status);
  return [...(current ? [current] : []), { value: 'cancelled', label: 'Storniert' }];
}

function CostRow({
  label,
  value,
  negative,
  strong,
  prefix,
}: {
  label: string;
  value: number;
  negative?: boolean;
  strong?: boolean;
  prefix?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className={cn(strong && 'font-semibold text-text-primary')}>{label}</span>
      <span className={cn('tabular-nums', strong && 'font-semibold text-text-primary')}>
        {negative ? '-' : (prefix ?? '')}
        {formatEUR(value)}
      </span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2">
      <dt className="text-text-tertiary">{label}</dt>
      <dd className="break-words text-text-primary">{value}</dd>
    </div>
  );
}
