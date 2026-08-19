import type { InsightCatalogueEntry } from "@bro/domain/insight-catalogue";
import type { InsightTeaser, ShownInsight } from "./engine";

export function formatInsightValue(
	pair: InsightCatalogueEntry,
	value: number,
): string {
	if (pair.outputMetricSlug !== "sleep_duration") return value.toFixed(1);
	const totalMinutes = Math.round(value / 60);
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	return `${hours} h ${minutes} m`;
}

/**
 * The teaser promise must stay arithmetic: name only days the user can
 * actually add, and say which kind. A shortfall no new day is guaranteed to
 * close (effect floor, stability) gets the generic sentence instead.
 */
export function renderInsightTeaserProgress(teaser: InsightTeaser): string {
	const nearest = teaser.nearest;
	if (nearest) {
		const days =
			nearest.remaining === 1 ? "1 more day" : `${nearest.remaining} more days`;
		if (nearest.gate === "output-days") {
			return nearest.pair.outputMetricSlug === "sleep_duration"
				? `The closest needs ${days} of sleep data.`
				: `The closest needs ${days} of check-ins.`;
		}
		if (nearest.gate === "true-arm-days") {
			return `The closest needs ${days} matching “${nearest.pair.copy.trueArmLabel}”.`;
		}
		if (nearest.gate === "false-arm-days") {
			return `The closest needs ${days} matching “${nearest.pair.copy.falseArmLabel}”.`;
		}
	}
	return "The record is growing, but no pattern clears every evidence gate yet.";
}

export function renderInsightSummary(insight: ShownInsight): string {
	return insight.pair.copy.summary
		.replace(
			"{trueMean}",
			formatInsightValue(insight.pair, insight.trueArm.mean),
		)
		.replace(
			"{falseMean}",
			formatInsightValue(insight.pair, insight.falseArm.mean),
		)
		.replace("{trueCount}", String(insight.trueArm.count))
		.replace("{falseCount}", String(insight.falseArm.count));
}
