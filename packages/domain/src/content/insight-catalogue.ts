import { KILOGRAMS_ETHANOL_PER_UK_UNIT } from "../units";

export type InsightTier = "premium";

export type InsightPresenceInput = {
	kind: "presence";
	metricSlug: string;
};

export type InsightThresholdInput = {
	kind: "threshold";
	metricSlug: string;
	operator: "below" | "at_least";
	value: number;
	unit: "seconds" | "count" | "kilograms";
};

export type InsightCopyTemplate = {
	summary: string;
	trueArmLabel: string;
	falseArmLabel: string;
};

export type InsightCatalogueEntry = {
	id: `insight:${string}`;
	input: InsightPresenceInput | InsightThresholdInput;
	outputMetricSlug: "mood" | "energy" | "sleep_duration";
	lagDays: 0 | 1;
	tier: InsightTier;
	copy: InsightCopyTemplate;
};

/**
 * Authored pairs are deliberately few and reviewable. An entry is product copy,
 * not persisted data: changing its wording never requires a migration.
 */
export const INSIGHT_CATALOGUE = [
	{
		id: "insight:alcohol-energy-lag1",
		input: { kind: "presence", metricSlug: "alcohol" },
		outputMetricSlug: "energy",
		lagDays: 1,
		tier: "premium",
		copy: {
			summary:
				"Your energy averaged {trueMean} on days after drinking ({trueCount} days), against {falseMean} after days without alcohol ({falseCount} days).",
			trueArmLabel: "Days after drinking",
			falseArmLabel: "After days without alcohol",
		},
	},
	{
		id: "insight:alcohol-mood-lag1",
		input: { kind: "presence", metricSlug: "alcohol" },
		outputMetricSlug: "mood",
		lagDays: 1,
		tier: "premium",
		copy: {
			summary:
				"Your mood averaged {trueMean} on days after drinking ({trueCount} days), against {falseMean} after days without alcohol ({falseCount} days).",
			trueArmLabel: "Days after drinking",
			falseArmLabel: "After days without alcohol",
		},
	},
	{
		id: "insight:late_screen-sleep_duration-lag1",
		input: { kind: "presence", metricSlug: "late_screen" },
		outputMetricSlug: "sleep_duration",
		lagDays: 1,
		tier: "premium",
		copy: {
			summary:
				"Your sleep averaged {trueMean} after late-screen days ({trueCount} days), against {falseMean} otherwise ({falseCount} days).",
			trueArmLabel: "After late-screen days",
			falseArmLabel: "After other days",
		},
	},
	{
		id: "insight:late_screen-energy-lag1",
		input: { kind: "presence", metricSlug: "late_screen" },
		outputMetricSlug: "energy",
		lagDays: 1,
		tier: "premium",
		copy: {
			summary:
				"Your energy averaged {trueMean} on days after late screen use ({trueCount} days), against {falseMean} otherwise ({falseCount} days).",
			trueArmLabel: "Days after late screen use",
			falseArmLabel: "After other days",
		},
	},
	{
		id: "insight:caffeine-sleep_duration-lag1",
		input: { kind: "presence", metricSlug: "caffeine" },
		outputMetricSlug: "sleep_duration",
		lagDays: 1,
		tier: "premium",
		copy: {
			summary:
				"Your sleep averaged {trueMean} after caffeine days ({trueCount} days), against {falseMean} otherwise ({falseCount} days).",
			trueArmLabel: "After caffeine days",
			falseArmLabel: "After other days",
		},
	},
	{
		id: "insight:poor_sleep_environment-sleep_duration",
		input: { kind: "presence", metricSlug: "poor_sleep_environment" },
		outputMetricSlug: "sleep_duration",
		lagDays: 0,
		tier: "premium",
		copy: {
			summary:
				"Your sleep averaged {trueMean} when you noted a poor sleep environment ({trueCount} days), against {falseMean} otherwise ({falseCount} days).",
			trueArmLabel: "Poor sleep environment noted",
			falseArmLabel: "Not noted",
		},
	},
	{
		id: "insight:sleep_duration-below-21600-mood",
		input: {
			kind: "threshold",
			metricSlug: "sleep_duration",
			operator: "below",
			value: 21_600,
			unit: "seconds",
		},
		outputMetricSlug: "mood",
		lagDays: 0,
		tier: "premium",
		copy: {
			summary:
				"Your mood averaged {trueMean} on days with under 6 hours of sleep ({trueCount} days), against {falseMean} with 6 hours or more ({falseCount} days).",
			trueArmLabel: "Under 6 hours",
			falseArmLabel: "6 hours or more",
		},
	},
	{
		id: "insight:sleep_duration-below-21600-energy",
		input: {
			kind: "threshold",
			metricSlug: "sleep_duration",
			operator: "below",
			value: 21_600,
			unit: "seconds",
		},
		outputMetricSlug: "energy",
		lagDays: 0,
		tier: "premium",
		copy: {
			summary:
				"Your energy averaged {trueMean} on days with under 6 hours of sleep ({trueCount} days), against {falseMean} with 6 hours or more ({falseCount} days).",
			trueArmLabel: "Under 6 hours",
			falseArmLabel: "6 hours or more",
		},
	},
	{
		id: "insight:steps-at_least-8000-mood",
		input: {
			kind: "threshold",
			metricSlug: "steps",
			operator: "at_least",
			value: 8_000,
			unit: "count",
		},
		outputMetricSlug: "mood",
		lagDays: 0,
		tier: "premium",
		copy: {
			summary:
				"Your mood averaged {trueMean} on days with at least 8,000 steps ({trueCount} days), against {falseMean} on lower-step days ({falseCount} days).",
			trueArmLabel: "At least 8,000 steps",
			falseArmLabel: "Under 8,000 steps",
		},
	},
	{
		id: "insight:training-mood",
		input: { kind: "presence", metricSlug: "training" },
		outputMetricSlug: "mood",
		lagDays: 0,
		tier: "premium",
		copy: {
			summary:
				"Your mood averaged {trueMean} on training days ({trueCount} days), against {falseMean} on other days ({falseCount} days).",
			trueArmLabel: "Training days",
			falseArmLabel: "Other days",
		},
	},
	{
		id: "insight:stress-mood",
		input: { kind: "presence", metricSlug: "stress" },
		outputMetricSlug: "mood",
		lagDays: 0,
		tier: "premium",
		copy: {
			summary:
				"Your mood averaged {trueMean} on days you noted stress ({trueCount} days), against {falseMean} on other days ({falseCount} days).",
			trueArmLabel: "Stress noted",
			falseArmLabel: "Not noted",
		},
	},
	{
		id: "insight:outdoors-mood",
		input: { kind: "presence", metricSlug: "outdoors" },
		outputMetricSlug: "mood",
		lagDays: 0,
		tier: "premium",
		copy: {
			summary:
				"Your mood averaged {trueMean} on days you spent time outdoors ({trueCount} days), against {falseMean} on other days ({falseCount} days).",
			trueArmLabel: "Outdoors days",
			falseArmLabel: "Other days",
		},
	},
	{
		id: "insight:social-mood",
		input: { kind: "presence", metricSlug: "social" },
		outputMetricSlug: "mood",
		lagDays: 0,
		tier: "premium",
		copy: {
			summary:
				"Your mood averaged {trueMean} on days you noted social time ({trueCount} days), against {falseMean} on other days ({falseCount} days).",
			trueArmLabel: "Social time noted",
			falseArmLabel: "Not noted",
		},
	},
	{
		id: "insight:junk_food-energy-lag1",
		input: { kind: "presence", metricSlug: "junk_food" },
		outputMetricSlug: "energy",
		lagDays: 1,
		tier: "premium",
		copy: {
			summary:
				"Your energy averaged {trueMean} on days after junk food ({trueCount} days), against {falseMean} otherwise ({falseCount} days).",
			trueArmLabel: "Days after junk food",
			falseArmLabel: "After other days",
		},
	},
	{
		id: "insight:alcohol_intake-at_least-four-units-energy-lag1",
		input: {
			kind: "threshold",
			metricSlug: "alcohol_intake",
			operator: "at_least",
			value: 4 * KILOGRAMS_ETHANOL_PER_UK_UNIT,
			unit: "kilograms",
		},
		outputMetricSlug: "energy",
		lagDays: 1,
		tier: "premium",
		copy: {
			summary:
				"Your energy averaged {trueMean} on days after logging 4 or more units ({trueCount} days), against {falseMean} after lower-alcohol days ({falseCount} days).",
			trueArmLabel: "After 4 or more units",
			falseArmLabel: "After fewer than 4 units",
		},
	},
	{
		id: "insight:alcohol_intake-at_least-four-units-sleep_duration-lag1",
		input: {
			kind: "threshold",
			metricSlug: "alcohol_intake",
			operator: "at_least",
			value: 4 * KILOGRAMS_ETHANOL_PER_UK_UNIT,
			unit: "kilograms",
		},
		outputMetricSlug: "sleep_duration",
		lagDays: 1,
		tier: "premium",
		copy: {
			summary:
				"Your sleep averaged {trueMean} after logging 4 or more units ({trueCount} days), against {falseMean} after lower-alcohol days ({falseCount} days).",
			trueArmLabel: "After 4 or more units",
			falseArmLabel: "After fewer than 4 units",
		},
	},
] as const satisfies readonly InsightCatalogueEntry[];

export type InsightId = (typeof INSIGHT_CATALOGUE)[number]["id"];

export function resolveInsight(id: string): InsightCatalogueEntry | null {
	return INSIGHT_CATALOGUE.find((entry) => entry.id === id) ?? null;
}
