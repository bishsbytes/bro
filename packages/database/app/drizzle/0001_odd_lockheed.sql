CREATE TABLE IF NOT EXISTS `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`minute_of_day` integer NOT NULL,
	`days_of_week` integer NOT NULL,
	`enabled` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
