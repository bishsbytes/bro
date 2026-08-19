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
	uniqueIndex,
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

export const dailyMetrics = sqliteTable(
	PRODUCT_TABLE_NAMES.dailyMetrics,
	{
		id: text("id").primaryKey(),
		metricSlug: text("metric_slug").notNull(),
		localDay: text("local_day").notNull(),
		value: real("value").notNull(),
		source: text("source").notNull(),
		computedAt: integer("computed_at").notNull(),
		createdAt: integer("created_at").notNull(),
		updatedAt: integer("updated_at").notNull(),
	},
	(table) => [
		uniqueIndex("idx_daily_metrics_natural").on(
			table.metricSlug,
			table.localDay,
			table.source,
		),
	],
);

export const habits = sqliteTable(PRODUCT_TABLE_NAMES.habits, {
	id: text("id").primaryKey(),
	slug: text("slug").notNull(),
	customLabel: text("custom_label"),
	kind: text("kind").notNull(),
	metricSlug: text("metric_slug"),
	direction: text("direction"),
	targetValue: real("target_value"),
	daysOfWeek: integer("days_of_week").notNull(),
	position: integer("position").notNull(),
	addedAt: integer("added_at").notNull(),
	removedAt: integer("removed_at"),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
});

export const habitCompletions = sqliteTable(
	PRODUCT_TABLE_NAMES.habitCompletions,
	{
		id: text("id").primaryKey(),
		habitId: text("habit_id").notNull(),
		localDay: text("local_day").notNull(),
		completedAt: integer("completed_at").notNull(),
		createdAt: integer("created_at").notNull(),
		updatedAt: integer("updated_at").notNull(),
	},
	(table) => [
		uniqueIndex("idx_habit_completions_natural").on(
			table.habitId,
			table.localDay,
		),
	],
);

export const challengeEnrolments = sqliteTable(
	PRODUCT_TABLE_NAMES.challengeEnrolments,
	{
		id: text("id").primaryKey(),
		challengeSlug: text("challenge_slug").notNull(),
		title: text("title").notNull(),
		durationDays: integer("duration_days").notNull(),
		areaSlug: text("area_slug").notNull(),
		startedOn: text("started_on").notNull(),
		completedAt: integer("completed_at"),
		abandonedAt: integer("abandoned_at"),
		createdAt: integer("created_at").notNull(),
		updatedAt: integer("updated_at").notNull(),
	},
);

export const challengeProgress = sqliteTable(
	PRODUCT_TABLE_NAMES.challengeProgress,
	{
		id: text("id").primaryKey(),
		enrolmentId: text("enrolment_id").notNull(),
		dayIndex: integer("day_index").notNull(),
		localDay: text("local_day").notNull(),
		completedAt: integer("completed_at").notNull(),
		createdAt: integer("created_at").notNull(),
		updatedAt: integer("updated_at").notNull(),
	},
	(table) => [
		uniqueIndex("idx_challenge_progress_natural").on(
			table.enrolmentId,
			table.dayIndex,
		),
	],
);

export const consumptionEntries = sqliteTable(
	PRODUCT_TABLE_NAMES.consumptionEntries,
	{
		id: text("id").primaryKey(),
		kind: text("kind").notNull(),
		catalogueRef: text("catalogue_ref"),
		label: text("label").notNull(),
		servingLabel: text("serving_label"),
		quantity: real("quantity").notNull(),
		volumeL: real("volume_l"),
		ethanolKg: real("ethanol_kg"),
		caffeineKg: real("caffeine_kg"),
		energyKcal: real("energy_kcal"),
		occurredAt: integer("occurred_at").notNull(),
		localDay: text("local_day").notNull(),
		tzOffsetMinutes: integer("tz_offset_minutes").notNull(),
		createdAt: integer("created_at").notNull(),
		updatedAt: integer("updated_at").notNull(),
	},
	(table) => [
		index("idx_consumption_entries_day").on(table.localDay),
		index("idx_consumption_entries_kind_day").on(table.kind, table.localDay),
	],
);
