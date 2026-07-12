import { z } from 'zod';

export const OrderStatusEnum = z.enum([
  'inquiry',
  'ordered',
  'confirmed',
  'in_production',
  'shipped',
  'completed',
  'issue',
  'cancelled',
]);

export const PaymentStatusEnum = z.enum(['pending', 'paid', 'refunded', 'disputed']);
export const ShippingStatusEnum = z.enum(['not_shipped', 'shipped', 'delivered', 'returned']);
export const OrderPlatformEnum = z.enum(['etsy', 'ebay', 'kleinanzeigen', 'direkt', 'website']);
export const OrderEventTypeEnum = z.enum(['status_change', 'note_added', 'tracking_added']);

export const ORDER_STATUS_LABELS: Record<z.infer<typeof OrderStatusEnum>, string> = {
  inquiry: 'Anfrage',
  ordered: 'Bestellt',
  confirmed: 'Angenommen',
  in_production: 'Produktion',
  shipped: 'Versendet',
  completed: 'Abgeschlossen',
  issue: 'Problem',
  cancelled: 'Storniert',
};

/** Statusoptionen in der üblichen Reihenfolge (Badges, Inline-Wechsel). */
export const ORDER_STATUS_OPTIONS = OrderStatusEnum.options.map((value) => ({
  value,
  label: ORDER_STATUS_LABELS[value],
}));

const uuid = z.string().uuid();
const nullableUuid = uuid.nullable();
const nullableText = z.string().trim().nullable();
const optionalNullableText = z.string().trim().nullable().optional();
const isoDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Datum muss im ISO-Format sein');
const receiptNumber = z.string().regex(/^\d{4}-\d{4,}$/, 'Belegnummer muss Format YYYY-NNNN haben');
const nonNegativeAmount = z.number().min(0);

export const OrderSchema = z.object({
  id: uuid,
  receipt_number: receiptNumber,
  external_order_id: nullableText,
  customer_name: nullableText,
  platform: OrderPlatformEnum,
  product_id: nullableUuid,
  variant: nullableText,
  quantity: z.number().int().positive(),
  sale_price: nonNegativeAmount,
  shipping_revenue: nonNegativeAmount.nullable(),
  shipping_cost: nonNegativeAmount.nullable(),
  material_cost: nonNegativeAmount.nullable(),
  platform_fee: nonNegativeAmount.nullable(),
  payout_amount: nonNegativeAmount.nullable(),
  status: OrderStatusEnum,
  payment_status: PaymentStatusEnum,
  payment_received_date: isoDateString.nullable(),
  shipping_status: ShippingStatusEnum.nullable(),
  tracking_number: nullableText,
  order_date: isoDateString,
  notes: nullableText,
  tax_locked: z.boolean(),
  bank_match_id: nullableUuid,
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
  deleted_at: z.string().nullable(),
});

export const NewOrderSchema = z.object({
  receipt_number: receiptNumber.optional(),
  external_order_id: optionalNullableText,
  customer_name: optionalNullableText,
  platform: OrderPlatformEnum,
  product_id: nullableUuid.optional(),
  variant: optionalNullableText,
  quantity: z.number().int().positive().optional(),
  sale_price: nonNegativeAmount,
  shipping_revenue: nonNegativeAmount.nullable().optional(),
  shipping_cost: nonNegativeAmount.nullable().optional(),
  material_cost: nonNegativeAmount.nullable().optional(),
  platform_fee: nonNegativeAmount.nullable().optional(),
  payout_amount: nonNegativeAmount.nullable().optional(),
  status: OrderStatusEnum.optional(),
  payment_status: PaymentStatusEnum.optional(),
  payment_received_date: isoDateString.nullable().optional(),
  shipping_status: ShippingStatusEnum.nullable().optional(),
  tracking_number: optionalNullableText,
  order_date: isoDateString,
  notes: optionalNullableText,
  tax_locked: z.boolean().optional(),
  bank_match_id: nullableUuid.optional(),
});

const LOCKED_ALLOWED_FIELDS = new Set([
  'id',
  'tax_locked',
  'notes',
  'bank_match_id',
  'tracking_number',
  'status',
]);

export const UpdateOrderSchema = NewOrderSchema.partial()
  .extend({
    id: uuid,
    tax_locked: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.tax_locked !== true) return;

    for (const key of Object.keys(data)) {
      if (!LOCKED_ALLOWED_FIELDS.has(key)) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message:
            'Steuerlich gesperrte Aufträge erlauben nur Notizen, Bank-Match, Tracking und Storno.',
        });
      }
    }

    if (data.status !== undefined && data.status !== 'cancelled') {
      ctx.addIssue({
        code: 'custom',
        path: ['status'],
        message: 'Steuerlich gesperrte Aufträge dürfen nur auf cancelled gesetzt werden.',
      });
    }
  });

export const OrderEventSchema = z.object({
  id: uuid,
  order_id: uuid,
  event_type: OrderEventTypeEnum,
  from_value: nullableText,
  to_value: nullableText,
  created_at: z.string().min(1),
});

export type OrderStatus = z.infer<typeof OrderStatusEnum>;
export type PaymentStatus = z.infer<typeof PaymentStatusEnum>;
export type ShippingStatus = z.infer<typeof ShippingStatusEnum>;
export type OrderPlatform = z.infer<typeof OrderPlatformEnum>;
export type OrderEventType = z.infer<typeof OrderEventTypeEnum>;
export type Order = z.infer<typeof OrderSchema>;
export type NewOrder = z.infer<typeof NewOrderSchema>;
export type UpdateOrder = z.infer<typeof UpdateOrderSchema>;
export type OrderEvent = z.infer<typeof OrderEventSchema>;

export type NewOrderInput = NewOrder;
export type UpdateOrderInput = Omit<UpdateOrder, 'id' | 'tax_locked'>;

export interface OrderFilters {
  status?: OrderStatus[];
  platform?: OrderPlatform[];
  dateFrom?: string;
  dateTo?: string;
  showDeleted?: boolean;
  taxLocked?: boolean;
}

export interface OrderListItem extends Order {
  product_name: string | null;
}
