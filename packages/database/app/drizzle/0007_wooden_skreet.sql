CREATE TABLE IF NOT EXISTS `custom_consumable_components` (
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
CREATE INDEX IF NOT EXISTS `idx_custom_consumable_components_parent` ON `custom_consumable_components` (`consumable_id`,`position`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `custom_consumables` (
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
ALTER TABLE `consumption_entries` ADD `protein_g` real;--> statement-breakpoint
ALTER TABLE `consumption_entries` ADD `carbs_g` real;--> statement-breakpoint
ALTER TABLE `consumption_entries` ADD `fat_g` real;--> statement-breakpoint
ALTER TABLE `consumption_entries` ADD `consumable_ref` text;
