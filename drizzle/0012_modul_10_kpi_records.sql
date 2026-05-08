ALTER TABLE `kpi_records` ADD `open_orders` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `kpi_records` ADD `open_tasks` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `kpi_records` ADD `completed_orders` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `kpi_records` ADD `revenue_by_platform` text;--> statement-breakpoint
ALTER TABLE `kpi_records` ADD `expenses_by_category` text;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_kpi_records_period`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_kpi_records_period_unique` ON `kpi_records` (`period_type`, `period_start`);
