CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`number` text,
	`status` text NOT NULL,
	`client_id` text NOT NULL,
	`project_id` text,
	`order_id` text,
	`related_document_id` text,
	`line_items` text NOT NULL,
	`total` real NOT NULL,
	`issue_date` text,
	`due_date` text,
	`valid_until` text,
	`service_date` text,
	`intro_text` text,
	`outro_text` text,
	`layout` text NOT NULL,
	`snapshot` text,
	`pdf_path` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `website_projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`related_document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_documents_number_unique` ON `documents` (`number`) WHERE `number` IS NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_documents_type` ON `documents` (`type`);--> statement-breakpoint
CREATE INDEX `idx_documents_status` ON `documents` (`status`);--> statement-breakpoint
CREATE INDEX `idx_documents_client_id` ON `documents` (`client_id`);--> statement-breakpoint
CREATE INDEX `idx_documents_order_id` ON `documents` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_documents_due_date` ON `documents` (`due_date`);--> statement-breakpoint
ALTER TABLE `clients` ADD COLUMN `address` text;
