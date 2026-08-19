import type { Habit } from "@bro/database-app";
import { shiftLocalDay } from "@bro/domain";
import { isHealthMetricSlug } from "../health/policy";
import { isHabitScheduled } from "./cadence";
import { isMetricHabitComplete } from "./completion";

export type HabitAdherenceState = "done" | "missed" | "unscheduled" | "no-data";

export type HabitAdherenceDay = {
	localDay: string;
	state: HabitAdherenceState;
};

export type HabitAdherenceInput = {
	habit: Habit;
	fromLocalDay: string;
	throughLocalDay: string;
	startedOn: string;
	removedOn?: string | null;
	completedDays?: ReadonlySet<string>;
	metricValue?: (localDay: string) => number | null;
};

/** Derives a descriptive day-by-day record without storing an aggregate. */
export function deriveHabitAdherence({
	habit,
	fromLocalDay,
	throughLocalDay,
	startedOn,
	removedOn = null,
	completedDays = new Set(),
	metricValue,
}: HabitAdherenceInput): HabitAdherenceDay[] {
	const days: HabitAdherenceDay[] = [];
	for (
		let localDay = fromLocalDay;
		localDay <= throughLocalDay;
		localDay = shiftLocalDay(localDay, 1)
	) {
		if (
			localDay < startedOn ||
			(removedOn !== null && localDay > removedOn) ||
			!isHabitScheduled(localDay, habit.daysOfWeek)
		) {
			days.push({ localDay, state: "unscheduled" });
			continue;
		}
		if (habit.kind === "manual") {
			days.push({
				localDay,
				state: completedDays.has(localDay) ? "done" : "missed",
			});
			continue;
		}
		if (
			!habit.metricSlug ||
			!isHealthMetricSlug(habit.metricSlug) ||
			!metricValue
		) {
			days.push({ localDay, state: "no-data" });
			continue;
		}
		const value = metricValue(localDay);
		if (value === null) {
			days.push({ localDay, state: "no-data" });
			continue;
		}
		days.push({
			localDay,
			state: isMetricHabitComplete(habit, {
				metricSlug: habit.metricSlug,
				value,
			})
				? "done"
				: "missed",
		});
	}
	return days;
}
