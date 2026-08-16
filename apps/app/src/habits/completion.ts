import type { Habit } from "@bro/database-app";
import type { ResolvedMetricDay } from "../health/resolved-day";

export type MetricHabit = Pick<
	Habit,
	"kind" | "metricSlug" | "direction" | "targetValue"
>;

/** Compares one resolved local-day value with a snapshotted metric target. */
export function isMetricHabitComplete(
	habit: MetricHabit,
	day: Pick<ResolvedMetricDay, "metricSlug" | "value">,
): boolean {
	if (
		habit.kind !== "metric" ||
		habit.metricSlug === null ||
		habit.direction === null ||
		habit.targetValue === null
	) {
		throw new TypeError("Metric completion requires a complete metric habit.");
	}
	if (habit.metricSlug !== day.metricSlug) {
		throw new TypeError(
			`Habit metric ${habit.metricSlug} does not match resolved metric ${day.metricSlug}.`,
		);
	}
	if (day.value === null) return false;
	if (!Number.isFinite(day.value)) {
		throw new TypeError("Resolved metric value must be finite or null.");
	}
	return habit.direction === "at_least"
		? day.value >= habit.targetValue
		: day.value <= habit.targetValue;
}
