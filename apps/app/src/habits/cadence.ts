const LOCAL_DAY_PATTERN = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
const EVERY_DAY_MASK = 0b111_1111;

function parseLocalDay(localDay: string): Date {
	const match = LOCAL_DAY_PATTERN.exec(localDay);
	if (!match) {
		throw new TypeError("Local day must be a real YYYY-MM-DD date.");
	}
	const [, year, month, day] = match;
	const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
	if (
		date.getUTCFullYear() !== Number(year) ||
		date.getUTCMonth() !== Number(month) - 1 ||
		date.getUTCDate() !== Number(day)
	) {
		throw new TypeError("Local day must be a real YYYY-MM-DD date.");
	}
	return date;
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

function formatLocalDay(date: Date): string {
	return [
		date.getUTCFullYear().toString().padStart(4, "0"),
		(date.getUTCMonth() + 1).toString().padStart(2, "0"),
		date.getUTCDate().toString().padStart(2, "0"),
	].join("-");
}

/** Calendar arithmetic in UTC preserves local-day labels across DST changes. */
export function shiftLocalDay(localDay: string, amount: number): string {
	if (!Number.isInteger(amount)) {
		throw new TypeError("Local-day shift must be a whole number of days.");
	}
	const date = parseLocalDay(localDay);
	date.setUTCDate(date.getUTCDate() + amount);
	return formatLocalDay(date);
}

/** Monday is bit zero, matching reminder cadence. */
export function isoWeekdayForLocalDay(localDay: string): number {
	return (parseLocalDay(localDay).getUTCDay() + 6) % 7;
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
	parseLocalDay(fromLocalDay);
	parseLocalDay(throughLocalDay);
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
