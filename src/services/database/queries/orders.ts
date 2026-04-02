import { dbExecute, dbSelect, now } from "../db";
import type { Order, CreateOrderInput } from "@/features/orders/types";

interface OrderRow {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  external_order_id: string | null;
  customer_name: string | null;
  platform: string;
  product_id: string | null;
  variant: string | null;
  quantity: number;
  sale_price: number;
  shipping_cost: number | null;
  material_cost: number | null;
  platform_fee: number | null;
  status: string;
  payment_status: string;
  shipping_status: string | null;
  tracking_number: string | null;
  order_date: string;
  notes: string | null;
}

function rowToOrder(row: OrderRow): Order {
  return {
    ...row,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Zod cast at query boundary
    status: row.status as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payment_status: row.payment_status as any,
  };
}

export async function listOrders(): Promise<Order[]> {
  const rows = await dbSelect<OrderRow[]>(
    "SELECT * FROM orders WHERE deleted_at IS NULL ORDER BY order_date DESC, created_at DESC",
    [],
    "orders.list"
  );
  return rows.map(rowToOrder);
}

export async function getOrder(id: string): Promise<Order | null> {
  const rows = await dbSelect<OrderRow[]>(
    "SELECT * FROM orders WHERE id = ? AND deleted_at IS NULL",
    [id],
    "orders.get"
  );
  return rows.length > 0 ? rowToOrder(rows[0]) : null;
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const id = crypto.randomUUID();
  const ts = now();

  await dbExecute(
    `INSERT INTO orders (
      id, created_at, updated_at,
      external_order_id, customer_name, platform, product_id, variant,
      quantity, sale_price, shipping_cost, material_cost, platform_fee,
      status, payment_status, shipping_status, tracking_number,
      order_date, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, ts, ts,
      input.external_order_id ?? null,
      input.customer_name ?? null,
      input.platform,
      input.product_id ?? null,
      input.variant ?? null,
      input.quantity ?? 1,
      input.sale_price,
      input.shipping_cost ?? null,
      input.material_cost ?? null,
      input.platform_fee ?? null,
      input.status,
      input.payment_status,
      input.shipping_status ?? null,
      input.tracking_number ?? null,
      input.order_date,
      input.notes ?? null,
    ],
    "orders.create"
  );

  const order = await getOrder(id);
  if (!order) throw new Error("Order creation failed");
  return order;
}

export async function updateOrder(
  id: string,
  patch: Partial<CreateOrderInput>
): Promise<Order> {
  const ts = now();

  const fields: string[] = [];
  const values: unknown[] = [];

  const add = (col: string, val: unknown) => {
    fields.push(`${col} = ?`);
    values.push(val ?? null);
  };

  if (patch.external_order_id !== undefined) add("external_order_id", patch.external_order_id);
  if (patch.customer_name !== undefined) add("customer_name", patch.customer_name);
  if (patch.platform !== undefined) add("platform", patch.platform);
  if (patch.product_id !== undefined) add("product_id", patch.product_id);
  if (patch.variant !== undefined) add("variant", patch.variant);
  if (patch.quantity !== undefined) add("quantity", patch.quantity);
  if (patch.sale_price !== undefined) add("sale_price", patch.sale_price);
  if (patch.shipping_cost !== undefined) add("shipping_cost", patch.shipping_cost);
  if (patch.material_cost !== undefined) add("material_cost", patch.material_cost);
  if (patch.platform_fee !== undefined) add("platform_fee", patch.platform_fee);
  if (patch.status !== undefined) add("status", patch.status);
  if (patch.payment_status !== undefined) add("payment_status", patch.payment_status);
  if (patch.shipping_status !== undefined) add("shipping_status", patch.shipping_status);
  if (patch.tracking_number !== undefined) add("tracking_number", patch.tracking_number);
  if (patch.order_date !== undefined) add("order_date", patch.order_date);
  if (patch.notes !== undefined) add("notes", patch.notes);

  if (fields.length === 0) {
    const o = await getOrder(id);
    if (!o) throw new Error("Order not found");
    return o;
  }

  fields.push("updated_at = ?");
  values.push(ts, id);

  await dbExecute(
    `UPDATE orders SET ${fields.join(", ")} WHERE id = ?`,
    values,
    "orders.update"
  );

  const order = await getOrder(id);
  if (!order) throw new Error("Order not found after update");
  return order;
}

export async function softDeleteOrder(id: string): Promise<void> {
  await dbExecute(
    "UPDATE orders SET deleted_at = ?, updated_at = ? WHERE id = ?",
    [now(), now(), id],
    "orders.delete"
  );
}
