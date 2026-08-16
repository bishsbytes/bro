import { isHabitScheduled, shiftLocalDay } from "./cadence";

export type HabitStreakInput = {
	startedOn: string;
	todayLocalDay: string;
	daysOfWeek: number;
	isComplete: (localDay: string) => boolean;
};

/**
 * Walks scheduled days backwards. An incomplete today is provisionally skipped;
 * every earlier incomplete scheduled day ends the streak.
 */
export function deriveHabitStreak(input: HabitStreakInput): number {
	const { startedOn, todayLocalDay, daysOfWeek, isComplete } = input;
	// These calls validate both calendar days and the cadence even when the habit
	// has not started yet.
	isHabitScheduled(startedOn, daysOfWeek);
	const todayScheduled = isHabitScheduled(todayLocalDay, daysOfWeek);
	if (startedOn > todayLocalDay) return 0;

	let streak = 0;
	let cursor = todayLocalDay;
	if (todayScheduled) {
		if (isComplete(todayLocalDay)) streak += 1;
		cursor = shiftLocalDay(cursor, -1);
	}

	while (cursor >= startedOn) {
		if (isHabitScheduled(cursor, daysOfWeek)) {
			if (!isComplete(cursor)) break;
			streak += 1;
		}
		cursor = shiftLocalDay(cursor, -1);
	}
	return streak;
}
