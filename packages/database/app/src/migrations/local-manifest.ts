import type { Migration } from "./manifest";

/**
 * bro-local.db owns a separate migration history because the file is disposable
 * and never participates in product-data replication.
 */
export const localMigrations: Migration[] = [
	{
		id: "L001_health_import",
		sql: `CREATE TABLE IF NOT EXISTS \`health_connections\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`platform\` text NOT NULL,
	\`metric_slug\` text NOT NULL,
	\`change_token\` text,
	\`connected_at\` integer NOT NULL,
	\`last_imported_at\` integer,
	\`created_at\` integer NOT NULL,
	\`updated_at\` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS \`idx_health_connections_platform_metric\` ON \`health_connections\` (\`platform\`,\`metric_slug\`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`raw_samples\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`metric_slug\` text NOT NULL,
	\`value\` real NOT NULL,
	\`started_at\` integer NOT NULL,
	\`ended_at\` integer NOT NULL,
	\`local_day\` text NOT NULL,
	\`source\` text NOT NULL,
	\`source_record_id\` text NOT NULL,
	\`imported_at\` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS \`idx_raw_samples_identity\` ON \`raw_samples\` (\`source\`,\`source_record_id\`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS \`idx_raw_samples_metric_day\` ON \`raw_samples\` (\`metric_slug\`,\`local_day\`);`,
	},
	{
		// The recording origin (app package / bundle id) lets sum rollups collapse
		// the same activity recorded by two devices instead of double counting it.
		id: "L002_raw_sample_origin",
		sql: "ALTER TABLE `raw_samples` ADD COLUMN `origin` text;",
	},
	{
		id: "L003_food_cache",
		sql: `CREATE TABLE IF NOT EXISTS \`food_cache\` (
	\`ref\` text PRIMARY KEY NOT NULL,
	\`payload\` text NOT NULL,
	\`query\` text,
	\`fetched_at\` integer NOT NULL
);`,
	},
];
