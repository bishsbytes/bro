/**
 * bro-local.db owns a separate migration history because the file is disposable
 * and never participates in product-data replication. It is hand-written rather
 * than generated: local-schema.ts is a reference for the shape, not a codegen
 * source, so there is no drizzle-kit output to bundle.
 */
export const localMigrations = {
	journal: {
		entries: [
			{
				idx: 0,
				when: 0,
				tag: "L000_local_store",
				breakpoints: true,
			},
		],
	},
	migrations: {
		m0000: `CREATE TABLE \`health_connections\` (
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
CREATE INDEX \`idx_health_connections_platform_metric\` ON \`health_connections\` (\`platform\`,\`metric_slug\`);
--> statement-breakpoint
CREATE TABLE \`raw_samples\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`metric_slug\` text NOT NULL,
	\`value\` real NOT NULL,
	\`started_at\` integer NOT NULL,
	\`ended_at\` integer NOT NULL,
	\`local_day\` text NOT NULL,
	\`source\` text NOT NULL,
	\`source_record_id\` text NOT NULL,
	\`origin\` text,
	\`imported_at\` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX \`idx_raw_samples_identity\` ON \`raw_samples\` (\`source\`,\`source_record_id\`);
--> statement-breakpoint
CREATE INDEX \`idx_raw_samples_metric_day\` ON \`raw_samples\` (\`metric_slug\`,\`local_day\`);
--> statement-breakpoint
CREATE TABLE \`food_cache\` (
	\`ref\` text PRIMARY KEY NOT NULL,
	\`payload\` text NOT NULL,
	\`query\` text,
	\`fetched_at\` integer NOT NULL
);`,
	},
};
