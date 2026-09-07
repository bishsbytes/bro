import i18n from "i18next";
import { resolveMetric } from "../content";

/**
 * A metric's label, falling back to the raw slug. Under sync a newer binary
 * can write slugs this one has never heard of, and a screen must show the
 * fact rather than hide it.
 */
export function metricLabel(metricSlug: string): string {
	const resolved = resolveMetric(metricSlug);
	return resolved.kind === "known" ? resolved.metric.label : metricSlug;
}

/** The event time and origin, shared by today's cards and past journal days. */
export function checkInSourceStamp(checkIn: {
	observedAt: number;
	mood: { source: string };
}): string {
	const date = new Date(checkIn.observedAt);
	return i18n.t("checkIn:sittings.recorded", {
		date: date.toLocaleDateString(i18n.language, {
			day: "numeric",
			month: "short",
		}),
		time: date.toLocaleTimeString(i18n.language, {
			hour: "2-digit",
			minute: "2-digit",
		}),
		source:
			checkIn.mood.source === "user"
				? i18n.t("checkIn:sittings.manualSource")
				: checkIn.mood.source,
	});
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
		`${i18n.t("checkIn:steps.moodLabel")} ${i18n.t(`checkIn:mood.${(["low", "flat", "okay", "good", "sharp"] as const)[checkIn.mood.value - 1] ?? "okay"}`)}`,
		...checkIn.optionalScores.map(
			(score) => `${metricLabel(score.metricSlug)} ${score.value}`,
		),
	].join(" · ");
}
