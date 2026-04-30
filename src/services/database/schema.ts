import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

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
    master_title: text('master_title').notNull(),
    master_short_description: text('master_short_description'),
    master_long_description: text('master_long_description'),
    master_bullet_points: text('master_bullet_points', { mode: 'json' }).$type<string[]>(),
    master_tags: text('master_tags', { mode: 'json' }).notNull().$type<string[]>(),
    base_price: real('base_price').notNull(),
    currency: text('currency').notNull().default('EUR'),
    inventory_mode: text('inventory_mode').notNull(),
    stock_quantity: integer('stock_quantity'),
    sku_base: text('sku_base'),
    processing_time_min_days: integer('processing_time_min_days'),
    processing_time_max_days: integer('processing_time_max_days'),
    weight_grams: real('weight_grams'),
    dimension_length_cm: real('dimension_length_cm'),
    dimension_width_cm: real('dimension_width_cm'),
    dimension_height_cm: real('dimension_height_cm'),
    condition: text('condition').notNull().default('new'),
    language: text('language').notNull(),
    status: text('status').notNull(),
    seo_notes: text('seo_notes'),
    append_legal_texts: integer('append_legal_texts', { mode: 'boolean' }).notNull().default(true),
    created_at: text('created_at').notNull(),
    updated_at: text('updated_at').notNull(),
    deleted_at: text('deleted_at'),
  },
  (table) => [
    uniqueIndex('idx_listings_product_id_unique').on(table.product_id),
    index('idx_listings_status').on(table.status),
    index('idx_listings_language').on(table.language),
  ],
);

// ============================================================
// 3b. listing_platform_overrides (Modul 05) – Plattformwerte
// ============================================================
export const listingPlatformOverrides = sqliteTable(
  'listing_platform_overrides',
  {
    id: text('id').primaryKey(),
    listing_id: text('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    platform: text('platform').notNull(),
    is_active: integer('is_active', { mode: 'boolean' }).notNull().default(false),
    title_override: text('title_override'),
    short_description_override: text('short_description_override'),
    long_description_override: text('long_description_override'),
    tags_override: text('tags_override', { mode: 'json' }).$type<string[]>(),
    price_override: real('price_override'),
    platform_category_id: text('platform_category_id'),
    shipping_profile_id: text('shipping_profile_id'),
    return_policy_id: text('return_policy_id'),
    payment_policy_id: text('payment_policy_id'),
    external_listing_id: text('external_listing_id'),
    external_listing_url: text('external_listing_url'),
    sync_status: text('sync_status').notNull().default('manual'),
    sync_error_message: text('sync_error_message'),
    last_synced_at: text('last_synced_at'),
    platform_metadata: text('platform_metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
    created_at: text('created_at').notNull(),
    updated_at: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_listing_platform_overrides_listing_platform_unique').on(
      table.listing_id,
      table.platform,
    ),
    index('idx_listing_platform_overrides_sync_status').on(table.sync_status),
  ],
);

// ============================================================
// 3c. listing_variants (Modul 05) – Varianten
// ============================================================
export const listingVariants = sqliteTable(
  'listing_variants',
  {
    id: text('id').primaryKey(),
    listing_id: text('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sku_suffix: text('sku_suffix'),
    price: real('price').notNull(),
    stock_quantity: integer('stock_quantity'),
    color_hex: text('color_hex'),
    sort_order: integer('sort_order').notNull().default(0),
    is_default: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => [index('idx_listing_variants_listing_sort').on(table.listing_id, table.sort_order)],
);

// ============================================================
// 3d. listing_images (Modul 05) – Bildverknüpfungen
// ============================================================
export const listingImages = sqliteTable(
  'listing_images',
  {
    id: text('id').primaryKey(),
    listing_id: text('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    file_link_id: text('file_link_id')
      .notNull()
      .references(() => fileLinks.id),
    sort_order: integer('sort_order').notNull().default(0),
    alt_text: text('alt_text'),
    platforms: text('platforms', { mode: 'json' }).$type<string[]>(),
  },
  (table) => [index('idx_listing_images_listing_sort').on(table.listing_id, table.sort_order)],
);

// ============================================================
// 4. import_batches (Modul 08) – Audit fuer CSV-Imports
// ============================================================
export const importBatches = sqliteTable(
  'import_batches',
  {
    id: text('id').primaryKey(),
    source: text('source').notNull(),
    imported_at: text('imported_at').notNull(),
    filename: text('filename'),
    transaction_count: integer('transaction_count').notNull(),
    matched_count: integer('matched_count').notNull(),
    date_range_start: text('date_range_start'),
    date_range_end: text('date_range_end'),
  },
  (table) => [
    index('idx_import_batches_imported_at').on(table.imported_at),
    index('idx_import_batches_source').on(table.source),
  ],
);

// ============================================================
// 4b. bank_transactions (Modul 08) – N26-Bankimport
// ============================================================
export const bankTransactions = sqliteTable(
  'bank_transactions',
  {
    id: text('id').primaryKey(),
    transaction_date: text('transaction_date').notNull(),
    value_date: text('value_date'),
    amount: real('amount').notNull(),
    description: text('description').notNull(),
    counterparty_name: text('counterparty_name'),
    counterparty_iban: text('counterparty_iban'),
    transaction_type: text('transaction_type'),
    // SQLite-FKs fuer matched_order_id/matched_expense_id liegen in der SQL-Migration.
    // Im Drizzle-Schema bleibt dieser Rueckverweis bewusst ohne .references(),
    // damit der orders/expenses <-> bank_transactions Zyklus typisierbar bleibt.
    matched_order_id: text('matched_order_id'),
    matched_expense_id: text('matched_expense_id'),
    match_confidence: text('match_confidence'),
    is_payout: integer('is_payout', { mode: 'boolean' }).notNull().default(false),
    import_batch_id: text('import_batch_id')
      .notNull()
      .references(() => importBatches.id),
    ignored: integer('ignored', { mode: 'boolean' }).notNull().default(false),
    notes: text('notes'),
    created_at: text('created_at').notNull(),
  },
  (table) => [
    index('idx_bank_transactions_transaction_date').on(table.transaction_date),
    index('idx_bank_transactions_amount').on(table.amount),
    index('idx_bank_transactions_import_batch_id').on(table.import_batch_id),
    index('idx_bank_transactions_match_confidence').on(table.match_confidence),
    index('idx_bank_transactions_is_payout').on(table.is_payout),
  ],
);

// ============================================================
// 5. expenses (Modul 04) – FK zu products (optional)
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
    order_id: text('order_id').references(() => orders.id),
    receipt_attached: integer('receipt_attached', { mode: 'boolean' }).notNull().default(false),
    receipt_file_path: text('receipt_file_path'),
    tax_relevant: integer('tax_relevant', { mode: 'boolean' }).notNull().default(true),
    recurring: integer('recurring', { mode: 'boolean' }).notNull().default(false),
    recurring_interval: text('recurring_interval'),
    recurring_next_date: text('recurring_next_date'),
    import_source: text('import_source').notNull().default('manual'),
    import_ref: text('import_ref'),
    tax_locked: integer('tax_locked', { mode: 'boolean' }).notNull().default(false),
    bank_match_id: text('bank_match_id').references(() => bankTransactions.id),
    notes: text('notes'),
    created_at: text('created_at').notNull(),
    updated_at: text('updated_at').notNull(),
    deleted_at: text('deleted_at'),
  },
  (table) => [
    index('idx_expenses_date').on(table.date),
    index('idx_expenses_category').on(table.category),
    index('idx_expenses_vendor').on(table.vendor),
    index('idx_expenses_product_id').on(table.product_id),
    index('idx_expenses_order_id').on(table.order_id),
    index('idx_expenses_tax_locked').on(table.tax_locked),
  ],
);

// ============================================================
// 6. orders (Modul 08) – FK zu products (optional)
// ============================================================
export const orders = sqliteTable(
  'orders',
  {
    id: text('id').primaryKey(),
    receipt_number: text('receipt_number').notNull(),
    external_order_id: text('external_order_id'),
    customer_name: text('customer_name'),
    platform: text('platform').notNull(),
    product_id: text('product_id').references(() => products.id),
    variant: text('variant'),
    quantity: integer('quantity').notNull().default(1),
    sale_price: real('sale_price').notNull(),
    shipping_revenue: real('shipping_revenue'),
    shipping_cost: real('shipping_cost'),
    material_cost: real('material_cost'),
    platform_fee: real('platform_fee'),
    payout_amount: real('payout_amount'),
    status: text('status').notNull(),
    payment_status: text('payment_status').notNull(),
    payment_received_date: text('payment_received_date'),
    shipping_status: text('shipping_status'),
    tracking_number: text('tracking_number'),
    order_date: text('order_date').notNull(),
    notes: text('notes'),
    tax_locked: integer('tax_locked', { mode: 'boolean' }).notNull().default(false),
    bank_match_id: text('bank_match_id').references(() => bankTransactions.id),
    created_at: text('created_at').notNull(),
    updated_at: text('updated_at').notNull(),
    deleted_at: text('deleted_at'),
  },
  (table) => [
    uniqueIndex('idx_orders_receipt_number_unique').on(table.receipt_number),
    index('idx_orders_status').on(table.status),
    index('idx_orders_platform').on(table.platform),
    index('idx_orders_order_date').on(table.order_date),
    index('idx_orders_payment_received_date').on(table.payment_received_date),
    index('idx_orders_tax_locked').on(table.tax_locked),
  ],
);

// ============================================================
// 6b. bank_payout_orders (Modul 08) – Sammelauszahlungen
// ============================================================
export const bankPayoutOrders = sqliteTable(
  'bank_payout_orders',
  {
    id: text('id').primaryKey(),
    bank_transaction_id: text('bank_transaction_id')
      .notNull()
      .references(() => bankTransactions.id),
    order_id: text('order_id')
      .notNull()
      .references(() => orders.id),
    allocated_amount: real('allocated_amount').notNull(),
    created_at: text('created_at').notNull(),
  },
  (table) => [
    index('idx_bank_payout_orders_bank_transaction_id').on(table.bank_transaction_id),
    index('idx_bank_payout_orders_order_id').on(table.order_id),
    uniqueIndex('idx_bank_payout_orders_transaction_order_unique').on(
      table.bank_transaction_id,
      table.order_id,
    ),
  ],
);

// ============================================================
// 7. tasks (Modul 09) – FKs zu products, orders, listings
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
// 8. file_links (Modul 03) – polymorphe Referenzen
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
    is_primary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
    position: integer('position').notNull().default(0),
    file_size: integer('file_size'),
    mime_type: text('mime_type'),
    display_name: text('display_name'),
    created_at: text('created_at').notNull(),
    updated_at: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_file_links_entity').on(table.entity_type, table.entity_id),
    index('idx_file_links_file_type').on(table.file_type),
  ],
);

// ============================================================
// 9. file_operations (Modul 03) – Operations-Log fuer Dateiaktionen
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
// 10. templates (Modul 07) – keine FKs
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
// 11. ai_jobs (Modul 06) – keine FKs
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
// 12. kpi_records (Modul 10) – keine FKs
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
