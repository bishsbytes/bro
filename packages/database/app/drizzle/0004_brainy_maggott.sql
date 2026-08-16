CREATE TABLE IF NOT EXISTS `daily_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`metric_slug` text NOT NULL,
	`local_day` text NOT NULL,
	`value` real NOT NULL,
	`source` text NOT NULL,
	`computed_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_daily_metrics_natural` ON `daily_metrics` (`metric_slug`,`local_day`,`source`);
