import { resolveMetric } from "@bro/domain/metric-registry";

/** One face per point of the Mood scale, lowest first. */
export const MOOD_FACES = ["😞", "🙁", "😐", "🙂", "😄"] as const;

/**
 * A metric's label, falling back to the raw slug. Under sync a newer binary
 * can write slugs this one has never heard of, and a screen must show the
 * fact rather than hide it.
 */
export function metricLabel(metricSlug: string): string {
	const resolved = resolveMetric(metricSlug);
	return resolved.kind === "known" ? resolved.metric.label : metricSlug;
}

type ScoredCheckIn = {
	readonly mood: { readonly value: number };
	readonly optionalScores: readonly {
		readonly metricSlug: string;
		readonly value: number;
	}[];
};

/**
 * One line naming every score a check-in carries. Shared by Today, the
 * check-in flow's confirmation, and the history day view so the three cannot
 * describe the same entry differently.
 */
export function checkInScoreSummary(checkIn: ScoredCheckIn): string {
	return [
		`Mood ${checkIn.mood.value}`,
		...checkIn.optionalScores.map(
			(score) => `${metricLabel(score.metricSlug)} ${score.value}`,
		),
	].join(" · ");
}
