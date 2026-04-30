PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `orders_new` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_number` text NOT NULL,
	`external_order_id` text,
	`customer_name` text,
	`platform` text NOT NULL,
	`product_id` text,
	`variant` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`sale_price` real NOT NULL,
	`shipping_revenue` real,
	`shipping_cost` real,
	`material_cost` real,
	`platform_fee` real,
	`payout_amount` real,
	`status` text NOT NULL,
	`payment_status` text NOT NULL,
	`payment_received_date` text,
	`shipping_status` text,
	`tracking_number` text,
	`order_date` text NOT NULL,
	`notes` text,
	`tax_locked` integer DEFAULT 0 NOT NULL,
	`bank_match_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bank_match_id`) REFERENCES `bank_transactions`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
WITH `base` AS (
	SELECT
		*,
		CASE
			WHEN substr(`order_date`, 1, 4) GLOB '[0-9][0-9][0-9][0-9]' THEN substr(`order_date`, 1, 4)
			WHEN substr(`created_at`, 1, 4) GLOB '[0-9][0-9][0-9][0-9]' THEN substr(`created_at`, 1, 4)
			ELSE strftime('%Y', 'now')
		END AS `receipt_year`
	FROM `orders`
), `numbered` AS (
	SELECT
		*,
		ROW_NUMBER() OVER (PARTITION BY `receipt_year` ORDER BY `created_at`, `id`) AS `receipt_counter`
	FROM `base`
)
INSERT INTO `orders_new` (
	`id`,
	`receipt_number`,
	`external_order_id`,
	`customer_name`,
	`platform`,
	`product_id`,
	`variant`,
	`quantity`,
	`sale_price`,
	`shipping_revenue`,
	`shipping_cost`,
	`material_cost`,
	`platform_fee`,
	`payout_amount`,
	`status`,
	`payment_status`,
	`payment_received_date`,
	`shipping_status`,
	`tracking_number`,
	`order_date`,
	`notes`,
	`tax_locked`,
	`bank_match_id`,
	`created_at`,
	`updated_at`,
	`deleted_at`
)
SELECT
	`id`,
	printf('%s-%04d', `receipt_year`, `receipt_counter`),
	`external_order_id`,
	`customer_name`,
	`platform`,
	`product_id`,
	`variant`,
	`quantity`,
	`sale_price`,
	NULL,
	`shipping_cost`,
	`material_cost`,
	`platform_fee`,
	NULL,
	CASE
		WHEN `status` = 'quoted' THEN 'inquiry'
		WHEN `status` = 'ready' THEN 'shipped'
		WHEN `status` IN ('inquiry', 'ordered', 'paid', 'in_production', 'shipped', 'completed', 'issue', 'cancelled') THEN `status`
		ELSE 'inquiry'
	END,
	`payment_status`,
	NULL,
	`shipping_status`,
	`tracking_number`,
	`order_date`,
	`notes`,
	0,
	NULL,
	`created_at`,
	`updated_at`,
	`deleted_at`
FROM `numbered`;--> statement-breakpoint
DROP TABLE `orders`;--> statement-breakpoint
ALTER TABLE `orders_new` RENAME TO `orders`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_orders_receipt_number_unique` ON `orders` (`receipt_number`);--> statement-breakpoint
CREATE INDEX `idx_orders_status` ON `orders` (`status`);--> statement-breakpoint
CREATE INDEX `idx_orders_platform` ON `orders` (`platform`);--> statement-breakpoint
CREATE INDEX `idx_orders_order_date` ON `orders` (`order_date`);--> statement-breakpoint
CREATE INDEX `idx_orders_payment_received_date` ON `orders` (`payment_received_date`);--> statement-breakpoint
CREATE INDEX `idx_orders_tax_locked` ON `orders` (`tax_locked`);--> statement-breakpoint
CREATE TABLE `expenses_new` (
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
	`order_id` text,
	`receipt_attached` integer DEFAULT 0 NOT NULL,
	`receipt_file_path` text,
	`tax_relevant` integer DEFAULT 1 NOT NULL,
	`recurring` integer DEFAULT 0 NOT NULL,
	`recurring_interval` text,
	`recurring_next_date` text,
	`import_source` text DEFAULT 'manual' NOT NULL,
	`import_ref` text,
	`tax_locked` integer DEFAULT 0 NOT NULL,
	`bank_match_id` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bank_match_id`) REFERENCES `bank_transactions`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
INSERT INTO `expenses_new` (
	`id`,
	`date`,
	`amount_gross`,
	`amount_net`,
	`tax_amount`,
	`vendor`,
	`category`,
	`subcategory`,
	`payment_method`,
	`purpose`,
	`product_id`,
	`order_id`,
	`receipt_attached`,
	`receipt_file_path`,
	`tax_relevant`,
	`recurring`,
	`recurring_interval`,
	`recurring_next_date`,
	`import_source`,
	`import_ref`,
	`tax_locked`,
	`bank_match_id`,
	`notes`,
	`created_at`,
	`updated_at`,
	`deleted_at`
)
SELECT
	`id`,
	`date`,
	`amount_gross`,
	`amount_net`,
	`tax_amount`,
	`vendor`,
	`category`,
	`subcategory`,
	`payment_method`,
	`purpose`,
	`product_id`,
	`order_id`,
	`receipt_attached`,
	`receipt_file_path`,
	`tax_relevant`,
	`recurring`,
	`recurring_interval`,
	`recurring_next_date`,
	`import_source`,
	`import_ref`,
	0,
	NULL,
	`notes`,
	`created_at`,
	`updated_at`,
	`deleted_at`
FROM `expenses`;--> statement-breakpoint
DROP TABLE `expenses`;--> statement-breakpoint
ALTER TABLE `expenses_new` RENAME TO `expenses`;--> statement-breakpoint
CREATE INDEX `idx_expenses_date` ON `expenses` (`date`);--> statement-breakpoint
CREATE INDEX `idx_expenses_category` ON `expenses` (`category`);--> statement-breakpoint
CREATE INDEX `idx_expenses_vendor` ON `expenses` (`vendor`);--> statement-breakpoint
CREATE INDEX `idx_expenses_product_id` ON `expenses` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_expenses_order_id` ON `expenses` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_expenses_tax_locked` ON `expenses` (`tax_locked`);--> statement-breakpoint
CREATE TABLE `import_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`imported_at` text NOT NULL,
	`filename` text,
	`transaction_count` integer NOT NULL,
	`matched_count` integer NOT NULL,
	`date_range_start` text,
	`date_range_end` text
);--> statement-breakpoint
CREATE INDEX `idx_import_batches_imported_at` ON `import_batches` (`imported_at`);--> statement-breakpoint
CREATE INDEX `idx_import_batches_source` ON `import_batches` (`source`);--> statement-breakpoint
CREATE TABLE `bank_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_date` text NOT NULL,
	`value_date` text,
	`amount` real NOT NULL,
	`description` text NOT NULL,
	`counterparty_name` text,
	`counterparty_iban` text,
	`transaction_type` text,
	`matched_order_id` text,
	`matched_expense_id` text,
	`match_confidence` text,
	`is_payout` integer DEFAULT 0 NOT NULL,
	`import_batch_id` text NOT NULL,
	`ignored` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`matched_order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`matched_expense_id`) REFERENCES `expenses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`import_batch_id`) REFERENCES `import_batches`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE INDEX `idx_bank_transactions_transaction_date` ON `bank_transactions` (`transaction_date`);--> statement-breakpoint
CREATE INDEX `idx_bank_transactions_amount` ON `bank_transactions` (`amount`);--> statement-breakpoint
CREATE INDEX `idx_bank_transactions_import_batch_id` ON `bank_transactions` (`import_batch_id`);--> statement-breakpoint
CREATE INDEX `idx_bank_transactions_match_confidence` ON `bank_transactions` (`match_confidence`);--> statement-breakpoint
CREATE INDEX `idx_bank_transactions_is_payout` ON `bank_transactions` (`is_payout`);--> statement-breakpoint
CREATE TABLE `bank_payout_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`bank_transaction_id` text NOT NULL,
	`order_id` text NOT NULL,
	`allocated_amount` real NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`bank_transaction_id`) REFERENCES `bank_transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE INDEX `idx_bank_payout_orders_bank_transaction_id` ON `bank_payout_orders` (`bank_transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_bank_payout_orders_order_id` ON `bank_payout_orders` (`order_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_bank_payout_orders_transaction_order_unique` ON `bank_payout_orders` (`bank_transaction_id`,`order_id`);--> statement-breakpoint
PRAGMA foreign_keys=ON;
