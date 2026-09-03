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
CREATE TABLE `consumables` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`brand` text,
	`barcode` text,
	`basis` text NOT NULL,
	`constituents` text NOT NULL,
	`portions` text NOT NULL,
	`default_portion_id` text,
	`recipe` text,
	`source_type` text NOT NULL,
	`source_ref` text,
	`source_version` integer,
	`forked_from` text,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_consumables_kind` ON `consumables` (`kind`,`archived_at`);--> statement-breakpoint
CREATE INDEX `idx_consumables_source` ON `consumables` (`source_type`,`source_ref`);--> statement-breakpoint
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
CREATE TABLE `intake_events` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`consumable_id` text,
	`source_ref` text,
	`name` text NOT NULL,
	`brand` text,
	`portion_label` text,
	`quantity` real NOT NULL,
	`mass_kg` real,
	`volume_l` real,
	`constituents` text NOT NULL,
	`context` text,
	`notes` text,
	`occurred_at` integer NOT NULL,
	`local_day` text NOT NULL,
	`tz_offset_minutes` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_intake_events_day` ON `intake_events` (`local_day`);--> statement-breakpoint
CREATE INDEX `idx_intake_events_kind_day` ON `intake_events` (`kind`,`local_day`);--> statement-breakpoint
CREATE TABLE `intake_streams` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`enabled_at` integer NOT NULL,
	`disabled_at` integer,
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
CREATE TABLE `recipe_ingredients` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`position` integer NOT NULL,
	`consumable_id` text,
	`source_ref` text,
	`name` text NOT NULL,
	`portion_label` text,
	`quantity` real NOT NULL,
	`mass_kg` real,
	`volume_l` real,
	`constituents` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_recipe_ingredients_recipe` ON `recipe_ingredients` (`recipe_id`,`position`);--> statement-breakpoint
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
