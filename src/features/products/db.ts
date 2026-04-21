import { getDatabase } from '@/services/database';
import type {
  Product,
  ProductCreate,
  ProductUpdate,
  Status,
  Platform,
  LicenseRisk,
} from './schema';

// ============================================================
// Helpers
// ============================================================

function generateUUID(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

/** Serialisiert JSON-Felder für SQLite (null-safe). */
function jsonOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return JSON.stringify(value);
}

/** Parst JSON-Felder aus SQLite (null-safe). */
function parseJsonOrNull<T>(value: string | null): T | null {
  if (value === null || value === undefined) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * Mapping einer DB-Zeile auf das Product-Interface.
 * SQLite liefert JSON-Felder als Strings; hier werden sie geparst.
 */
function rowToProduct(row: Record<string, unknown>): Product {
  return {
    id: row.id as string,
    name: row.name as string,
    short_name: (row.short_name as string) ?? null,
    category: row.category as string,
    subcategory: (row.subcategory as string) ?? null,
    description_internal: (row.description_internal as string) ?? null,
    collection: (row.collection as string) ?? null,
    status: row.status as Product['status'],
    material_type: row.material_type as Product['material_type'],
    color_variants: parseJsonOrNull(row.color_variants as string | null),
    print_time_minutes: (row.print_time_minutes as number) ?? null,
    material_grams: (row.material_grams as number) ?? null,
    electricity_cost: (row.electricity_cost as number) ?? null,
    packaging_cost: (row.packaging_cost as number) ?? null,
    shipping_class: (row.shipping_class as Product['shipping_class']) ?? null,
    target_price: (row.target_price as number) ?? null,
    min_price: (row.min_price as number) ?? null,
    price_etsy: (row.price_etsy as number) ?? null,
    price_ebay: (row.price_ebay as number) ?? null,
    price_kleinanzeigen: (row.price_kleinanzeigen as number) ?? null,
    estimated_margin: (row.estimated_margin as number) ?? null,
    license_source: (row.license_source as string) ?? null,
    license_type: (row.license_type as Product['license_type']) ?? null,
    license_url: (row.license_url as string) ?? null,
    license_risk: (row.license_risk as Product['license_risk']) ?? null,
    platforms: parseJsonOrNull(row.platforms as string | null),
    notes: (row.notes as string) ?? null,
    upsell_notes: (row.upsell_notes as string) ?? null,
    primary_image_path: (row.primary_image_path as string) ?? null,
    // SQLite stores booleans as integers (0/1); null means "use global default"
    shipping_paid_by_customer:
      row.shipping_paid_by_customer === null || row.shipping_paid_by_customer === undefined
        ? null
        : Boolean(row.shipping_paid_by_customer),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    deleted_at: (row.deleted_at as string) ?? null,
  };
}

// ============================================================
// Filter-Interface für listProducts
// ============================================================

export interface ProductFilters {
  search?: string;
  status?: Status[];
  category?: string[];
  platforms?: Platform[];
  licenseRisk?: LicenseRisk[];
  marginMin?: number;
  marginMax?: number;
  includeDeleted?: boolean;
}

// ============================================================
// CRUD Operations
// ============================================================

export async function createProduct(input: ProductCreate): Promise<Product> {
  const db = getDatabase();
  const id = generateUUID();
  const timestamp = now();

  try {
    await db.execute(
      `INSERT INTO products (
        id, name, short_name, category, subcategory, description_internal,
        collection, status, material_type, color_variants, print_time_minutes,
        material_grams, electricity_cost, packaging_cost, shipping_class,
        target_price, min_price, price_etsy, price_ebay, price_kleinanzeigen,
        estimated_margin, license_source, license_type, license_url, license_risk,
        platforms, notes, upsell_notes, primary_image_path,
        created_at, updated_at, deleted_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15,
        $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25,
        $26, $27, $28, $29,
        $30, $31, $32
      )`,
      [
        id,
        input.name,
        input.short_name ?? null,
        input.category,
        input.subcategory ?? null,
        input.description_internal ?? null,
        input.collection ?? null,
        input.status,
        input.material_type,
        jsonOrNull(input.color_variants),
        input.print_time_minutes ?? null,
        input.material_grams ?? null,
        input.electricity_cost ?? null,
        input.packaging_cost ?? null,
        input.shipping_class ?? null,
        input.target_price ?? null,
        input.min_price ?? null,
        input.price_etsy ?? null,
        input.price_ebay ?? null,
        input.price_kleinanzeigen ?? null,
        null, // estimated_margin — berechnet
        input.license_source ?? null,
        input.license_type ?? null,
        input.license_url ?? null,
        input.license_risk ?? null,
        jsonOrNull(input.platforms),
        input.notes ?? null,
        input.upsell_notes ?? null,
        null, // primary_image_path — wird in Modul 03 befüllt
        timestamp,
        timestamp,
        null, // deleted_at
      ],
    );

    return (await getProduct(id))!;
  } catch (err) {
    throw new Error(
      `Produkt konnte nicht erstellt werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function updateProduct(id: string, updates: ProductUpdate): Promise<Product> {
  const db = getDatabase();
  const timestamp = now();

  // Dynamisch SET-Klausel bauen aus übergebenen Feldern
  const setClauses: string[] = ['updated_at = $1'];
  const params: unknown[] = [timestamp];
  let paramIndex = 2;

  const fieldMap: Record<string, unknown> = { ...updates };
  // JSON-Felder serialisieren
  if ('color_variants' in fieldMap) {
    fieldMap.color_variants = jsonOrNull(fieldMap.color_variants);
  }
  if ('platforms' in fieldMap) {
    fieldMap.platforms = jsonOrNull(fieldMap.platforms);
  }

  for (const [key, value] of Object.entries(fieldMap)) {
    setClauses.push(`${key} = $${paramIndex}`);
    params.push(value ?? null);
    paramIndex++;
  }

  params.push(id);

  try {
    await db.execute(
      `UPDATE products SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
      params,
    );

    const product = await getProduct(id);
    if (!product) {
      throw new Error(`Produkt mit ID ${id} nicht gefunden nach Update`);
    }
    return product;
  } catch (err) {
    throw new Error(
      `Produkt konnte nicht aktualisiert werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function deleteProduct(id: string): Promise<void> {
  const db = getDatabase();
  const timestamp = now();

  try {
    await db.execute('UPDATE products SET deleted_at = $1, updated_at = $1 WHERE id = $2', [
      timestamp,
      id,
    ]);
  } catch (err) {
    throw new Error(
      `Produkt konnte nicht gelöscht werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function restoreProduct(id: string): Promise<void> {
  const db = getDatabase();
  const timestamp = now();

  try {
    await db.execute('UPDATE products SET deleted_at = NULL, updated_at = $1 WHERE id = $2', [
      timestamp,
      id,
    ]);
  } catch (err) {
    throw new Error(
      `Produkt konnte nicht wiederhergestellt werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function hardDeleteProduct(id: string): Promise<void> {
  const db = getDatabase();

  try {
    await db.execute('DELETE FROM products WHERE id = $1', [id]);
  } catch (err) {
    throw new Error(
      `Produkt konnte nicht endgültig gelöscht werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function duplicateProduct(id: string): Promise<Product> {
  const original = await getProduct(id);
  if (!original) {
    throw new Error(`Produkt mit ID ${id} nicht gefunden`);
  }

  // Suffix "(Kopie)" oder "(Kopie N)" bestimmen
  const db = getDatabase();
  const baseName = original.name.replace(/\s*\(Kopie(?:\s+\d+)?\)$/, '');
  const existingCopies = await db.select<{ name: string }[]>(
    `SELECT name FROM products WHERE name LIKE $1 AND deleted_at IS NULL`,
    [`${baseName} (Kopie%`],
  );

  let copyName: string;
  if (existingCopies.length === 0) {
    copyName = `${baseName} (Kopie)`;
  } else {
    copyName = `${baseName} (Kopie ${existingCopies.length + 1})`;
  }

  const createInput: ProductCreate = {
    name: copyName,
    short_name: original.short_name,
    category: original.category,
    subcategory: original.subcategory,
    description_internal: original.description_internal,
    collection: original.collection,
    status: 'idea', // Status wird auf idea zurückgesetzt
    material_type: original.material_type,
    color_variants: original.color_variants,
    print_time_minutes: original.print_time_minutes,
    material_grams: original.material_grams,
    electricity_cost: original.electricity_cost,
    packaging_cost: original.packaging_cost,
    shipping_class: original.shipping_class,
    target_price: original.target_price,
    min_price: original.min_price,
    price_etsy: original.price_etsy,
    price_ebay: original.price_ebay,
    price_kleinanzeigen: original.price_kleinanzeigen,
    license_source: original.license_source,
    license_type: original.license_type,
    license_url: original.license_url,
    license_risk: original.license_risk,
    platforms: original.platforms,
    notes: original.notes,
    upsell_notes: original.upsell_notes,
    shipping_paid_by_customer: original.shipping_paid_by_customer,
  };

  return createProduct(createInput);
}

// ============================================================
// Read Operations
// ============================================================

export async function getProduct(id: string): Promise<Product | null> {
  const db = getDatabase();

  try {
    const rows = await db.select<Record<string, unknown>[]>(
      'SELECT * FROM products WHERE id = $1',
      [id],
    );
    if (rows.length === 0) return null;
    return rowToProduct(rows[0]);
  } catch (err) {
    throw new Error(
      `Produkt konnte nicht geladen werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function listProducts(filters: ProductFilters = {}): Promise<Product[]> {
  const db = getDatabase();
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  // Soft-Delete-Filter
  if (!filters.includeDeleted) {
    conditions.push('deleted_at IS NULL');
  }

  // Volltextsuche
  if (filters.search && filters.search.trim()) {
    const term = `%${filters.search.trim()}%`;
    conditions.push(
      `(name LIKE $${paramIndex} OR short_name LIKE $${paramIndex} OR description_internal LIKE $${paramIndex} OR notes LIKE $${paramIndex})`,
    );
    params.push(term);
    paramIndex++;
  }

  // Status-Filter (Multi-Select)
  if (filters.status && filters.status.length > 0) {
    const placeholders = filters.status.map(() => `$${paramIndex++}`).join(', ');
    conditions.push(`status IN (${placeholders})`);
    params.push(...filters.status);
  }

  // Kategorie-Filter
  if (filters.category && filters.category.length > 0) {
    const placeholders = filters.category.map(() => `$${paramIndex++}`).join(', ');
    conditions.push(`category IN (${placeholders})`);
    params.push(...filters.category);
  }

  // Lizenz-Risiko-Filter
  if (filters.licenseRisk && filters.licenseRisk.length > 0) {
    const placeholders = filters.licenseRisk.map(() => `$${paramIndex++}`).join(', ');
    conditions.push(`license_risk IN (${placeholders})`);
    params.push(...filters.licenseRisk);
  }

  // Marge-Filter
  if (filters.marginMin !== undefined) {
    conditions.push(`estimated_margin >= $${paramIndex}`);
    params.push(filters.marginMin);
    paramIndex++;
  }
  if (filters.marginMax !== undefined) {
    conditions.push(`estimated_margin <= $${paramIndex}`);
    params.push(filters.marginMax);
    paramIndex++;
  }

  // Plattform-Filter (JSON-Array, LIKE-basiert)
  if (filters.platforms && filters.platforms.length > 0) {
    const platformConditions = filters.platforms.map(() => {
      const placeholder = `$${paramIndex++}`;
      return `platforms LIKE ${placeholder}`;
    });
    conditions.push(`(${platformConditions.join(' OR ')})`);
    params.push(...filters.platforms.map((p) => `%"${p}"%`));
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const rows = await db.select<Record<string, unknown>[]>(
      `SELECT * FROM products ${whereClause} ORDER BY updated_at DESC`,
      params,
    );
    return rows.map(rowToProduct);
  } catch (err) {
    throw new Error(
      `Produktliste konnte nicht geladen werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ============================================================
// Bulk Operations
// ============================================================

export async function bulkDeleteProducts(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = getDatabase();
  const timestamp = now();

  try {
    const placeholders = ids.map((_, i) => `$${i + 2}`).join(', ');
    await db.execute(
      `UPDATE products SET deleted_at = $1, updated_at = $1 WHERE id IN (${placeholders})`,
      [timestamp, ...ids],
    );
  } catch (err) {
    throw new Error(
      `Bulk-Löschung fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function bulkUpdateStatus(ids: string[], status: Status): Promise<void> {
  if (ids.length === 0) return;
  const db = getDatabase();
  const timestamp = now();

  try {
    const placeholders = ids.map((_, i) => `$${i + 3}`).join(', ');
    await db.execute(
      `UPDATE products SET status = $1, updated_at = $2 WHERE id IN (${placeholders})`,
      [status, timestamp, ...ids],
    );
  } catch (err) {
    throw new Error(
      `Bulk-Statusänderung fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function bulkDuplicateProducts(ids: string[]): Promise<Product[]> {
  const results: Product[] = [];
  for (const id of ids) {
    const dup = await duplicateProduct(id);
    results.push(dup);
  }
  return results;
}

export async function listTrashedProducts(): Promise<Product[]> {
  const db = getDatabase();

  try {
    const rows = await db.select<Record<string, unknown>[]>(
      'SELECT * FROM products WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC',
    );
    return rows.map(rowToProduct);
  } catch (err) {
    throw new Error(
      `Papierkorb konnte nicht geladen werden: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
