CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`contact_person` text,
	`email` text,
	`phone` text,
	`credentials` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);--> statement-breakpoint
CREATE INDEX `idx_clients_name` ON `clients` (`name`);--> statement-breakpoint
CREATE TABLE `website_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`price` real,
	`deadline` text,
	`url` text,
	`order_id` text,
	`credentials` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE INDEX `idx_website_projects_client_id` ON `website_projects` (`client_id`);--> statement-breakpoint
CREATE INDEX `idx_website_projects_status` ON `website_projects` (`status`);--> statement-breakpoint
CREATE INDEX `idx_website_projects_deadline` ON `website_projects` (`deadline`);--> statement-breakpoint
CREATE TABLE `website_services` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`project_id` text,
	`type` text NOT NULL,
	`label` text NOT NULL,
	`cost_out` real,
	`cost_out_vendor` text,
	`price_in` real,
	`interval` text NOT NULL,
	`next_due` text NOT NULL,
	`expires_at` text,
	`active` integer DEFAULT 1 NOT NULL,
	`last_generated_until` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `website_projects`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE INDEX `idx_website_services_client_id` ON `website_services` (`client_id`);--> statement-breakpoint
CREATE INDEX `idx_website_services_next_due` ON `website_services` (`next_due`);--> statement-breakpoint
CREATE INDEX `idx_website_services_type` ON `website_services` (`type`);--> statement-breakpoint
CREATE INDEX `idx_website_services_expires_at` ON `website_services` (`expires_at`);
