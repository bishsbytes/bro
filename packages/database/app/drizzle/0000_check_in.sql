CREATE TABLE IF NOT EXISTS `day_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`local_day` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_day_notes_day` ON `day_notes` (`local_day`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `observations` (
	`id` text PRIMARY KEY NOT NULL,
	`metric_slug` text NOT NULL,
	`value` real NOT NULL,
	`scale_min` real,
	`scale_max` real,
	`observed_at` integer NOT NULL,
	`local_day` text NOT NULL,
	`tz_offset_minutes` integer NOT NULL,
	`source` text NOT NULL,
	`source_record_id` text,
	`assessment_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_observations_metric_day` ON `observations` (`metric_slug`,`local_day`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_observations_day` ON `observations` (`local_day`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tracked_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`metric_slug` text NOT NULL,
	`position` integer NOT NULL,
	`added_at` integer,
	`removed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
