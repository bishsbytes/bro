import type {
	Dimension,
	DisplayUnit,
	IntrinsicDimension,
	MetricDimension,
	UnitPreferenceDimension,
} from "../units";
import { LIFE_AREA_CATALOGUE, type LifeAreaSlug } from "./life-area-catalogue";

export type MetricKind = "scored" | "tag" | "assessment" | "measurement";
export type MetricAggregation = "mean" | "presence" | "last" | "sum";

/**
 * The two sittings a day holds. A check-in records which one it belongs to
 * rather than deriving it from the clock, so a late morning check-in stays the
 * morning one and an edit never moves it.
 */
export type CheckInSlot = "morning" | "evening";

export const CHECK_IN_SLOTS = [
	"morning",
	"evening",
] as const satisfies readonly CheckInSlot[];

/** Which sittings a scored prompt is asked in. */
export type CheckInSlotAssignment = CheckInSlot | "both";
export type TagCategory = "body" | "lifestyle" | "mind" | "social" | "sexual";
export type TagSlug =
	| "training"
	| "illness"
	| "poor_sleep_environment"
	| "late_screen"
	| "junk_food"
	| "stress"
	| "outdoors"
	| "social"
	| "sex"
	| "travel"
	| "masturbation"
	| "porn"
	| "morning_erection"
	| "hangover"
	| "muscle_soreness"
	| "cold_exposure"
	| "long_hours"
	| "meditation"
	| "anxiety"
	| "family_time"
	| "conflict";
export type UserEnterableMeasurementSlug =
	| "weight"
	| "waist"
	| "body_fat"
	| "resting_heart_rate"
	| TapeSiteSlug;
/**
 * A place a tape measure goes, in the order a tailor works down the body. The
 * body screen draws these on its pattern block; the order is the drawing's, so
 * it lives with the catalogue rather than with the geometry.
 */
export type TapeSiteSlug =
	| "neck"
	| "chest"
	| "bicep"
	| "waist"
	| "hip"
	| "thigh";

export const TAPE_SITE_SLUGS = [
	"neck",
	"chest",
	"bicep",
	"waist",
	"hip",
	"thigh",
] as const satisfies readonly TapeSiteSlug[];

export function isTapeSiteSlug(slug: string): slug is TapeSiteSlug {
	return (TAPE_SITE_SLUGS as readonly string[]).includes(slug);
}
export type UserEnterableMeasurementDimension =
	| "mass"
	| "length"
	| "fraction"
	| "rate_bpm";
export type BodyMetricGroup = "measurements" | "health_fitness";
export type ManualMeasurementCapture =
	| "standalone"
	| "measurement_session"
	| "both";
export type ImportedOnlyMeasurementSlug = "sleep_duration" | "steps";
export type ConsumptionDerivedMeasurementSlug =
	| "alcohol_intake"
	| "caffeine_intake"
	| "nicotine_intake"
	| "fluid_intake"
	| "energy_intake"
	| "protein_intake"
	| "carbs_intake"
	| "fat_intake";
export type MeasurementSlug =
	| UserEnterableMeasurementSlug
	| ImportedOnlyMeasurementSlug
	| ConsumptionDerivedMeasurementSlug;

type MetricDefinitionBase = {
	slug: string;
	label: string;
	kind: MetricKind;
	aggregation: MetricAggregation;
	sensitive: boolean;
	userEnterable: boolean;
	deprecated: boolean;
	defaultPosition: number;
	dimension: MetricDimension | null;
};

export type ScoredMetricDefinition = MetricDefinitionBase & {
	kind: "scored";
	aggregation: "mean";
	scaleMin: number;
	scaleMax: number;
	category: null;
	dimension: null;
	/**
	 * Which sittings ask this score before the user changes their settings. A
	 * score assigned to one slot is sampled at the same time every day, which is
	 * what makes its trend comparable across days.
	 */
	defaultCheckInSlots: CheckInSlotAssignment;
};

export type TagMetricDefinition = MetricDefinitionBase & {
	kind: "tag";
	aggregation: "presence";
	scaleMin: null;
	scaleMax: null;
	category: TagCategory;
	dimension: null;
	/**
	 * Whether the tag is in the panel before the user changes their settings.
	 */
	defaultEnabled: boolean;
};

export type AssessmentMetricDefinition = MetricDefinitionBase & {
	slug: LifeAreaSlug;
	kind: "assessment";
	aggregation: "mean";
	scaleMin: 1;
	scaleMax: 10;
	category: null;
	userEnterable: false;
	dimension: null;
};

type MeasurementMetricDefinitionBase = MetricDefinitionBase & {
	kind: "measurement";
	scaleMin: null;
	scaleMax: null;
	category: null;
	/** Overrides the physical dimension when display preferences need splitting. */
	unitPreferenceDimension?: UnitPreferenceDimension;
	/** A display form deliberately fixed for this metric. */
	fixedDisplayUnit?: DisplayUnit;
	/** Whether a connected health platform may supply this metric. */
	healthImport: boolean;
};

export type UserEnterableMeasurementMetricDefinition =
	MeasurementMetricDefinitionBase & {
		slug: UserEnterableMeasurementSlug;
		aggregation: "last" | "mean";
		dimension: UserEnterableMeasurementDimension;
		userEnterable: true;
		bodyGroup: BodyMetricGroup;
		manualCapture: ManualMeasurementCapture;
	};

export type ImportedOnlyMeasurementMetricDefinition =
	MeasurementMetricDefinitionBase & {
		slug: ImportedOnlyMeasurementSlug;
		aggregation: "sum" | "mean";
		dimension: IntrinsicDimension;
		userEnterable: false;
		bodyGroup: "health_fitness";
	};

export type ConsumptionDerivedMeasurementMetricDefinition =
	MeasurementMetricDefinitionBase & {
		slug: ConsumptionDerivedMeasurementSlug;
		aggregation: "sum";
		dimension: Dimension;
		userEnterable: false;
		measurementSource: "consumption";
	};

export type MeasurementMetricDefinition =
	| UserEnterableMeasurementMetricDefinition
	| ImportedOnlyMeasurementMetricDefinition
	| ConsumptionDerivedMeasurementMetricDefinition;

export type MetricDefinition =
	| ScoredMetricDefinition
	| TagMetricDefinition
	| AssessmentMetricDefinition
	| MeasurementMetricDefinition;

export type MetricResolution =
	| { kind: "known"; metric: MetricDefinition }
	| { kind: "unknown"; slug: string };

/**
 * The only value a tag observation ever carries. A tag that later needs
 * quantity gets a separate quantified-counterpart metric — as when the alcohol
 * and caffeine tags were replaced outright by the consumption-derived
 * `alcohol_intake`/`caffeine_intake`; reusing a tag's value would make
 * existing rows ambiguous. Convention: product plan, check-in domain.
 */
export const TAG_PRESENCE_VALUE = 1;

const scored = (
	slug: string,
	label: string,
	defaultPosition: number,
	options: {
		sensitive?: boolean;
		defaultCheckInSlots?: CheckInSlotAssignment;
	} = {},
): ScoredMetricDefinition => ({
	slug,
	label,
	kind: "scored",
	scaleMin: 1,
	scaleMax: 5,
	category: null,
	aggregation: "mean",
	sensitive: options.sensitive ?? false,
	userEnterable: true,
	deprecated: false,
	defaultPosition,
	dimension: null,
	defaultCheckInSlots: options.defaultCheckInSlots ?? "both",
});

const tag = (
	slug: TagSlug,
	label: string,
	category: TagCategory,
	defaultPosition: number,
	options: { sensitive?: boolean; defaultEnabled?: boolean } = {},
): TagMetricDefinition => ({
	slug,
	label,
	kind: "tag",
	scaleMin: null,
	scaleMax: null,
	category,
	aggregation: "presence",
	sensitive: options.sensitive ?? false,
	userEnterable: true,
	deprecated: false,
	defaultPosition,
	dimension: null,
	defaultEnabled: options.defaultEnabled ?? true,
});

const assessment = (
	slug: LifeAreaSlug,
	label: string,
	defaultPosition: number,
	sensitive: boolean,
): AssessmentMetricDefinition => ({
	slug,
	label,
	kind: "assessment",
	scaleMin: 1,
	scaleMax: 10,
	category: null,
	aggregation: "mean",
	sensitive,
	userEnterable: false,
	deprecated: false,
	defaultPosition,
	dimension: null,
});

const consumptionMeasurement = (
	slug: ConsumptionDerivedMeasurementSlug,
	label: string,
	dimension: Dimension,
	defaultPosition: number,
	sensitive: boolean,
	display:
		| { unitPreferenceDimension: UnitPreferenceDimension }
		| { fixedDisplayUnit: DisplayUnit },
): ConsumptionDerivedMeasurementMetricDefinition => ({
	slug,
	label,
	kind: "measurement",
	scaleMin: null,
	scaleMax: null,
	category: null,
	aggregation: "sum",
	dimension,
	sensitive,
	userEnterable: false,
	measurementSource: "consumption",
	healthImport: false,
	deprecated: false,
	defaultPosition,
	...display,
});

const measurement = (
	slug: UserEnterableMeasurementSlug,
	label: string,
	dimension: UserEnterableMeasurementDimension,
	defaultPosition: number,
	options: {
		bodyGroup: BodyMetricGroup;
		manualCapture: ManualMeasurementCapture;
		healthImport?: boolean;
		aggregation?: "last" | "mean";
	},
): UserEnterableMeasurementMetricDefinition => ({
	slug,
	label,
	kind: "measurement",
	scaleMin: null,
	scaleMax: null,
	category: null,
	aggregation: options.aggregation ?? "last",
	dimension,
	sensitive: true,
	userEnterable: true,
	bodyGroup: options.bodyGroup,
	manualCapture: options.manualCapture,
	healthImport: options.healthImport ?? false,
	deprecated: false,
	defaultPosition,
});

const importedMeasurement = (
	slug: ImportedOnlyMeasurementSlug,
	label: string,
	dimension: IntrinsicDimension,
	aggregation: "sum" | "mean",
	defaultPosition: number,
	sensitive: boolean,
): ImportedOnlyMeasurementMetricDefinition => ({
	slug,
	label,
	kind: "measurement",
	scaleMin: null,
	scaleMax: null,
	category: null,
	aggregation,
	dimension,
	sensitive,
	userEnterable: false,
	healthImport: true,
	bodyGroup: "health_fitness",
	deprecated: false,
	defaultPosition,
});

/**
 * Permanent authored slugs for the first check-in. Labels and grouping may
 * evolve, but a slug remains resolvable after it has been written.
 */
export const METRIC_REGISTRY = [
	// Mood anchors both sittings; the rest default to the sitting that asks
	// them at the most telling time of day.
	scored("mood", "Mood", 0),
	scored("energy", "Energy", 1, { defaultCheckInSlots: "morning" }),
	scored("motivation", "Motivation", 2, { defaultCheckInSlots: "morning" }),
	scored("productivity", "Productivity", 3, { defaultCheckInSlots: "evening" }),
	scored("libido", "Libido", 4, {
		sensitive: true,
		defaultCheckInSlots: "evening",
	}),
	tag("training", "Training", "body", 2),
	tag("illness", "Illness", "body", 3),
	tag("poor_sleep_environment", "Poor sleep environment", "lifestyle", 4),
	tag("late_screen", "Late screen", "lifestyle", 7),
	tag("junk_food", "Junk food", "lifestyle", 8),
	tag("stress", "Stress", "mind", 9),
	tag("outdoors", "Outdoors", "mind", 10),
	tag("social", "Social", "social", 11),
	tag("sex", "Sex", "sexual", 12, { sensitive: true }),
	tag("travel", "Travel", "social", 13),
	tag("masturbation", "Masturbation", "sexual", 14, {
		sensitive: true,
	}),
	tag("porn", "Porn", "sexual", 15, {
		sensitive: true,
	}),
	tag("morning_erection", "Morning erection", "sexual", 16, {
		sensitive: true,
	}),
	tag("hangover", "Hangover", "body", 17, {
		sensitive: true,
	}),
	tag("muscle_soreness", "Muscle soreness", "body", 18),
	tag("cold_exposure", "Cold exposure", "body", 19),
	// Position 20 was the `nicotine` tag, replaced outright by the quantified
	// `nicotine_intake`. Authored positions are defaults, so the gap costs
	// nothing, and the slug must not return as a tag: the metric owns it now.
	tag("long_hours", "Long hours", "lifestyle", 21),
	tag("meditation", "Meditation", "mind", 22),
	tag("anxiety", "Anxiety", "mind", 23),
	tag("family_time", "Family time", "social", 24),
	tag("conflict", "Conflict", "social", 25),
	measurement("weight", "Weight", "mass", 0, {
		bodyGroup: "measurements",
		manualCapture: "both",
		healthImport: true,
	}),
	measurement("waist", "Waist", "length", 1, {
		bodyGroup: "measurements",
		manualCapture: "measurement_session",
	}),
	measurement("body_fat", "Body fat", "fraction", 2, {
		bodyGroup: "measurements",
		manualCapture: "measurement_session",
		healthImport: true,
	}),
	// Tape sites join at the end of the measurement positions rather than in
	// anatomical order: a default position is what an overlay-less metric sorts
	// by, so renumbering the three originals would order new installs
	// differently from every existing one. The body screen orders the sites by
	// TAPE_SITE_SLUGS instead.
	measurement("neck", "Neck", "length", 14, {
		bodyGroup: "measurements",
		manualCapture: "measurement_session",
	}),
	measurement("chest", "Chest", "length", 15, {
		bodyGroup: "measurements",
		manualCapture: "measurement_session",
	}),
	measurement("bicep", "Bicep", "length", 16, {
		bodyGroup: "measurements",
		manualCapture: "measurement_session",
	}),
	measurement("hip", "Hip", "length", 17, {
		bodyGroup: "measurements",
		manualCapture: "measurement_session",
	}),
	measurement("thigh", "Thigh", "length", 18, {
		bodyGroup: "measurements",
		manualCapture: "measurement_session",
	}),
	importedMeasurement("sleep_duration", "Sleep", "time", "sum", 3, false),
	importedMeasurement("steps", "Steps", "count", "sum", 4, false),
	measurement("resting_heart_rate", "Resting heart rate", "rate_bpm", 5, {
		bodyGroup: "health_fitness",
		manualCapture: "standalone",
		healthImport: true,
		aggregation: "mean",
	}),
	consumptionMeasurement("alcohol_intake", "Alcohol", "mass", 6, true, {
		unitPreferenceDimension: "alcohol",
	}),
	consumptionMeasurement("caffeine_intake", "Caffeine", "mass", 7, false, {
		fixedDisplayUnit: "mg",
	}),
	consumptionMeasurement("nicotine_intake", "Nicotine", "mass", 13, true, {
		fixedDisplayUnit: "mg",
	}),
	consumptionMeasurement("fluid_intake", "Fluid intake", "volume", 8, false, {
		unitPreferenceDimension: "volume",
	}),
	consumptionMeasurement("energy_intake", "Energy intake", "energy", 9, false, {
		fixedDisplayUnit: "kcal",
	}),
	consumptionMeasurement("protein_intake", "Protein", "mass", 10, false, {
		fixedDisplayUnit: "g",
	}),
	consumptionMeasurement("carbs_intake", "Carbohydrate", "mass", 11, false, {
		fixedDisplayUnit: "g",
	}),
	consumptionMeasurement("fat_intake", "Fat", "mass", 12, false, {
		fixedDisplayUnit: "g",
	}),
	...LIFE_AREA_CATALOGUE.map((area) =>
		assessment(area.slug, area.label, area.defaultPosition, area.sensitive),
	),
] as const satisfies readonly MetricDefinition[];

const metricsBySlug = new Map<string, MetricDefinition>(
	METRIC_REGISTRY.map((metric) => [metric.slug, metric]),
);

/** Scored prompts after Mood that users may include in or remove from check-ins. */
export const CONFIGURABLE_CHECK_IN_METRIC_SLUGS = [
	"energy",
	"motivation",
	"productivity",
	"libido",
] as const;

function defaultsToEnabled(metric: MetricDefinition): boolean {
	if (metric.kind === "measurement") return false;
	if (metric.kind === "tag") return metric.defaultEnabled;
	return true;
}

export const DEFAULT_TRACKED_METRICS = METRIC_REGISTRY.filter(
	(metric) =>
		metric.userEnterable ||
		(metric.kind === "measurement" &&
			"measurementSource" in metric &&
			metric.measurementSource === "consumption"),
).map((metric) => ({
	metricSlug: metric.slug,
	position: metric.defaultPosition,
	...(defaultsToEnabled(metric) ? {} : { enabled: false }),
}));

/**
 * Mood is the one required check-in score. Every other scored prompt can be
 * disabled, so completion must not depend on Energy or another configurable
 * metric. Unrelated observations on the same day still do not count.
 */
export const CHECK_IN_METRIC_SLUGS = ["mood"] as const;

export function hasCompletedCheckIn(
	observations: readonly { readonly metricSlug: string }[],
): boolean {
	return CHECK_IN_METRIC_SLUGS.every((slug) =>
		observations.some((observation) => observation.metricSlug === slug),
	);
}

/** Which of the day's morning and evening sittings are done. */
export function completedCheckInSlots(
	observations: readonly {
		readonly metricSlug: string;
		readonly slot: CheckInSlot | null;
	}[],
): Set<CheckInSlot> {
	const completed = new Set<CheckInSlot>();
	for (const slot of CHECK_IN_SLOTS) {
		const done = CHECK_IN_METRIC_SLUGS.every((slug) =>
			observations.some(
				(observation) =>
					observation.metricSlug === slug && observation.slot === slot,
			),
		);
		if (done) {
			completed.add(slot);
		}
	}
	return completed;
}

export function isCheckInSlot(value: unknown): value is CheckInSlot {
	return CHECK_IN_SLOTS.some((slot) => slot === value);
}

export function isCheckInSlotAssignment(
	value: unknown,
): value is CheckInSlotAssignment {
	return value === "both" || isCheckInSlot(value);
}

/** Whether a prompt assigned this way is asked in the given sitting. */
export function assignmentIncludesSlot(
	assignment: CheckInSlotAssignment,
	slot: CheckInSlot,
): boolean {
	return assignment === "both" || assignment === slot;
}

/** Minute of day the morning stops being the obvious sitting. */
const MIDDAY_MINUTE = 12 * 60;

/**
 * The sitting a time belongs to when nobody has said. Used to seed a new
 * reminder and to suggest a card, never to classify a saved check-in — and it
 * is the same rule the reminder backfill migration applies.
 */
export function checkInSlotForMinuteOfDay(minuteOfDay: number): CheckInSlot {
	return minuteOfDay < MIDDAY_MINUTE ? "morning" : "evening";
}

/**
 * The sitting a check-in defaults to when the user opens the flow without
 * naming one. Only a suggestion — the slot that gets written is whichever
 * card was tapped.
 */
export function suggestedCheckInSlot(at: Date): CheckInSlot {
	return checkInSlotForMinuteOfDay(at.getHours() * 60 + at.getMinutes());
}

export function resolveMetric(slug: string): MetricResolution {
	const metric = metricsBySlug.get(slug);
	return metric ? { kind: "known", metric } : { kind: "unknown", slug };
}

export function isConsumptionDerivedMeasurementSlug(
	slug: string,
): slug is ConsumptionDerivedMeasurementSlug {
	const resolved = metricsBySlug.get(slug);
	return (
		resolved !== undefined &&
		resolved.kind === "measurement" &&
		"measurementSource" in resolved &&
		resolved.measurementSource === "consumption"
	);
}

export function listScoredMetrics(): ScoredMetricDefinition[] {
	return METRIC_REGISTRY.filter(
		(metric): metric is ScoredMetricDefinition => metric.kind === "scored",
	);
}

export function listTags(): TagMetricDefinition[] {
	return METRIC_REGISTRY.filter(
		(metric): metric is TagMetricDefinition => metric.kind === "tag",
	);
}

export function listAssessmentMetrics(): AssessmentMetricDefinition[] {
	return METRIC_REGISTRY.filter(
		(metric): metric is AssessmentMetricDefinition =>
			metric.kind === "assessment",
	);
}

export function listMeasurements(): MeasurementMetricDefinition[] {
	return METRIC_REGISTRY.filter(
		(metric): metric is MeasurementMetricDefinition =>
			metric.kind === "measurement",
	);
}

export function listUserEnterableMeasurements(): UserEnterableMeasurementMetricDefinition[] {
	return METRIC_REGISTRY.filter(
		(metric): metric is UserEnterableMeasurementMetricDefinition =>
			metric.kind === "measurement" && metric.userEnterable,
	);
}

export function listImportedOnlyMeasurements(): ImportedOnlyMeasurementMetricDefinition[] {
	return METRIC_REGISTRY.filter(
		(metric): metric is ImportedOnlyMeasurementMetricDefinition =>
			metric.kind === "measurement" &&
			!metric.userEnterable &&
			!("measurementSource" in metric),
	);
}

export function listConsumptionDerivedMeasurements(): ConsumptionDerivedMeasurementMetricDefinition[] {
	return METRIC_REGISTRY.filter(
		(metric): metric is ConsumptionDerivedMeasurementMetricDefinition =>
			metric.kind === "measurement" &&
			"measurementSource" in metric &&
			metric.measurementSource === "consumption",
	);
}
