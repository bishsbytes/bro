/**
 * Drizzle schema for the app's embedded libSQL/Turso database.
 *
 * This file exists purely to drive `drizzle-kit generate`; it is never imported
 * at runtime. Runtime access goes through the raw-SQL repositories in
 * src/repositories, so adding a table here is step one of the recipe in
 * src/repositories/README.md.
 *
 * Keep the column names here aligned with the hand-written SQL in the runtime
 * repositories. The generated migrations are the only runtime artefact from
 * this module.
 */

import {
	index,
	integer,
	real,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";
import { PRODUCT_TABLE_NAMES } from "./product-tables";

export const observations = sqliteTable(
	PRODUCT_TABLE_NAMES.observations,
	{
		id: text("id").primaryKey(),
		metricSlug: text("metric_slug").notNull(),
		value: real("value").notNull(),
		scaleMin: real("scale_min"),
		scaleMax: real("scale_max"),
		observedAt: integer("observed_at").notNull(),
		localDay: text("local_day").notNull(),
		tzOffsetMinutes: integer("tz_offset_minutes").notNull(),
		source: text("source").notNull(),
		sourceRecordId: text("source_record_id"),
		assessmentId: text("assessment_id"),
		createdAt: integer("created_at").notNull(),
		updatedAt: integer("updated_at").notNull(),
	},
	(table) => [
		index("idx_observations_metric_day").on(table.metricSlug, table.localDay),
		index("idx_observations_day").on(table.localDay),
	],
);

export const dayNotes = sqliteTable(
	PRODUCT_TABLE_NAMES.dayNotes,
	{
		id: text("id").primaryKey(),
		localDay: text("local_day").notNull(),
		body: text("body").notNull(),
		createdAt: integer("created_at").notNull(),
		updatedAt: integer("updated_at").notNull(),
	},
	(table) => [index("idx_day_notes_day").on(table.localDay)],
);

export const trackedMetrics = sqliteTable(PRODUCT_TABLE_NAMES.trackedMetrics, {
	id: text("id").primaryKey(),
	metricSlug: text("metric_slug").notNull(),
	position: integer("position").notNull(),
	addedAt: integer("added_at"),
	removedAt: integer("removed_at"),
	customLabel: text("custom_label"),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
});

export const reminders = sqliteTable(PRODUCT_TABLE_NAMES.reminders, {
	id: text("id").primaryKey(),
	minuteOfDay: integer("minute_of_day").notNull(),
	daysOfWeek: integer("days_of_week").notNull(),
	enabled: integer("enabled").notNull(),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
});

export const assessments = sqliteTable(PRODUCT_TABLE_NAMES.assessments, {
	id: text("id").primaryKey(),
	templateSlug: text("template_slug").notNull(),
	templateVersion: integer("template_version").notNull(),
	startedAt: integer("started_at").notNull(),
	completedAt: integer("completed_at"),
	items: text("items").notNull(),
	focusItemSlugs: text("focus_item_slugs").notNull(),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
});

export const goals = sqliteTable(PRODUCT_TABLE_NAMES.goals, {
	id: text("id").primaryKey(),
	metricSlug: text("metric_slug").notNull(),
	direction: text("direction").notNull(),
	targetValue: real("target_value").notNull(),
	targetDate: text("target_date"),
	startedAt: integer("started_at").notNull(),
	achievedAt: integer("achieved_at"),
	abandonedAt: integer("abandoned_at"),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
});

export const unitPreferences = sqliteTable(
	PRODUCT_TABLE_NAMES.unitPreferences,
	{
		id: text("id").primaryKey(),
		dimension: text("dimension").notNull(),
		unit: text("unit").notNull(),
		createdAt: integer("created_at").notNull(),
		updatedAt: integer("updated_at").notNull(),
	},
);
