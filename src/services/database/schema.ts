import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';

// ============================================================
// 1. app_settings (Modul 01) – keine Abhängigkeiten
// ============================================================
export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updated_at: text('updated_at').notNull(),
});

// ============================================================
// 2. products (Modul 02) – keine FKs
// ============================================================
export const products = sqliteTable(
  'products',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    short_name: text('short_name'),
    category: text('category').notNull(),
    subcategory: text('subcategory'),
    description_internal: text('description_internal'),
    collection: text('collection'),
    status: text('status').notNull(),
    material_type: text('material_type').notNull(),
    color_variants: text('color_variants', { mode: 'json' }).$type<
      { name: string; hex: string }[]
    >(),
    print_time_minutes: integer('print_time_minutes'),
    material_grams: real('material_grams'),
    electricity_cost: real('electricity_cost'),
    packaging_cost: real('packaging_cost'),
    shipping_class: text('shipping_class'),
    target_price: real('target_price'),
    min_price: real('min_price'),
    price_etsy: real('price_etsy'),
    price_ebay: real('price_ebay'),
    price_kleinanzeigen: real('price_kleinanzeigen'),
    estimated_margin: real('estimated_margin'),
    license_source: text('license_source'),
    license_type: text('license_type'),
    license_url: text('license_url'),
    license_risk: text('license_risk'),
    platforms: text('platforms', { mode: 'json' }).$type<string[]>(),
    notes: text('notes'),
    upsell_notes: text('upsell_notes'),
    primary_image_path: text('primary_image_path'),
    shipping_paid_by_customer: integer('shipping_paid_by_customer', { mode: 'boolean' }),
    created_at: text('created_at').notNull(),
    updated_at: text('updated_at').notNull(),
    deleted_at: text('deleted_at'),
  },
  (table) => [
    index('idx_products_status').on(table.status),
    index('idx_products_category').on(table.category),
    index('idx_products_created_at').on(table.created_at),
  ],
);

// ============================================================
// 3. listings (Modul 05) – FK zu products
// ============================================================
export const listings = sqliteTable(
  'listings',
  {
    id: text('id').primaryKey(),
    product_id: text('product_id')
      .notNull()
      .references(() => products.id),
    platform: text('platform').notNull(),
    title: text('title').notNull(),
    short_description: text('short_description'),
    long_description: text('long_description'),
    bullet_points: text('bullet_points', { mode: 'json' }).$type<string[]>(),
    tags: text('tags', { mode: 'json' }).notNull().$type<string[]>(),
    price: real('price').notNull(),
    variants: text('variants', { mode: 'json' }).$type<{ name: string; price: number }[]>(),
    shipping_info: text('shipping_info'),
    processing_time_days: integer('processing_time_days'),
    status: text('status').notNull(),
    language: text('language').notNull(),
    seo_notes: text('seo_notes'),
    created_at: text('created_at').notNull(),
    updated_at: text('updated_at').notNull(),
    deleted_at: text('deleted_at'),
  },
  (table) => [
    index('idx_listings_platform').on(table.platform),
    index('idx_listings_status').on(table.status),
    index('idx_listings_product_id').on(table.product_id),
  ],
);

// ============================================================
// 4. expenses (Modul 04) – FK zu products (optional)
// ============================================================
export const expenses = sqliteTable(
  'expenses',
  {
    id: text('id').primaryKey(),
    date: text('date').notNull(),
    amount_gross: real('amount_gross').notNull(),
    amount_net: real('amount_net'),
    tax_amount: real('tax_amount'),
    vendor: text('vendor').notNull(),
    category: text('category').notNull(),
    subcategory: text('subcategory'),
    payment_method: text('payment_method'),
    purpose: text('purpose'),
    product_id: text('product_id').references(() => products.id),
    receipt_attached: integer('receipt_attached', { mode: 'boolean' }).notNull().default(false),
    receipt_file_path: text('receipt_file_path'),
    tax_relevant: integer('tax_relevant', { mode: 'boolean' }).notNull().default(true),
    recurring: integer('recurring', { mode: 'boolean' }).notNull().default(false),
    notes: text('notes'),
    created_at: text('created_at').notNull(),
    updated_at: text('updated_at').notNull(),
    deleted_at: text('deleted_at'),
  },
  (table) => [
    index('idx_expenses_date').on(table.date),
    index('idx_expenses_category').on(table.category),
    index('idx_expenses_vendor').on(table.vendor),
  ],
);

// ============================================================
// 5. orders (Modul 08) – FK zu products (optional)
// ============================================================
export const orders = sqliteTable(
  'orders',
  {
    id: text('id').primaryKey(),
    external_order_id: text('external_order_id'),
    customer_name: text('customer_name'),
    platform: text('platform').notNull(),
    product_id: text('product_id').references(() => products.id),
    variant: text('variant'),
    quantity: integer('quantity').notNull().default(1),
    sale_price: real('sale_price').notNull(),
    shipping_cost: real('shipping_cost'),
    material_cost: real('material_cost'),
    platform_fee: real('platform_fee'),
    status: text('status').notNull(),
    payment_status: text('payment_status').notNull(),
    shipping_status: text('shipping_status'),
    tracking_number: text('tracking_number'),
    order_date: text('order_date').notNull(),
    notes: text('notes'),
    created_at: text('created_at').notNull(),
    updated_at: text('updated_at').notNull(),
    deleted_at: text('deleted_at'),
  },
  (table) => [
    index('idx_orders_status').on(table.status),
    index('idx_orders_platform').on(table.platform),
    index('idx_orders_order_date').on(table.order_date),
  ],
);

// ============================================================
// 6. tasks (Modul 09) – FKs zu products, orders, listings
// ============================================================
export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    priority: text('priority').notNull(),
    status: text('status').notNull(),
    due_date: text('due_date'),
    product_id: text('product_id').references(() => products.id),
    order_id: text('order_id').references(() => orders.id),
    listing_id: text('listing_id').references(() => listings.id),
    recurring_rule: text('recurring_rule', { mode: 'json' }).$type<{
      interval: 'daily' | 'weekly' | 'monthly';
      day?: number;
    }>(),
    completed_at: text('completed_at'),
    created_at: text('created_at').notNull(),
    updated_at: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_tasks_status').on(table.status),
    index('idx_tasks_priority').on(table.priority),
    index('idx_tasks_due_date').on(table.due_date),
  ],
);

// ============================================================
// 7. file_links (Modul 03) – polymorphe Referenzen
// ============================================================
export const fileLinks = sqliteTable(
  'file_links',
  {
    id: text('id').primaryKey(),
    entity_type: text('entity_type').notNull(),
    entity_id: text('entity_id').notNull(),
    file_path: text('file_path').notNull(),
    file_type: text('file_type').notNull(),
    note: text('note'),
    created_at: text('created_at').notNull(),
    updated_at: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_file_links_entity').on(table.entity_type, table.entity_id),
    index('idx_file_links_file_type').on(table.file_type),
  ],
);

// ============================================================
// 8. file_operations (Modul 03) – Operations-Log fuer Dateiaktionen
// ============================================================
export const fileOperations = sqliteTable(
  'file_operations',
  {
    id: text('id').primaryKey(),
    operation_type: text('operation_type').notNull(),
    source_path: text('source_path').notNull(),
    target_path: text('target_path'),
    status: text('status').notNull(),
    error_message: text('error_message'),
    is_undoable: integer('is_undoable', { mode: 'boolean' }).notNull().default(false),
    created_at: text('created_at').notNull(),
    undone_at: text('undone_at'),
  },
  (table) => [
    index('idx_file_operations_created_at').on(table.created_at),
    index('idx_file_operations_status').on(table.status),
  ],
);

// ============================================================
// 9. templates (Modul 07) – keine FKs
// ============================================================
export const templates = sqliteTable(
  'templates',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    category: text('category').notNull(),
    content: text('content').notNull(),
    platforms: text('platforms', { mode: 'json' }).$type<string[]>(),
    variables: text('variables', { mode: 'json' }).$type<{ name: string; description: string }[]>(),
    version: integer('version').notNull().default(1),
    is_legal: integer('is_legal', { mode: 'boolean' }).notNull().default(false),
    notes: text('notes'),
    created_at: text('created_at').notNull(),
    updated_at: text('updated_at').notNull(),
    deleted_at: text('deleted_at'),
  },
  (table) => [index('idx_templates_category').on(table.category)],
);

// ============================================================
// 10. ai_jobs (Modul 06) – keine FKs
// ============================================================
export const aiJobs = sqliteTable(
  'ai_jobs',
  {
    id: text('id').primaryKey(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    agent: text('agent').notNull(),
    action: text('action').notNull(),
    input: text('input'),
    output: text('output'),
    tokens_used: integer('tokens_used'),
    duration_ms: integer('duration_ms'),
    status: text('status').notNull(),
    error_message: text('error_message'),
    estimated_cost: real('estimated_cost'),
    created_at: text('created_at').notNull(),
  },
  (table) => [
    index('idx_ai_jobs_created_at').on(table.created_at),
    index('idx_ai_jobs_agent').on(table.agent),
    index('idx_ai_jobs_status').on(table.status),
  ],
);

// ============================================================
// 11. kpi_records (Modul 10) – keine FKs
// ============================================================
export const kpiRecords = sqliteTable(
  'kpi_records',
  {
    id: text('id').primaryKey(),
    period_type: text('period_type').notNull(),
    period_start: text('period_start').notNull(),
    period_end: text('period_end').notNull(),
    revenue: real('revenue').notNull(),
    expenses_total: real('expenses_total').notNull(),
    orders_count: integer('orders_count').notNull(),
    active_products: integer('active_products').notNull(),
    active_listings: integer('active_listings').notNull(),
    avg_margin: real('avg_margin'),
    created_at: text('created_at').notNull(),
  },
  (table) => [index('idx_kpi_records_period').on(table.period_type, table.period_start)],
);
