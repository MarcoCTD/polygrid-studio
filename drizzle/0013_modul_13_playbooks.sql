CREATE TABLE `playbooks` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`trigger_status` text NOT NULL,
	`platform_filter` text,
	`actions` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);--> statement-breakpoint
CREATE INDEX `idx_playbooks_trigger_status` ON `playbooks` (`trigger_status`);--> statement-breakpoint
CREATE TABLE `playbook_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`playbook_id` text NOT NULL,
	`order_id` text NOT NULL,
	`trigger_status` text NOT NULL,
	`status` text NOT NULL,
	`results` text NOT NULL,
	`executed_at` text NOT NULL,
	FOREIGN KEY (`playbook_id`) REFERENCES `playbooks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE INDEX `idx_playbook_runs_order_id` ON `playbook_runs` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_playbook_runs_executed_at` ON `playbook_runs` (`executed_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_playbook_runs_idempotency` ON `playbook_runs` (`playbook_id`,`order_id`,`trigger_status`) WHERE `status` != 'dry_run';--> statement-breakpoint
INSERT INTO `playbooks` (`id`, `name`, `enabled`, `trigger_status`, `platform_filter`, `actions`, `created_at`, `updated_at`, `deleted_at`)
VALUES (
	'7f3d9a52-1c48-4b6e-9e07-2a5d8c4f1b30',
	'Versandaufgabe bei Zahlungseingang',
	0,
	'paid',
	NULL,
	'[{"type":"create_task","title_template":"{{produktname}} für {{kundenname}} drucken und verpacken","priority":"high","due_offset_days":1,"link_order":true}]',
	strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
	strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
	NULL
);--> statement-breakpoint
INSERT INTO `playbooks` (`id`, `name`, `enabled`, `trigger_status`, `platform_filter`, `actions`, `created_at`, `updated_at`, `deleted_at`)
VALUES (
	'0b8e6c14-9d72-4a35-8f61-3c7b5e2d9a48',
	'Versandkosten buchen bei Versand',
	0,
	'shipped',
	NULL,
	'[{"type":"create_expense","amount_gross":null,"amount_source":"shipping_cost","category":"versand","subcategory":null,"vendor":"Versanddienstleister","purpose_template":"Versand Bestellung {{bestellnummer}}"}]',
	strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
	strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
	NULL
);
