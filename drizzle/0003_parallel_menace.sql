CREATE TABLE `file_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`operation_type` text NOT NULL,
	`source_path` text NOT NULL,
	`target_path` text,
	`status` text NOT NULL,
	`error_message` text,
	`is_undoable` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`undone_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_file_operations_created_at` ON `file_operations` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_file_operations_status` ON `file_operations` (`status`);