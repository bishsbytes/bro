import {
	isCalendarDay,
	isoWeekdayForLocalDay,
	shiftLocalDay,
} from "@bro/domain";

const EVERY_DAY_MASK = 0b111_1111;

function assertLocalDay(localDay: string): void {
	if (!isCalendarDay(localDay)) {
		throw new TypeError("Local day must be a real YYYY-MM-DD date.");
	}
}

function assertCadence(daysOfWeek: number): void {
	if (
		!Number.isInteger(daysOfWeek) ||
		daysOfWeek < 1 ||
		daysOfWeek > EVERY_DAY_MASK
	) {
		throw new RangeError("Habit cadence must select at least one valid day.");
	}
}

export function isHabitScheduled(
	localDay: string,
	daysOfWeek: number,
): boolean {
	assertCadence(daysOfWeek);
	return (daysOfWeek & (1 << isoWeekdayForLocalDay(localDay))) !== 0;
}

/** Expands an inclusive calendar-day range to only the habit's scheduled days. */
export function scheduledDaysBetween(
	fromLocalDay: string,
	throughLocalDay: string,
	daysOfWeek: number,
): string[] {
	assertCadence(daysOfWeek);
	assertLocalDay(fromLocalDay);
	assertLocalDay(throughLocalDay);
	if (fromLocalDay > throughLocalDay) {
		throw new RangeError("Habit cadence range must run forwards.");
	}

	const scheduled: string[] = [];
	for (
		let localDay = fromLocalDay;
		localDay <= throughLocalDay;
		localDay = shiftLocalDay(localDay, 1)
	) {
		if (isHabitScheduled(localDay, daysOfWeek)) scheduled.push(localDay);
	}
	return scheduled;
}
