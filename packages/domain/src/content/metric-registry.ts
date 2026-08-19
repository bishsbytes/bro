import type {
	Dimension,
	DisplayUnit,
	IntrinsicDimension,
	MetricDimension,
	UnitPreferenceDimension,
} from "../units";
import { LIFE_AREA_CATALOGUE, type LifeAreaSlug } from "./life-area-catalogue";

export type MetricKind = "scored" | "factor" | "assessment" | "measurement";
export type MetricAggregation = "mean" | "presence" | "last" | "sum";
export type FactorCategory = "body" | "lifestyle" | "mind" | "social";
export type UserEnterableMeasurementSlug = "weight" | "waist" | "body_fat";
export type UserEnterableMeasurementDimension = "mass" | "length" | "fraction";
export type ImportedOnlyMeasurementSlug =
	| "sleep_duration"
	| "steps"
	| "resting_heart_rate";
export type ConsumptionDerivedMeasurementSlug =
	| "alcohol_intake"
	| "caffeine_intake"
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
};

export type FactorMetricDefinition = MetricDefinitionBase & {
	kind: "factor";
	aggregation: "presence";
	scaleMin: null;
	scaleMax: null;
	category: FactorCategory;
	dimension: null;
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
};

export type UserEnterableMeasurementMetricDefinition =
	MeasurementMetricDefinitionBase & {
		slug: UserEnterableMeasurementSlug;
		aggregation: "last";
		dimension: UserEnterableMeasurementDimension;
		userEnterable: true;
	};

export type ImportedOnlyMeasurementMetricDefinition =
	MeasurementMetricDefinitionBase & {
		slug: ImportedOnlyMeasurementSlug;
		aggregation: "sum" | "mean";
		dimension: IntrinsicDimension;
		userEnterable: false;
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
	| FactorMetricDefinition
	| AssessmentMetricDefinition
	| MeasurementMetricDefinition;

export type MetricResolution =
	| { kind: "known"; metric: MetricDefinition }
	| { kind: "unknown"; slug: string };

/**
 * The only value a factor observation ever carries. A factor that later needs
 * quantity gets a separate quantified-counterpart metric — as when the alcohol
 * and caffeine factors were replaced outright by the consumption-derived
 * `alcohol_intake`/`caffeine_intake`; reusing a factor's value would make
 * existing rows ambiguous. Convention: product plan, check-in domain.
 */
export const FACTOR_PRESENCE_VALUE = 1;

const scored = (
	slug: string,
	label: string,
	defaultPosition: number,
): ScoredMetricDefinition => ({
	slug,
	label,
	kind: "scored",
	scaleMin: 1,
	scaleMax: 5,
	category: null,
	aggregation: "mean",
	sensitive: false,
	userEnterable: true,
	deprecated: false,
	defaultPosition,
	dimension: null,
});

const factor = (
	slug: string,
	label: string,
	category: FactorCategory,
	defaultPosition: number,
): FactorMetricDefinition => ({
	slug,
	label,
	kind: "factor",
	scaleMin: null,
	scaleMax: null,
	category,
	aggregation: "presence",
	sensitive: false,
	userEnterable: true,
	deprecated: false,
	defaultPosition,
	dimension: null,
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
	deprecated: false,
	defaultPosition,
	...display,
});

const measurement = (
	slug: UserEnterableMeasurementSlug,
	label: string,
	dimension: UserEnterableMeasurementDimension,
	defaultPosition: number,
): UserEnterableMeasurementMetricDefinition => ({
	slug,
	label,
	kind: "measurement",
	scaleMin: null,
	scaleMax: null,
	category: null,
	aggregation: "last",
	dimension,
	sensitive: true,
	userEnterable: true,
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
	deprecated: false,
	defaultPosition,
});

/**
 * Permanent authored slugs for the first check-in. Labels and grouping may
 * evolve, but a slug remains resolvable after it has been written.
 */
export const METRIC_REGISTRY = [
	scored("mood", "Mood", 0),
	scored("energy", "Energy", 1),
	factor("training", "Training", "body", 2),
	factor("illness", "Illness", "body", 3),
	factor("poor_sleep_environment", "Poor sleep environment", "body", 4),
	factor("late_screen", "Late screen", "lifestyle", 7),
	factor("junk_food", "Junk food", "lifestyle", 8),
	factor("stress", "Stress", "mind", 9),
	factor("outdoors", "Outdoors", "mind", 10),
	factor("social", "Social", "social", 11),
	factor("sex", "Sex", "social", 12),
	factor("travel", "Travel", "social", 13),
	measurement("weight", "Weight", "mass", 0),
	measurement("waist", "Waist", "length", 1),
	measurement("body_fat", "Body fat", "fraction", 2),
	importedMeasurement("sleep_duration", "Sleep", "time", "sum", 3, false),
	importedMeasurement("steps", "Steps", "count", "sum", 4, false),
	importedMeasurement(
		"resting_heart_rate",
		"Resting heart rate",
		"rate_bpm",
		"mean",
		5,
		true,
	),
	consumptionMeasurement("alcohol_intake", "Alcohol", "mass", 6, true, {
		unitPreferenceDimension: "alcohol",
	}),
	consumptionMeasurement("caffeine_intake", "Caffeine", "mass", 7, false, {
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

export const DEFAULT_TRACKED_METRICS = METRIC_REGISTRY.filter(
	(metric) =>
		metric.userEnterable ||
		(metric.kind === "measurement" &&
			"measurementSource" in metric &&
			metric.measurementSource === "consumption"),
).map((metric) => ({
	metricSlug: metric.slug,
	position: metric.defaultPosition,
	...(metric.kind === "measurement" ? { enabled: false } : {}),
}));

/**
 * A check-in writes exactly these two scored metrics, together, in one
 * transaction. Any other observation on the same day — a weight, a wheel
 * review — is not a check-in, so nothing may infer "the user checked in
 * today" from an observation count.
 */
export const CHECK_IN_METRIC_SLUGS = ["mood", "energy"] as const;

export function hasCompletedCheckIn(
	observations: readonly { readonly metricSlug: string }[],
): boolean {
	return CHECK_IN_METRIC_SLUGS.every((slug) =>
		observations.some((observation) => observation.metricSlug === slug),
	);
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

export function listFactors(): FactorMetricDefinition[] {
	return METRIC_REGISTRY.filter(
		(metric): metric is FactorMetricDefinition => metric.kind === "factor",
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
