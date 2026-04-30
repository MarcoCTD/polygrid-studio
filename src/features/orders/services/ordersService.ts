import { getDatabase } from '@/services/database';
import { listProducts } from '@/features/products/db';
import { getProductSettings } from '@/features/products/settings';
import type { Product } from '@/features/products/schema';
import {
  NewOrderSchema,
  OrderEventSchema,
  OrderSchema,
  UpdateOrderSchema,
  type NewOrderInput,
  type Order,
  type OrderEvent,
  type OrderEventType,
  type OrderFilters,
  type OrderListItem,
  type OrderPlatform,
  type OrderStatus,
  type UpdateOrderInput,
} from '../types';
import { generateReceiptNumber } from './receiptNumber';

const OPEN_ORDER_STATUSES: OrderStatus[] = ['ordered', 'paid', 'in_production', 'shipped'];

const UPDATE_FIELDS = [
  'external_order_id',
  'customer_name',
  'platform',
  'product_id',
  'variant',
  'quantity',
  'sale_price',
  'shipping_revenue',
  'shipping_cost',
  'material_cost',
  'platform_fee',
  'payout_amount',
  'status',
  'payment_status',
  'payment_received_date',
  'shipping_status',
  'tracking_number',
  'order_date',
  'notes',
  'bank_match_id',
] satisfies (keyof UpdateOrderInput)[];
const UPDATE_FIELD_SET = new Set<string>(UPDATE_FIELDS);

type OrderRow = Record<string, unknown>;
type Db = ReturnType<typeof getDatabase>;

export interface BankTransactionMatch {
  id: string;
  transaction_date: string;
  amount: number;
  description: string;
  counterparty_name: string | null;
  match_confidence: string | null;
}

function now(): string {
  return new Date().toISOString();
}

function dateYear(isoDate: string): number {
  return Number.parseInt(isoDate.slice(0, 4), 10);
}

function rowToOrder(row: OrderRow): Order {
  return OrderSchema.parse({
    id: row.id,
    receipt_number: row.receipt_number,
    external_order_id: row.external_order_id ?? null,
    customer_name: row.customer_name ?? null,
    platform: row.platform,
    product_id: row.product_id ?? null,
    variant: row.variant ?? null,
    quantity: row.quantity,
    sale_price: row.sale_price,
    shipping_revenue: row.shipping_revenue ?? null,
    shipping_cost: row.shipping_cost ?? null,
    material_cost: row.material_cost ?? null,
    platform_fee: row.platform_fee ?? null,
    payout_amount: row.payout_amount ?? null,
    status: row.status,
    payment_status: row.payment_status,
    payment_received_date: row.payment_received_date ?? null,
    shipping_status: row.shipping_status ?? null,
    tracking_number: row.tracking_number ?? null,
    order_date: row.order_date,
    notes: row.notes ?? null,
    tax_locked: Boolean(row.tax_locked),
    bank_match_id: row.bank_match_id ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at ?? null,
  });
}

function rowToOrderListItem(row: OrderRow): OrderListItem {
  return {
    ...rowToOrder(row),
    product_name: (row.product_name as string | null | undefined) ?? null,
  };
}

function rowToOrderEvent(row: OrderRow): OrderEvent {
  return OrderEventSchema.parse({
    id: row.id,
    order_id: row.order_id,
    event_type: row.event_type,
    from_value: row.from_value ?? null,
    to_value: row.to_value ?? null,
    created_at: row.created_at,
  });
}

async function createOrderEvent(
  db: Db,
  orderId: string,
  eventType: OrderEventType,
  fromValue: string | null,
  toValue: string | null,
  timestamp = now(),
): Promise<void> {
  await db.execute(
    `INSERT INTO order_events (
      id, order_id, event_type, from_value, to_value, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6)`,
    [crypto.randomUUID(), orderId, eventType, fromValue, toValue, timestamp],
  );
}

function eventChanges(
  existing: Order,
  data: UpdateOrderInput,
): {
  event_type: OrderEventType;
  from_value: string | null;
  to_value: string | null;
}[] {
  const events: {
    event_type: OrderEventType;
    from_value: string | null;
    to_value: string | null;
  }[] = [];

  if (data.status !== undefined && data.status !== existing.status) {
    events.push({
      event_type: 'status_change',
      from_value: existing.status,
      to_value: data.status,
    });
  }

  if (data.tracking_number !== undefined && data.tracking_number !== existing.tracking_number) {
    events.push({
      event_type: 'tracking_added',
      from_value: existing.tracking_number,
      to_value: data.tracking_number ?? null,
    });
  }

  if (data.notes !== undefined && data.notes !== existing.notes) {
    events.push({
      event_type: 'note_added',
      from_value: existing.notes,
      to_value: data.notes ?? null,
    });
  }

  return events;
}

function createPlaceholders(start: number, count: number): string {
  return Array.from({ length: count }, (_, index) => `$${start + index}`).join(', ');
}

function buildOrderWhere(filters?: OrderFilters): { where: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (!filters?.showDeleted) {
    clauses.push('o.deleted_at IS NULL');
  }

  if (filters?.status && filters.status.length > 0) {
    clauses.push(`o.status IN (${createPlaceholders(params.length + 1, filters.status.length)})`);
    params.push(...filters.status);
  }

  if (filters?.platform && filters.platform.length > 0) {
    clauses.push(
      `o.platform IN (${createPlaceholders(params.length + 1, filters.platform.length)})`,
    );
    params.push(...filters.platform);
  }

  if (filters?.dateFrom) {
    params.push(filters.dateFrom);
    clauses.push(`o.order_date >= $${params.length}`);
  }

  if (filters?.dateTo) {
    params.push(filters.dateTo);
    clauses.push(`o.order_date <= $${params.length}`);
  }

  if (filters?.taxLocked !== undefined) {
    params.push(filters.taxLocked ? 1 : 0);
    clauses.push(`o.tax_locked = $${params.length}`);
  }

  return {
    where: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

async function getProductMaterialCost(
  productId: string | null | undefined,
): Promise<number | null> {
  if (!productId) return null;

  const products = await listProducts({ includeDeleted: false });
  const product = products.find((item) => item.id === productId);
  if (!product?.material_grams) return null;

  const settings = await getProductSettings();
  const pricePerKg = settings.filamentPrices[product.material_type] ?? 0;
  return Number(((product.material_grams * pricePerKg) / 1000).toFixed(2));
}

async function getPlatformFee(platform: OrderPlatform, salePrice: number): Promise<number | null> {
  if (platform === 'direkt') return null;
  const settings = await getProductSettings();
  const fee = settings.platformFees[platform];
  if (!fee) return null;
  return Number(((salePrice * fee.percent) / 100 + fee.fixed).toFixed(2));
}

export async function createOrder(data: NewOrderInput): Promise<Order> {
  try {
    const input = NewOrderSchema.parse(data);
    const db = getDatabase();
    const id = crypto.randomUUID();
    const timestamp = now();
    const receiptNumber =
      input.receipt_number ?? (await generateReceiptNumber(db, dateYear(input.order_date)));
    const status = input.status ?? (input.payment_received_date ? 'paid' : 'ordered');
    const paymentStatus =
      input.payment_status ?? (input.payment_received_date ? 'paid' : 'pending');
    const shippingStatus = input.shipping_status ?? 'not_shipped';

    await db.execute('BEGIN IMMEDIATE');
    try {
      await db.execute(
        `INSERT INTO orders (
        id, receipt_number, external_order_id, customer_name, platform,
        product_id, variant, quantity, sale_price, shipping_revenue,
        shipping_cost, material_cost, platform_fee, payout_amount, status,
        payment_status, payment_received_date, shipping_status, tracking_number,
        order_date, notes, tax_locked, bank_match_id, created_at, updated_at, deleted_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19,
        $20, $21, $22, $23, $24, $25, $26
      )`,
        [
          id,
          receiptNumber,
          input.external_order_id ?? null,
          input.customer_name ?? null,
          input.platform,
          input.product_id ?? null,
          input.variant ?? null,
          input.quantity ?? 1,
          input.sale_price,
          input.shipping_revenue ?? null,
          input.shipping_cost ?? null,
          input.material_cost ?? (await getProductMaterialCost(input.product_id)),
          input.platform_fee ?? (await getPlatformFee(input.platform, input.sale_price)),
          input.payout_amount ?? null,
          status,
          paymentStatus,
          input.payment_received_date ?? null,
          shippingStatus,
          input.tracking_number ?? null,
          input.order_date,
          input.notes ?? null,
          input.tax_locked ? 1 : 0,
          input.bank_match_id ?? null,
          timestamp,
          timestamp,
          null,
        ],
      );
      await createOrderEvent(db, id, 'status_change', null, status, timestamp);
      await db.execute('COMMIT');
    } catch (error) {
      await db.execute('ROLLBACK');
      throw error;
    }

    const order = await getOrderById(id);
    if (!order) throw new Error('Auftrag wurde nach dem Erstellen nicht gefunden.');
    return order;
  } catch (error) {
    throw new Error(
      `Auftrag konnte nicht erstellt werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function updateOrder(id: string, data: UpdateOrderInput): Promise<Order> {
  try {
    const existing = await getOrderById(id);
    if (!existing) throw new Error(`Auftrag ${id} nicht gefunden.`);

    UpdateOrderSchema.parse({ ...data, id, tax_locked: existing.tax_locked });

    const updates = Object.entries(data).filter(
      ([key, value]) => value !== undefined && UPDATE_FIELD_SET.has(key),
    );

    if (updates.length === 0) return existing;

    const timestamp = now();
    const setClauses = ['updated_at = $1'];
    const params: unknown[] = [timestamp];

    updates.forEach(([key, value], index) => {
      setClauses.push(`${key} = $${index + 2}`);
      params.push(value ?? null);
    });

    params.push(id);
    const db = getDatabase();
    const events = eventChanges(existing, data);

    await db.execute('BEGIN IMMEDIATE');
    try {
      await db.execute(
        `UPDATE orders SET ${setClauses.join(', ')} WHERE id = $${params.length}`,
        params,
      );

      for (const event of events) {
        await createOrderEvent(
          db,
          id,
          event.event_type,
          event.from_value,
          event.to_value,
          timestamp,
        );
      }

      await db.execute('COMMIT');
    } catch (error) {
      await db.execute('ROLLBACK');
      throw error;
    }

    const updated = await getOrderById(id);
    if (!updated) throw new Error(`Auftrag ${id} nicht gefunden nach Update.`);
    return updated;
  } catch (error) {
    throw new Error(
      `Auftrag konnte nicht aktualisiert werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function getOrderEvents(orderId: string): Promise<OrderEvent[]> {
  try {
    const rows = await getDatabase().select<OrderRow[]>(
      `SELECT *
       FROM order_events
       WHERE order_id = $1
       ORDER BY created_at ASC`,
      [orderId],
    );
    return rows.map(rowToOrderEvent);
  } catch (error) {
    throw new Error(
      `Auftrags-Timeline konnte nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function getBankTransactionMatch(
  bankTransactionId: string,
): Promise<BankTransactionMatch | null> {
  try {
    const rows = await getDatabase().select<OrderRow[]>(
      `SELECT id, transaction_date, amount, description, counterparty_name, match_confidence
       FROM bank_transactions
       WHERE id = $1
       LIMIT 1`,
      [bankTransactionId],
    );
    const row = rows[0];
    if (!row) return null;

    return {
      id: row.id as string,
      transaction_date: row.transaction_date as string,
      amount: row.amount as number,
      description: row.description as string,
      counterparty_name: (row.counterparty_name as string | null | undefined) ?? null,
      match_confidence: (row.match_confidence as string | null | undefined) ?? null,
    };
  } catch (error) {
    throw new Error(
      `Bank-Match konnte nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function softDeleteOrder(id: string): Promise<void> {
  try {
    const existing = await getOrderById(id);
    if (!existing) throw new Error(`Auftrag ${id} nicht gefunden.`);
    if (existing.tax_locked) {
      throw new Error('Steuerlich gesperrte Aufträge können nicht gelöscht werden.');
    }

    const timestamp = now();
    await getDatabase().execute(
      'UPDATE orders SET deleted_at = $1, updated_at = $2 WHERE id = $3',
      [timestamp, timestamp, id],
    );
  } catch (error) {
    throw new Error(
      `Auftrag konnte nicht gelöscht werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function getOrders(filters?: OrderFilters): Promise<OrderListItem[]> {
  try {
    const { where, params } = buildOrderWhere(filters);
    const rows = await getDatabase().select<OrderRow[]>(
      `SELECT o.*, p.name AS product_name
       FROM orders o
       LEFT JOIN products p ON p.id = o.product_id
       ${where}
       ORDER BY o.order_date DESC, o.receipt_number DESC`,
      params,
    );

    return rows.map(rowToOrderListItem);
  } catch (error) {
    throw new Error(
      `Aufträge konnten nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function getOrderById(id: string): Promise<Order | null> {
  try {
    const rows = await getDatabase().select<OrderRow[]>(
      `SELECT o.*, p.name AS product_name
       FROM orders o
       LEFT JOIN products p ON p.id = o.product_id
       WHERE o.id = $1
       LIMIT 1`,
      [id],
    );
    return rows[0] ? rowToOrder(rows[0]) : null;
  } catch (error) {
    throw new Error(
      `Auftrag konnte nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function getOpenOrdersCount(): Promise<number> {
  try {
    const rows = await getDatabase().select<{ count: number }[]>(
      `SELECT COUNT(*) AS count
       FROM orders
       WHERE deleted_at IS NULL
         AND status IN (${OPEN_ORDER_STATUSES.map((_, index) => `$${index + 1}`).join(', ')})`,
      OPEN_ORDER_STATUSES,
    );
    return rows[0]?.count ?? 0;
  } catch (error) {
    throw new Error(
      `Offene Aufträge konnten nicht gezählt werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function getActiveProductsForOrders(): Promise<Product[]> {
  try {
    return await listProducts({ includeDeleted: false });
  } catch (error) {
    throw new Error(
      `Produkte konnten nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function estimateOrderCosts(
  product: Product | null,
  platform: OrderPlatform,
  salePrice: number,
): Promise<{ material_cost: number | null; platform_fee: number | null }> {
  try {
    const settings = await getProductSettings();
    const materialCost =
      product?.material_grams && product.material_type
        ? Number(
            (
              (product.material_grams * (settings.filamentPrices[product.material_type] ?? 0)) /
              1000
            ).toFixed(2),
          )
        : null;
    const fee =
      platform === 'direkt'
        ? null
        : (settings.platformFees[platform]?.percent ?? 0) * (salePrice / 100) +
          (settings.platformFees[platform]?.fixed ?? 0);

    return {
      material_cost: materialCost,
      platform_fee: fee === null ? null : Number(fee.toFixed(2)),
    };
  } catch (error) {
    throw new Error(
      `Kosten konnten nicht berechnet werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
