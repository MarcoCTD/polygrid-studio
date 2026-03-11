-- PolyGrid Studio — Initial Schema
-- All tables include: id (UUID), created_at, updated_at, deleted_at (soft delete)

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- ── products ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id                  TEXT NOT NULL PRIMARY KEY,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  deleted_at          TEXT,
  name                TEXT NOT NULL,
  short_name          TEXT,
  category            TEXT NOT NULL,
  subcategory         TEXT,
  description_internal TEXT,
  collection          TEXT,
  status              TEXT NOT NULL DEFAULT 'idea',
  material_type       TEXT NOT NULL DEFAULT 'PLA',
  color_variants      TEXT,          -- JSON array of strings
  print_time_minutes  INTEGER,
  material_grams      REAL,
  electricity_cost    REAL,
  packaging_cost      REAL,
  shipping_class      TEXT,
  target_price        REAL,
  min_price           REAL,
  estimated_margin    REAL,
  upsell_notes        TEXT,
  license_source      TEXT,
  license_type        TEXT,          -- own|cc_by|cc_by_sa|cc_by_nc|commercial|unclear
  license_url         TEXT,
  license_risk        TEXT,          -- safe|review_needed|risky
  platforms           TEXT,          -- JSON array of strings
  notes               TEXT
);

CREATE INDEX IF NOT EXISTS idx_products_status    ON products(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_category  ON products(category) WHERE deleted_at IS NULL;

-- ── expenses ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id                  TEXT NOT NULL PRIMARY KEY,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  deleted_at          TEXT,
  date                TEXT NOT NULL,
  amount_gross        REAL NOT NULL,
  amount_net          REAL,
  tax_amount          REAL,
  vendor              TEXT NOT NULL,
  category            TEXT NOT NULL,
  subcategory         TEXT,
  payment_method      TEXT,
  purpose             TEXT,
  product_id          TEXT REFERENCES products(id),
  receipt_attached    INTEGER DEFAULT 0,
  receipt_file_path   TEXT,
  tax_relevant        INTEGER DEFAULT 1,
  recurring           INTEGER DEFAULT 0,
  notes               TEXT
);

-- ── orders ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                  TEXT NOT NULL PRIMARY KEY,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  deleted_at          TEXT,
  external_order_id   TEXT,
  customer_name       TEXT,
  platform            TEXT NOT NULL,
  product_id          TEXT REFERENCES products(id),
  variant             TEXT,
  quantity            INTEGER DEFAULT 1,
  sale_price          REAL NOT NULL,
  shipping_cost       REAL,
  material_cost       REAL,
  platform_fee        REAL,
  status              TEXT NOT NULL DEFAULT 'ordered',
  payment_status      TEXT NOT NULL DEFAULT 'pending',
  shipping_status     TEXT,
  tracking_number     TEXT,
  order_date          TEXT NOT NULL,
  notes               TEXT
);

-- ── listings ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS listings (
  id                      TEXT NOT NULL PRIMARY KEY,
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  deleted_at              TEXT,
  product_id              TEXT NOT NULL REFERENCES products(id),
  platform                TEXT NOT NULL,
  title                   TEXT NOT NULL,
  short_description       TEXT,
  long_description        TEXT,
  bullet_points           TEXT,     -- JSON array
  tags                    TEXT,     -- JSON array
  price                   REAL NOT NULL,
  variants                TEXT,     -- JSON
  shipping_info           TEXT,
  processing_time_days    INTEGER,
  status                  TEXT DEFAULT 'draft',
  language                TEXT DEFAULT 'de',
  seo_notes               TEXT,
  platform_specific_notes TEXT
);

-- ── templates ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS templates (
  id          TEXT NOT NULL PRIMARY KEY,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,
  content     TEXT NOT NULL,
  platforms   TEXT,     -- JSON array
  variables   TEXT,     -- JSON array
  version     INTEGER DEFAULT 1,
  is_legal    INTEGER DEFAULT 0,
  notes       TEXT
);

-- ── tasks ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id              TEXT NOT NULL PRIMARY KEY,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  deleted_at      TEXT,
  title           TEXT NOT NULL,
  description     TEXT,
  priority        TEXT DEFAULT 'medium',
  status          TEXT DEFAULT 'todo',
  due_date        TEXT,
  product_id      TEXT REFERENCES products(id),
  order_id        TEXT REFERENCES orders(id),
  listing_id      TEXT REFERENCES listings(id),
  recurring_rule  TEXT,     -- JSON
  completed_at    TEXT
);

-- ── file_links ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS file_links (
  id              TEXT NOT NULL PRIMARY KEY,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  deleted_at      TEXT,
  entity_type     TEXT NOT NULL,    -- product|expense|order|listing|template
  entity_id       TEXT NOT NULL,
  file_type       TEXT NOT NULL,    -- stl|slicer|image|mockup|listing_text|packaging|manual|license|receipt|other
  file_path       TEXT NOT NULL,
  file_name       TEXT NOT NULL,
  file_size_bytes INTEGER,
  notes           TEXT
);

CREATE INDEX IF NOT EXISTS idx_file_links_entity ON file_links(entity_type, entity_id) WHERE deleted_at IS NULL;

-- ── ai_jobs ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_jobs (
  id            TEXT NOT NULL PRIMARY KEY,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  provider      TEXT NOT NULL,
  model         TEXT NOT NULL,
  agent         TEXT NOT NULL,
  action        TEXT NOT NULL,
  input_data    TEXT,     -- JSON
  output_data   TEXT,     -- JSON
  status        TEXT DEFAULT 'pending',
  tokens_used   INTEGER,
  cost_estimate REAL,
  duration_ms   INTEGER,
  error_message TEXT
);
