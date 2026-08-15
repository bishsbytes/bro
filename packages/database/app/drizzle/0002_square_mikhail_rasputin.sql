CREATE TABLE IF NOT EXISTS `assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`template_slug` text NOT NULL,
	`template_version` integer NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`items` text NOT NULL,
	`focus_item_slugs` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`metric_slug` text NOT NULL,
	`direction` text NOT NULL,
	`target_value` real NOT NULL,
	`target_date` text,
	`started_at` integer NOT NULL,
	`achieved_at` integer,
	`abandoned_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `tracked_metrics` ADD `custom_label` text;
