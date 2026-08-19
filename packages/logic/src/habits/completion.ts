import { isConsumptionDerivedMeasurementSlug } from "@bro/domain/metric-registry";
import type { Habit } from "@bro/mobile-model";
import type { ResolvedMetricDay } from "../health/resolved-day";

export type MetricHabit = Pick<
	Habit,
	"kind" | "metricSlug" | "direction" | "targetValue"
>;

/**
 * The value a habit judges a day by. Consumption metrics have no "not logged"
 * state a user can express, so for an at_most habit an entry-less day reads as
 * zero intake — an alcohol-free day self-completes. Everything else keeps
 * null (= no data): an at_least habit must never succeed on silence, and
 * imported metrics stay honest about missing device data.
 */
export function habitMetricDayValue(
	habit: MetricHabit,
	value: number | null,
): number | null {
	if (
		value === null &&
		habit.direction === "at_most" &&
		habit.metricSlug !== null &&
		isConsumptionDerivedMeasurementSlug(habit.metricSlug)
	) {
		return 0;
	}
	return value;
}

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
