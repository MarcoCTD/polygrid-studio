import { getDb, parseJsonArray, toJsonString, now } from "../db";
import type { Listing, CreateListingInput } from "@/features/listings/types";

interface ListingRow {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  product_id: string;
  platform: string;
  title: string;
  short_description: string | null;
  long_description: string | null;
  bullet_points: string | null;
  tags: string | null;
  price: number;
  variants: string | null;
  shipping_info: string | null;
  processing_time_days: number | null;
  status: string;
  language: string;
  seo_notes: string | null;
  platform_specific_notes: string | null;
}

function rowToListing(row: ListingRow): Listing {
  return {
    ...row,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Zod cast at query boundary
    status: row.status as any,
    bullet_points: parseJsonArray<string>(row.bullet_points),
    tags: parseJsonArray<string>(row.tags),
    variants: parseJsonArray<string>(row.variants),
  };
}

export async function listListings(): Promise<Listing[]> {
  const db = await getDb();
  const rows = await db.select<ListingRow[]>(
    "SELECT * FROM listings WHERE deleted_at IS NULL ORDER BY created_at DESC"
  );
  return rows.map(rowToListing);
}

export async function getListing(id: string): Promise<Listing | null> {
  const db = await getDb();
  const rows = await db.select<ListingRow[]>(
    "SELECT * FROM listings WHERE id = ? AND deleted_at IS NULL",
    [id]
  );
  return rows.length > 0 ? rowToListing(rows[0]) : null;
}

export async function createListing(input: CreateListingInput): Promise<Listing> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const ts = now();

  await db.execute(
    `INSERT INTO listings (
      id, created_at, updated_at,
      product_id, platform, title, short_description, long_description,
      price, status, language, processing_time_days,
      shipping_info, seo_notes, platform_specific_notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, ts, ts,
      input.product_id,
      input.platform,
      input.title,
      input.short_description ?? null,
      input.long_description ?? null,
      input.price,
      input.status,
      input.language,
      input.processing_time_days ?? null,
      input.shipping_info ?? null,
      input.seo_notes ?? null,
      input.platform_specific_notes ?? null,
    ]
  );

  const listing = await getListing(id);
  if (!listing) throw new Error("Listing creation failed");
  return listing;
}

export async function updateListing(
  id: string,
  patch: Partial<CreateListingInput> & {
    bullet_points?: string[];
    tags?: string[];
    variants?: string[];
  }
): Promise<Listing> {
  const db = await getDb();
  const ts = now();

  const fields: string[] = [];
  const values: unknown[] = [];

  const add = (col: string, val: unknown) => {
    fields.push(`${col} = ?`);
    values.push(val ?? null);
  };

  if (patch.product_id !== undefined) add("product_id", patch.product_id);
  if (patch.platform !== undefined) add("platform", patch.platform);
  if (patch.title !== undefined) add("title", patch.title);
  if (patch.short_description !== undefined) add("short_description", patch.short_description);
  if (patch.long_description !== undefined) add("long_description", patch.long_description);
  if (patch.price !== undefined) add("price", patch.price);
  if (patch.status !== undefined) add("status", patch.status);
  if (patch.language !== undefined) add("language", patch.language);
  if (patch.processing_time_days !== undefined) add("processing_time_days", patch.processing_time_days);
  if (patch.shipping_info !== undefined) add("shipping_info", patch.shipping_info);
  if (patch.seo_notes !== undefined) add("seo_notes", patch.seo_notes);
  if (patch.platform_specific_notes !== undefined) add("platform_specific_notes", patch.platform_specific_notes);
  if (patch.bullet_points !== undefined) add("bullet_points", toJsonString(patch.bullet_points));
  if (patch.tags !== undefined) add("tags", toJsonString(patch.tags));
  if (patch.variants !== undefined) add("variants", toJsonString(patch.variants));

  if (fields.length === 0) {
    const l = await getListing(id);
    if (!l) throw new Error("Listing not found");
    return l;
  }

  fields.push("updated_at = ?");
  values.push(ts, id);

  await db.execute(
    `UPDATE listings SET ${fields.join(", ")} WHERE id = ?`,
    values
  );

  const listing = await getListing(id);
  if (!listing) throw new Error("Listing not found after update");
  return listing;
}

export async function softDeleteListing(id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE listings SET deleted_at = ?, updated_at = ? WHERE id = ?",
    [now(), now(), id]
  );
}
