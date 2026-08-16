CREATE TABLE IF NOT EXISTS `unit_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`dimension` text NOT NULL,
	`unit` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
