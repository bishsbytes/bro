CREATE TABLE IF NOT EXISTS `consumption_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`catalogue_ref` text,
	`label` text NOT NULL,
	`serving_label` text,
	`quantity` real NOT NULL,
	`volume_l` real,
	`ethanol_kg` real,
	`caffeine_kg` real,
	`energy_kcal` real,
	`occurred_at` integer NOT NULL,
	`local_day` text NOT NULL,
	`tz_offset_minutes` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_consumption_entries_day` ON `consumption_entries` (`local_day`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_consumption_entries_kind_day` ON `consumption_entries` (`kind`,`local_day`);
