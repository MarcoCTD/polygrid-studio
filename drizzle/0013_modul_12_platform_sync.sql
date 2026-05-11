ALTER TABLE listings ADD COLUMN platform TEXT NOT NULL DEFAULT 'etsy';
--> statement-breakpoint
CREATE INDEX idx_listings_platform ON listings(platform);
--> statement-breakpoint
ALTER TABLE listings ADD COLUMN external_id TEXT;
--> statement-breakpoint
ALTER TABLE listings ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'not_synced';
--> statement-breakpoint
ALTER TABLE listings ADD COLUMN sync_error_message TEXT;
--> statement-breakpoint
ALTER TABLE listings ADD COLUMN last_synced_at TEXT;
--> statement-breakpoint
ALTER TABLE listings ADD COLUMN platform_metadata TEXT;
--> statement-breakpoint
UPDATE listings SET sync_status = 'not_synced' WHERE sync_status IS NULL;
--> statement-breakpoint
CREATE INDEX idx_listings_sync_status ON listings(sync_status);
--> statement-breakpoint
CREATE INDEX idx_listings_external_id ON listings(external_id);
--> statement-breakpoint
ALTER TABLE orders ADD COLUMN external_synced INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE INDEX idx_orders_external_synced ON orders(external_synced);
--> statement-breakpoint
CREATE TABLE sync_jobs (
  id TEXT PRIMARY KEY NOT NULL,
  platform TEXT NOT NULL,
  operation TEXT NOT NULL,
  listing_id TEXT REFERENCES listings(id) ON DELETE SET NULL,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  direction TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  request_payload TEXT,
  response_payload TEXT,
  error_message TEXT,
  http_status_code INTEGER,
  retry_count INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_sync_jobs_platform ON sync_jobs(platform);
--> statement-breakpoint
CREATE INDEX idx_sync_jobs_operation ON sync_jobs(operation);
--> statement-breakpoint
CREATE INDEX idx_sync_jobs_status ON sync_jobs(status);
--> statement-breakpoint
CREATE INDEX idx_sync_jobs_listing_id ON sync_jobs(listing_id);
--> statement-breakpoint
CREATE INDEX idx_sync_jobs_started_at ON sync_jobs(started_at);
--> statement-breakpoint
CREATE INDEX idx_sync_jobs_platform_started_at ON sync_jobs(platform, started_at);
