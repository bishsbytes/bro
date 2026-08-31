ALTER TABLE `observations` ADD `slot` text;--> statement-breakpoint
ALTER TABLE `reminders` ADD `slot` text;--> statement-breakpoint
ALTER TABLE `tracked_metrics` ADD `check_in_slots` text;