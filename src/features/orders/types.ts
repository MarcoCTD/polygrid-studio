import { z } from "zod";

export const ORDER_STATUSES = [
  "inquiry",
  "quoted",
  "ordered",
  "paid",
  "in_production",
  "ready",
  "shipped",
  "completed",
  "issue",
  "cancelled",
] as const;

export const PAYMENT_STATUSES = [
  "pending",
  "paid",
  "refunded",
  "disputed",
] as const;

export const SHIPPING_STATUSES = [
  "not_shipped",
  "shipped",
  "delivered",
  "returned",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type ShippingStatus = (typeof SHIPPING_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  inquiry: "Anfrage",
  quoted: "Angebot",
  ordered: "Bestellt",
  paid: "Bezahlt",
  in_production: "In Produktion",
  ready: "Fertig",
  shipped: "Versendet",
  completed: "Abgeschlossen",
  issue: "Problem",
  cancelled: "Storniert",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Ausstehend",
  paid: "Bezahlt",
  refunded: "Erstattet",
  disputed: "Streitfall",
};

export const SHIPPING_STATUS_LABELS: Record<ShippingStatus, string> = {
  not_shipped: "Nicht versendet",
  shipped: "Versendet",
  delivered: "Zugestellt",
  returned: "Zurückgesendet",
};

export const ORDER_STATUS_VARIANTS: Record<OrderStatus, "muted" | "warning" | "accent" | "success" | "danger"> = {
  inquiry: "muted",
  quoted: "muted",
  ordered: "accent",
  paid: "accent",
  in_production: "warning",
  ready: "accent",
  shipped: "accent",
  completed: "success",
  issue: "danger",
  cancelled: "danger",
};

export const PLATFORMS = [
  "Etsy",
  "Amazon",
  "eBay",
  "Shopify",
  "Website",
  "Lokal",
  "Sonstiges",
] as const;

// ── Full order type (from DB) ────────────────────────────────────────────────

export const OrderSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
  external_order_id: z.string().nullable(),
  customer_name: z.string().nullable(),
  platform: z.string(),
  product_id: z.string().nullable(),
  variant: z.string().nullable(),
  quantity: z.number(),
  sale_price: z.number(),
  shipping_cost: z.number().nullable(),
  material_cost: z.number().nullable(),
  platform_fee: z.number().nullable(),
  status: z.enum(ORDER_STATUSES),
  payment_status: z.enum(PAYMENT_STATUSES),
  shipping_status: z.string().nullable(),
  tracking_number: z.string().nullable(),
  order_date: z.string(),
  notes: z.string().nullable(),
});

export type Order = z.infer<typeof OrderSchema>;

// ── Create/Edit form schema ──────────────────────────────────────────────────

const requiredPositiveNumber = z
  .union([z.string(), z.number()])
  .transform((v) => {
    const n = Number(v);
    if (isNaN(n) || n < 0) throw new Error("Ungültiger Betrag");
    return n;
  });

const optionalPositiveNumber = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
  })
  .nullable()
  .optional();

const optionalPositiveInt = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === "" || v === null || v === undefined) return 1;
    const n = parseInt(String(v), 10);
    return isNaN(n) || n < 1 ? 1 : n;
  })
  .optional();

export const CreateOrderSchema = z.object({
  platform: z.string().min(1, "Plattform ist erforderlich"),
  customer_name: z.string().optional().nullable(),
  external_order_id: z.string().optional().nullable(),
  product_id: z.string().optional().nullable(),
  variant: z.string().optional().nullable(),
  quantity: optionalPositiveInt,
  sale_price: requiredPositiveNumber,
  shipping_cost: optionalPositiveNumber,
  material_cost: optionalPositiveNumber,
  platform_fee: optionalPositiveNumber,
  status: z.enum(ORDER_STATUSES).default("ordered"),
  payment_status: z.enum(PAYMENT_STATUSES).default("pending"),
  shipping_status: z.enum(SHIPPING_STATUSES).optional().nullable(),
  tracking_number: z.string().optional().nullable(),
  order_date: z.string().min(1, "Bestelldatum ist erforderlich"),
  notes: z.string().optional().nullable(),
});

export type CreateOrderInput = z.output<typeof CreateOrderSchema>;
