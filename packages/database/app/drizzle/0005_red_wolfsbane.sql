CREATE TABLE IF NOT EXISTS `challenge_enrolments` (
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
CREATE TABLE IF NOT EXISTS `challenge_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`enrolment_id` text NOT NULL,
	`day_index` integer NOT NULL,
	`local_day` text NOT NULL,
	`completed_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_challenge_progress_natural` ON `challenge_progress` (`enrolment_id`,`day_index`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `habit_completions` (
	`id` text PRIMARY KEY NOT NULL,
	`habit_id` text NOT NULL,
	`local_day` text NOT NULL,
	`completed_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_habit_completions_natural` ON `habit_completions` (`habit_id`,`local_day`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `habits` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`custom_label` text,
	`kind` text NOT NULL,
	`metric_slug` text,
	`direction` text,
	`target_value` real,
	`days_of_week` integer NOT NULL,
	`position` integer NOT NULL,
	`added_at` integer NOT NULL,
	`removed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
