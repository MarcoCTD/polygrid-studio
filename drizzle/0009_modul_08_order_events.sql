CREATE TABLE IF NOT EXISTS `order_events` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`event_type` text NOT NULL,
	`from_value` text,
	`to_value` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_order_events_order_id` ON `order_events` (`order_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_order_events_created_at` ON `order_events` (`created_at`);
