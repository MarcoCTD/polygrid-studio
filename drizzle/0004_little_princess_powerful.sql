ALTER TABLE `file_links` ADD `is_primary` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `file_links` ADD `position` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `file_links` ADD `file_size` integer;--> statement-breakpoint
ALTER TABLE `file_links` ADD `mime_type` text;--> statement-breakpoint
ALTER TABLE `file_links` ADD `display_name` text;