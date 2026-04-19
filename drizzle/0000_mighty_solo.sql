CREATE TABLE `ai_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`agent` text NOT NULL,
	`action` text NOT NULL,
	`input` text,
	`output` text,
	`tokens_used` integer,
	`duration_ms` integer,
	`status` text NOT NULL,
	`error_message` text,
	`estimated_cost` real,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ai_jobs_created_at` ON `ai_jobs` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_ai_jobs_agent` ON `ai_jobs` (`agent`);--> statement-breakpoint
CREATE INDEX `idx_ai_jobs_status` ON `ai_jobs` (`status`);--> statement-breakpoint
CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`amount_gross` real NOT NULL,
	`amount_net` real,
	`tax_amount` real,
	`vendor` text NOT NULL,
	`category` text NOT NULL,
	`subcategory` text,
	`payment_method` text,
	`purpose` text,
	`product_id` text,
	`receipt_attached` integer DEFAULT false NOT NULL,
	`receipt_file_path` text,
	`tax_relevant` integer DEFAULT true NOT NULL,
	`recurring` integer DEFAULT false NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_expenses_date` ON `expenses` (`date`);--> statement-breakpoint
CREATE INDEX `idx_expenses_category` ON `expenses` (`category`);--> statement-breakpoint
CREATE INDEX `idx_expenses_vendor` ON `expenses` (`vendor`);--> statement-breakpoint
CREATE TABLE `file_links` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`file_path` text NOT NULL,
	`file_type` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_file_links_entity` ON `file_links` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_file_links_file_type` ON `file_links` (`file_type`);--> statement-breakpoint
CREATE TABLE `kpi_records` (
	`id` text PRIMARY KEY NOT NULL,
	`period_type` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`revenue` real NOT NULL,
	`expenses_total` real NOT NULL,
	`orders_count` integer NOT NULL,
	`active_products` integer NOT NULL,
	`active_listings` integer NOT NULL,
	`avg_margin` real,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_kpi_records_period` ON `kpi_records` (`period_type`,`period_start`);--> statement-breakpoint
CREATE TABLE `listings` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`platform` text NOT NULL,
	`title` text NOT NULL,
	`short_description` text,
	`long_description` text,
	`bullet_points` text,
	`tags` text NOT NULL,
	`price` real NOT NULL,
	`variants` text,
	`shipping_info` text,
	`processing_time_days` integer,
	`status` text NOT NULL,
	`language` text NOT NULL,
	`seo_notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_listings_platform` ON `listings` (`platform`);--> statement-breakpoint
CREATE INDEX `idx_listings_status` ON `listings` (`status`);--> statement-breakpoint
CREATE INDEX `idx_listings_product_id` ON `listings` (`product_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`external_order_id` text,
	`customer_name` text,
	`platform` text NOT NULL,
	`product_id` text,
	`variant` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`sale_price` real NOT NULL,
	`shipping_cost` real,
	`material_cost` real,
	`platform_fee` real,
	`status` text NOT NULL,
	`payment_status` text NOT NULL,
	`shipping_status` text,
	`tracking_number` text,
	`order_date` text NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_orders_status` ON `orders` (`status`);--> statement-breakpoint
CREATE INDEX `idx_orders_platform` ON `orders` (`platform`);--> statement-breakpoint
CREATE INDEX `idx_orders_order_date` ON `orders` (`order_date`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`short_name` text,
	`category` text NOT NULL,
	`subcategory` text,
	`description_internal` text,
	`collection` text,
	`status` text NOT NULL,
	`material_type` text NOT NULL,
	`color_variants` text,
	`print_time_minutes` integer,
	`material_grams` real,
	`electricity_cost` real,
	`packaging_cost` real,
	`shipping_class` text,
	`target_price` real,
	`min_price` real,
	`estimated_margin` real,
	`license_source` text,
	`license_type` text,
	`license_url` text,
	`license_risk` text,
	`platforms` text,
	`notes` text,
	`upsell_notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_products_status` ON `products` (`status`);--> statement-breakpoint
CREATE INDEX `idx_products_category` ON `products` (`category`);--> statement-breakpoint
CREATE INDEX `idx_products_created_at` ON `products` (`created_at`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`priority` text NOT NULL,
	`status` text NOT NULL,
	`due_date` text,
	`product_id` text,
	`order_id` text,
	`listing_id` text,
	`recurring_rule` text,
	`completed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_status` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `idx_tasks_priority` ON `tasks` (`priority`);--> statement-breakpoint
CREATE INDEX `idx_tasks_due_date` ON `tasks` (`due_date`);--> statement-breakpoint
CREATE TABLE `templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`content` text NOT NULL,
	`platforms` text,
	`variables` text,
	`version` integer DEFAULT 1 NOT NULL,
	`is_legal` integer DEFAULT false NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_templates_category` ON `templates` (`category`);