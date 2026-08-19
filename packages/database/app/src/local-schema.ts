/**
 * Drizzle reference schema for the disposable health-import store.
 * Runtime access remains raw SQL through repositories, as with bro.db.
 */
import {
	index,
	integer,
	real,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { LOCAL_TABLE_NAMES } from "./local-tables";

export const healthConnections = sqliteTable(
	LOCAL_TABLE_NAMES.healthConnections,
	{
		id: text("id").primaryKey(),
		platform: text("platform").notNull(),
		metricSlug: text("metric_slug").notNull(),
		changeToken: text("change_token"),
		connectedAt: integer("connected_at").notNull(),
		lastImportedAt: integer("last_imported_at"),
		createdAt: integer("created_at").notNull(),
		updatedAt: integer("updated_at").notNull(),
	},
	(table) => [
		index("idx_health_connections_platform_metric").on(
			table.platform,
			table.metricSlug,
		),
	],
);

export const rawSamples = sqliteTable(
	LOCAL_TABLE_NAMES.rawSamples,
	{
		id: text("id").primaryKey(),
		metricSlug: text("metric_slug").notNull(),
		value: real("value").notNull(),
		startedAt: integer("started_at").notNull(),
		endedAt: integer("ended_at").notNull(),
		localDay: text("local_day").notNull(),
		source: text("source").notNull(),
		sourceRecordId: text("source_record_id").notNull(),
		origin: text("origin"),
		importedAt: integer("imported_at").notNull(),
	},
	(table) => [
		uniqueIndex("idx_raw_samples_identity").on(
			table.source,
			table.sourceRecordId,
		),
		index("idx_raw_samples_metric_day").on(table.metricSlug, table.localDay),
	],
);

export const foodCache = sqliteTable(LOCAL_TABLE_NAMES.foodCache, {
	ref: text("ref").primaryKey(),
	payload: text("payload").notNull(),
	query: text("query"),
	fetchedAt: integer("fetched_at").notNull(),
});
