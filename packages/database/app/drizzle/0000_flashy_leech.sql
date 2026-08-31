CREATE TABLE `assessments` (
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
CREATE TABLE `challenge_enrolments` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge_slug` text NOT NULL,
	`title` text NOT NULL,
	`duration_days` integer NOT NULL,
	`area_slug` text NOT NULL,
	`started_on` text NOT NULL,
	`completed_at` integer,
	`abandoned_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `challenge_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`enrolment_id` text NOT NULL,
	`day_index` integer NOT NULL,
	`local_day` text NOT NULL,
	`completed_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_challenge_progress_natural` ON `challenge_progress` (`enrolment_id`,`day_index`);--> statement-breakpoint
CREATE TABLE `consumption_entries` (
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
	`protein_g` real,
	`carbs_g` real,
	`fat_g` real,
	`consumable_ref` text,
	`occurred_at` integer NOT NULL,
	`local_day` text NOT NULL,
	`tz_offset_minutes` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_consumption_entries_day` ON `consumption_entries` (`local_day`);--> statement-breakpoint
CREATE INDEX `idx_consumption_entries_kind_day` ON `consumption_entries` (`kind`,`local_day`);--> statement-breakpoint
CREATE TABLE `custom_consumable_components` (
	`id` text PRIMARY KEY NOT NULL,
	`consumable_id` text NOT NULL,
	`position` integer NOT NULL,
	`label` text NOT NULL,
	`quantity` real NOT NULL,
	`energy_kcal` real,
	`protein_g` real,
	`carbs_g` real,
	`fat_g` real,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_custom_consumable_components_parent` ON `custom_consumable_components` (`consumable_id`,`position`);--> statement-breakpoint
CREATE TABLE `custom_consumables` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`brand` text,
	`is_recipe` integer NOT NULL,
	`servings` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `daily_metrics` (
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
CREATE UNIQUE INDEX `idx_daily_metrics_natural` ON `daily_metrics` (`metric_slug`,`local_day`,`source`);--> statement-breakpoint
CREATE TABLE `day_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`local_day` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_day_notes_day` ON `day_notes` (`local_day`);--> statement-breakpoint
CREATE TABLE `goals` (
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
CREATE TABLE `habit_completions` (
	`id` text PRIMARY KEY NOT NULL,
	`habit_id` text NOT NULL,
	`local_day` text NOT NULL,
	`completed_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_habit_completions_natural` ON `habit_completions` (`habit_id`,`local_day`);--> statement-breakpoint
CREATE TABLE `habits` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`custom_label` text,
	`kind` text NOT NULL,
	`metric_slug` text,
	`direction` text,
	`target_value` real,
	`area_slug` text,
	`days_of_week` integer NOT NULL,
	`position` integer NOT NULL,
	`added_at` integer NOT NULL,
	`removed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `observations` (
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
	`slot` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_observations_metric_day` ON `observations` (`metric_slug`,`local_day`);--> statement-breakpoint
CREATE INDEX `idx_observations_day` ON `observations` (`local_day`);--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`minute_of_day` integer NOT NULL,
	`days_of_week` integer NOT NULL,
	`slot` text NOT NULL,
	`enabled` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tracked_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`metric_slug` text NOT NULL,
	`position` integer NOT NULL,
	`added_at` integer,
	`removed_at` integer,
	`custom_label` text,
	`check_in_slots` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `unit_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`dimension` text NOT NULL,
	`unit` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
