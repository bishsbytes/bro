import type { Dimension } from "../units";
import { LIFE_AREA_CATALOGUE, type LifeAreaSlug } from "./life-area-catalogue";

export type MetricKind = "scored" | "factor" | "assessment" | "measurement";
export type MetricAggregation = "mean" | "presence" | "last";
export type FactorCategory = "body" | "lifestyle" | "mind" | "social";
export type MeasurementSlug = "weight" | "waist" | "body_fat";

type MetricDefinitionBase = {
	slug: string;
	label: string;
	kind: MetricKind;
	aggregation: MetricAggregation;
	sensitive: boolean;
	userEnterable: boolean;
	deprecated: boolean;
	defaultPosition: number;
	dimension: Dimension | null;
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

export type MeasurementMetricDefinition = MetricDefinitionBase & {
	slug: MeasurementSlug;
	kind: "measurement";
	aggregation: "last";
	scaleMin: null;
	scaleMax: null;
	category: null;
	dimension: Dimension;
	userEnterable: true;
};

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
 * quantity gets a separate quantified-counterpart metric (`alcohol` →
 * `alcohol_units`); reusing the factor's value would make existing rows
 * ambiguous. Convention: product plan, check-in domain.
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

const measurement = (
	slug: MeasurementSlug,
	label: string,
	dimension: Dimension,
	defaultPosition: number,
): MeasurementMetricDefinition => ({
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
	factor("caffeine", "Caffeine", "lifestyle", 5),
	factor("alcohol", "Alcohol", "lifestyle", 6),
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
	...LIFE_AREA_CATALOGUE.map((area) =>
		assessment(area.slug, area.label, area.defaultPosition, area.sensitive),
	),
] as const satisfies readonly MetricDefinition[];

const metricsBySlug = new Map<string, MetricDefinition>(
	METRIC_REGISTRY.map((metric) => [metric.slug, metric]),
);

export const DEFAULT_TRACKED_METRICS = METRIC_REGISTRY.filter(
	(metric) => metric.userEnterable,
).map((metric) => ({
	metricSlug: metric.slug,
	position: metric.defaultPosition,
	...(metric.kind === "measurement" ? { enabled: false } : {}),
}));

export function resolveMetric(slug: string): MetricResolution {
	const metric = metricsBySlug.get(slug);
	return metric ? { kind: "known", metric } : { kind: "unknown", slug };
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
