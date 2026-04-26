ALTER TABLE `expenses` ADD `order_id` text REFERENCES orders(id);--> statement-breakpoint
ALTER TABLE `expenses` ADD `import_source` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `expenses` ADD `import_ref` text;--> statement-breakpoint
CREATE INDEX `idx_expenses_product_id` ON `expenses` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_expenses_order_id` ON `expenses` (`order_id`);