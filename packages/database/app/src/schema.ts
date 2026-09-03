/**
 * Drizzle schema for the app's embedded libSQL/Turso database.
 *
 * This file drives `drizzle-kit generate`; it is never imported at runtime.
 * Application access goes through the raw-SQL repositories in src/repositories,
 * while Drizzle owns migration execution.
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
		// Written by the check-in, never derived from observed_at; null on every
		// other kind of observation.
		slot: text("slot"),
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
	// Slot override for a scored check-in prompt; null follows the registry.
	checkInSlots: text("check_in_slots"),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
});

export const reminders = sqliteTable(PRODUCT_TABLE_NAMES.reminders, {
	id: text("id").primaryKey(),
	minuteOfDay: integer("minute_of_day").notNull(),
	daysOfWeek: integer("days_of_week").notNull(),
	// Which sitting this reminder nags for.
	slot: text("slot").notNull(),
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
	// Snapshotted at creation like challenge enrolments: the association must
	// survive catalogue changes, and custom habits have no template to consult.
	areaSlug: text("area_slug"),
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

export const intakeEvents = sqliteTable(
	PRODUCT_TABLE_NAMES.intakeEvents,
	{
		id: text("id").primaryKey(),
		// The consumable's kind, snapshotted.
		kind: text("kind").notNull(),
		// Library row; may dangle after a delete.
		consumableId: text("consumable_id"),
		// 'system:drink:lager-4_5' | 'off:5000…' | 'community:<id>@<v>' | 'library:<id>'
		sourceRef: text("source_ref"),
		name: text("name").notNull(),
		brand: text("brand"),
		portionLabel: text("portion_label"),
		quantity: real("quantity").notNull(),
		// Amount consumed, where known.
		massKg: real("mass_kg"),
		volumeL: real("volume_l"),
		// JSON map code → canonical amount, already × quantity.
		constituents: text("constituents").notNull(),
		context: text("context"),
		notes: text("notes"),
		occurredAt: integer("occurred_at").notNull(),
		localDay: text("local_day").notNull(),
		tzOffsetMinutes: integer("tz_offset_minutes").notNull(),
		createdAt: integer("created_at").notNull(),
		updatedAt: integer("updated_at").notNull(),
	},
	(table) => [
		index("idx_intake_events_day").on(table.localDay),
		index("idx_intake_events_kind_day").on(table.kind, table.localDay),
	],
);

export const consumables = sqliteTable(
	PRODUCT_TABLE_NAMES.consumables,
	{
		id: text("id").primaryKey(),
		kind: text("kind").notNull(),
		name: text("name").notNull(),
		brand: text("brand"),
		barcode: text("barcode"),
		// JSON CompositionBasis.
		basis: text("basis").notNull(),
		// JSON map, per basis.
		constituents: text("constituents").notNull(),
		// JSON Portion[].
		portions: text("portions").notNull(),
		defaultPortionId: text("default_portion_id"),
		// JSON { yield } for a recipe, else NULL.
		recipe: text("recipe"),
		// 'user' | 'provider' | 'community'; system content never reaches here.
		sourceType: text("source_type").notNull(),
		// Provider external id or community content id.
		sourceRef: text("source_ref"),
		// Community version.
		sourceVersion: integer("source_version"),
		// JSON ContentSource.
		forkedFrom: text("forked_from"),
		archivedAt: integer("archived_at"),
		createdAt: integer("created_at").notNull(),
		updatedAt: integer("updated_at").notNull(),
	},
	(table) => [
		index("idx_consumables_kind").on(table.kind, table.archivedAt),
		// Provider idempotency: one library row per searched product.
		index("idx_consumables_source").on(table.sourceType, table.sourceRef),
	],
);

export const recipeIngredients = sqliteTable(
	PRODUCT_TABLE_NAMES.recipeIngredients,
	{
		id: text("id").primaryKey(),
		recipeId: text("recipe_id").notNull(),
		position: integer("position").notNull(),
		consumableId: text("consumable_id"),
		sourceRef: text("source_ref"),
		// Snapshot.
		name: text("name").notNull(),
		portionLabel: text("portion_label"),
		quantity: real("quantity").notNull(),
		massKg: real("mass_kg"),
		volumeL: real("volume_l"),
		// JSON map, scaled to this ingredient.
		constituents: text("constituents").notNull(),
		createdAt: integer("created_at").notNull(),
		updatedAt: integer("updated_at").notNull(),
	},
	(table) => [
		index("idx_recipe_ingredients_recipe").on(table.recipeId, table.position),
	],
);

export const intakeStreams = sqliteTable(PRODUCT_TABLE_NAMES.intakeStreams, {
	id: text("id").primaryKey(),
	kind: text("kind").notNull(),
	enabledAt: integer("enabled_at").notNull(),
	disabledAt: integer("disabled_at"),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
});
