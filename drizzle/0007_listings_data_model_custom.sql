PRAGMA foreign_keys=OFF;--> statement-breakpoint
DROP TABLE IF EXISTS `listings`;--> statement-breakpoint
CREATE TABLE `listings` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`master_title` text NOT NULL,
	`master_short_description` text,
	`master_long_description` text,
	`master_bullet_points` text,
	`master_tags` text NOT NULL,
	`base_price` real NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`inventory_mode` text NOT NULL,
	`stock_quantity` integer,
	`sku_base` text,
	`processing_time_min_days` integer,
	`processing_time_max_days` integer,
	`weight_grams` real,
	`dimension_length_cm` real,
	`dimension_width_cm` real,
	`dimension_height_cm` real,
	`condition` text DEFAULT 'new' NOT NULL,
	`language` text NOT NULL,
	`status` text NOT NULL,
	`seo_notes` text,
	`append_legal_texts` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_listings_product_id_unique` ON `listings` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_listings_status` ON `listings` (`status`);--> statement-breakpoint
CREATE INDEX `idx_listings_language` ON `listings` (`language`);--> statement-breakpoint
CREATE TABLE `listing_platform_overrides` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`platform` text NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`title_override` text,
	`short_description_override` text,
	`long_description_override` text,
	`tags_override` text,
	`price_override` real,
	`platform_category_id` text,
	`shipping_profile_id` text,
	`return_policy_id` text,
	`payment_policy_id` text,
	`external_listing_id` text,
	`external_listing_url` text,
	`sync_status` text DEFAULT 'manual' NOT NULL,
	`sync_error_message` text,
	`last_synced_at` text,
	`platform_metadata` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_listing_platform_overrides_listing_platform_unique` ON `listing_platform_overrides` (`listing_id`,`platform`);--> statement-breakpoint
CREATE INDEX `idx_listing_platform_overrides_sync_status` ON `listing_platform_overrides` (`sync_status`);--> statement-breakpoint
CREATE TABLE `listing_variants` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`name` text NOT NULL,
	`sku_suffix` text,
	`price` real NOT NULL,
	`stock_quantity` integer,
	`color_hex` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `idx_listing_variants_listing_sort` ON `listing_variants` (`listing_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `listing_images` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`file_link_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`alt_text` text,
	`platforms` text,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_link_id`) REFERENCES `file_links`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE INDEX `idx_listing_images_listing_sort` ON `listing_images` (`listing_id`,`sort_order`);--> statement-breakpoint
PRAGMA foreign_keys=ON;
