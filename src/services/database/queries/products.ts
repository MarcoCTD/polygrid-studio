import { dbExecute, dbSelect, parseJsonArray, toJsonString, now } from "../db";
import type { Product, CreateProductInput } from "@/features/products/types";

// ── Row type from SQLite (all values are primitives) ─────────────────────────
interface ProductRow {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  name: string;
  short_name: string | null;
  category: string;
  subcategory: string | null;
  description_internal: string | null;
  collection: string | null;
  status: string;
  material_type: string;
  color_variants: string | null;
  print_time_minutes: number | null;
  material_grams: number | null;
  electricity_cost: number | null;
  packaging_cost: number | null;
  shipping_class: string | null;
  target_price: number | null;
  min_price: number | null;
  estimated_margin: number | null;
  upsell_notes: string | null;
  license_source: string | null;
  license_type: string | null;
  license_url: string | null;
  license_risk: string | null;
  platforms: string | null;
  notes: string | null;
}

function rowToProduct(row: ProductRow): Product {
  return {
    ...row,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Zod cast at query boundary
    status: row.status as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    material_type: row.material_type as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    license_type: (row.license_type as any) ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    license_risk: (row.license_risk as any) ?? null,
    color_variants: parseJsonArray<string>(row.color_variants),
    platforms: parseJsonArray<string>(row.platforms),
  };
}

export async function listProducts(): Promise<Product[]> {
  const rows = await dbSelect<ProductRow[]>(
    "SELECT * FROM products WHERE deleted_at IS NULL ORDER BY created_at DESC",
    [],
    "products.list"
  );
  return rows.map(rowToProduct);
}

export async function getProduct(id: string): Promise<Product | null> {
  const rows = await dbSelect<ProductRow[]>(
    "SELECT * FROM products WHERE id = ? AND deleted_at IS NULL",
    [id],
    "products.get"
  );
  return rows.length > 0 ? rowToProduct(rows[0]) : null;
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  const id = crypto.randomUUID();
  const ts = now();

  await dbExecute(
    `INSERT INTO products (
      id, created_at, updated_at,
      name, short_name, category, material_type, status,
      description_internal, target_price, min_price,
      print_time_minutes, material_grams, packaging_cost,
      shipping_class, license_risk, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, ts, ts,
      input.name,
      input.short_name ?? null,
      input.category,
      input.material_type,
      input.status,
      input.description_internal ?? null,
      input.target_price ?? null,
      input.min_price ?? null,
      input.print_time_minutes ?? null,
      input.material_grams ?? null,
      input.packaging_cost ?? null,
      input.shipping_class ?? null,
      input.license_risk ?? null,
      input.notes ?? null,
    ],
    "products.create"
  );

  const product = await getProduct(id);
  if (!product) throw new Error("Product creation failed");
  return product;
}

export async function updateProduct(
  id: string,
  patch: Partial<CreateProductInput> & { estimated_margin?: number | null; platforms?: string[] }
): Promise<Product> {
  const ts = now();

  const fields: string[] = [];
  const values: unknown[] = [];

  const add = (col: string, val: unknown) => {
    fields.push(`${col} = ?`);
    values.push(val ?? null);
  };

  if (patch.name !== undefined) add("name", patch.name);
  if (patch.short_name !== undefined) add("short_name", patch.short_name);
  if (patch.category !== undefined) add("category", patch.category);
  if (patch.material_type !== undefined) add("material_type", patch.material_type);
  if (patch.status !== undefined) add("status", patch.status);
  if (patch.description_internal !== undefined) add("description_internal", patch.description_internal);
  if (patch.target_price !== undefined) add("target_price", patch.target_price);
  if (patch.min_price !== undefined) add("min_price", patch.min_price);
  if (patch.print_time_minutes !== undefined) add("print_time_minutes", patch.print_time_minutes);
  if (patch.material_grams !== undefined) add("material_grams", patch.material_grams);
  if (patch.packaging_cost !== undefined) add("packaging_cost", patch.packaging_cost);
  if (patch.shipping_class !== undefined) add("shipping_class", patch.shipping_class);
  if (patch.license_risk !== undefined) add("license_risk", patch.license_risk);
  if (patch.notes !== undefined) add("notes", patch.notes);
  if (patch.estimated_margin !== undefined) add("estimated_margin", patch.estimated_margin);
  if (patch.platforms !== undefined) add("platforms", toJsonString(patch.platforms));

  if (fields.length === 0) {
    const p = await getProduct(id);
    if (!p) throw new Error("Product not found");
    return p;
  }

  fields.push("updated_at = ?");
  values.push(ts, id);

  await dbExecute(
    `UPDATE products SET ${fields.join(", ")} WHERE id = ?`,
    values,
    "products.update"
  );

  const product = await getProduct(id);
  if (!product) throw new Error("Product not found after update");
  return product;
}

export async function softDeleteProduct(id: string): Promise<void> {
  await dbExecute(
    "UPDATE products SET deleted_at = ?, updated_at = ? WHERE id = ?",
    [now(), now(), id],
    "products.delete"
  );
}
