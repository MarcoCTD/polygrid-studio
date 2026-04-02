import { useState } from "react";
import { X, Trash2, Pencil } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { useOrderStore } from "../store";
import {
  PAYMENT_STATUS_LABELS,
  SHIPPING_STATUS_LABELS,
  type Order,
  type PaymentStatus,
  type ShippingStatus,
} from "../types";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[--muted-foreground]">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2">
      <span className="text-xs text-[--muted-foreground] pt-0.5">{label}</span>
      <span className="text-sm text-[--foreground]">{value}</span>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatCurrency(n: number): string {
  return n.toFixed(2).replace(".", ",") + " €";
}

interface OrderDetailPanelProps {
  order: Order;
}

export function OrderDetailPanel({ order }: OrderDetailPanelProps) {
  const { selectOrder, deleteOrder } = useOrderStore();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleDelete() {
    if (isDeleting) return;

    setActionError(null);
    setIsDeleting(true);

    try {
      await deleteOrder(order.id);
      setConfirmDelete(false);
    } catch (err) {
      console.error("Failed to delete order:", err);
      setActionError(
        err instanceof Error ? err.message : "Auftrag konnte nicht gelöscht werden."
      );
    } finally {
      setIsDeleting(false);
    }
  }

  const paymentVariant =
    order.payment_status === "paid" ? "success"
    : order.payment_status === "pending" ? "warning"
    : order.payment_status === "refunded" ? "muted"
    : "danger";

  // Profit calculation
  const revenue = order.sale_price * order.quantity;
  const costs = (order.material_cost ?? 0) + (order.shipping_cost ?? 0) + (order.platform_fee ?? 0);
  const profit = revenue - costs;

  return (
    <div className="flex h-full w-[380px] shrink-0 flex-col border-l border-[--border] bg-[--background]">
      {/* Header */}
      <div className="flex items-start gap-2 border-b border-[--border] p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <Badge variant={paymentVariant}>
              {PAYMENT_STATUS_LABELS[order.payment_status as PaymentStatus]}
            </Badge>
          </div>
          <h2 className="mt-1.5 text-sm font-semibold leading-snug text-[--foreground]">
            {order.customer_name || "Unbekannter Kunde"}
          </h2>
          <p className="text-xs text-[--muted-foreground]">
            {order.platform} &middot; {formatDate(order.order_date)}
          </p>
        </div>
        <button
          onClick={() => selectOrder(null)}
          className="shrink-0 rounded-md p-1 text-[--muted-foreground] transition-colors hover:bg-[--muted] hover:text-[--foreground]"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {actionError && (
            <div className="rounded-md border border-[--accent-danger]/20 bg-[--accent-danger-subtle] px-3 py-2 text-xs text-[--accent-danger]">
              {actionError}
            </div>
          )}
          <Section title="Bestellung">
            <Field label="Bestell-Nr." value={order.external_order_id} />
            <Field label="Plattform" value={order.platform} />
            <Field label="Menge" value={`${order.quantity}x`} />
            <Field label="Variante" value={order.variant} />
          </Section>

          <Section title="Finanzen">
            <Field label="Verkaufspreis" value={formatCurrency(order.sale_price)} />
            <Field
              label="Versandkosten"
              value={order.shipping_cost != null ? formatCurrency(order.shipping_cost) : null}
            />
            <Field
              label="Materialkosten"
              value={order.material_cost != null ? formatCurrency(order.material_cost) : null}
            />
            <Field
              label="Plattformgebühr"
              value={order.platform_fee != null ? formatCurrency(order.platform_fee) : null}
            />
            {costs > 0 && (
              <Field
                label="Gewinn"
                value={
                  <span className={profit >= 0 ? "text-[--accent-success] font-medium font-mono" : "text-[--accent-danger] font-medium font-mono"}>
                    {formatCurrency(profit)}
                  </span>
                }
              />
            )}
          </Section>

          <Section title="Versand">
            <Field
              label="Versandstatus"
              value={
                order.shipping_status ? (
                  <Badge variant="outline">
                    {SHIPPING_STATUS_LABELS[order.shipping_status as ShippingStatus] ?? order.shipping_status}
                  </Badge>
                ) : null
              }
            />
            <Field label="Tracking-Nr." value={order.tracking_number} />
          </Section>

          {order.notes && (
            <Section title="Notizen">
              <p className="text-sm text-[--muted-foreground] whitespace-pre-wrap">
                {order.notes}
              </p>
            </Section>
          )}
        </div>
      </ScrollArea>

      {/* Footer actions */}
      <div className="flex gap-2 border-t border-[--border] p-3">
        <Button variant="outline" size="sm" className="flex-1 gap-1.5">
          <Pencil className="size-3.5" />
          Bearbeiten
        </Button>
        {confirmDelete ? (
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
              Abbrechen
            </Button>
            <Button
              size="sm"
              className="gap-1 bg-[--accent-danger] text-white hover:bg-[--accent-danger-hover]"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Löschen..." : "Löschen"}
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="text-[--muted-foreground] hover:text-[--accent-danger]"
            onClick={() => setConfirmDelete(true)}
            disabled={isDeleting}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
