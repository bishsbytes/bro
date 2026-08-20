/**
 * Local-calendar primitives shared by every surface that stores a `local_day`.
 *
 * A local day is the calendar date the user was living in when something
 * happened, formatted YYYY-MM-DD and resolved against the device's own clock
 * and offset. It is deliberately not a UTC date: a drink at 23:00 belongs to
 * that evening, not to the following morning.
 *
 * Health imports resolve days against an explicitly named time zone instead —
 * see the app's health/mapping module — because the sample's origin device may
 * not be the one reading it.
 */

/** True only for a YYYY-MM-DD string naming a real calendar date. */
export function isCalendarDay(value: string): boolean {
	const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(value);
	if (!match) {
		return false;
	}
	const [, year, month, day] = match;
	const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
	return (
		date.getUTCFullYear() === Number(year) &&
		date.getUTCMonth() === Number(month) - 1 &&
		date.getUTCDate() === Number(day)
	);
}

/** The local day a `Date` falls in, by the device's own clock. */
export function localDayOf(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function parseLocalDay(localDay: string): Date {
	if (!isCalendarDay(localDay)) {
		throw new TypeError("Local day must be a real YYYY-MM-DD date.");
	}
	return new Date(`${localDay}T00:00:00.000Z`);
}

/**
 * The local day `days` away from this one.
 *
 * The arithmetic runs in UTC even though the label names a local day: a day
 * label has no time in it, so shifting it must not consult a time zone. Doing
 * it locally would drop or repeat a day across a daylight-saving change.
 */
export function shiftLocalDay(localDay: string, days: number): string {
	if (!Number.isInteger(days)) {
		throw new TypeError("Local-day shift must be a whole number of days.");
	}
	const date = parseLocalDay(localDay);
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString().slice(0, 10);
}

/** Monday is bit zero, matching the reminder and habit cadence masks. */
export function isoWeekdayForLocalDay(localDay: string): number {
	return (parseLocalDay(localDay).getUTCDay() + 6) % 7;
}

export type WeekStartDay = "monday" | "saturday" | "sunday";

const ISO_WEEKDAY_BY_WEEK_START = {
	monday: 0,
	saturday: 5,
	sunday: 6,
} as const satisfies Record<WeekStartDay, number>;

/** The first local day of the presentation week containing `localDay`. */
export function weekStartOf(localDay: string, weekStart: WeekStartDay): string {
	const daysSinceStart =
		(isoWeekdayForLocalDay(localDay) -
			ISO_WEEKDAY_BY_WEEK_START[weekStart] +
			7) %
		7;
	return shiftLocalDay(localDay, -daysSinceStart);
}

export function previousLocalDay(localDay: string): string {
	return shiftLocalDay(localDay, -1);
}

/** The local wall-clock time of a timestamp, as HH:mm. */
export function localTimeOf(timestamp: number): string {
	const date = new Date(timestamp);
	return `${String(date.getHours()).padStart(2, "0")}:${String(
		date.getMinutes(),
	).padStart(2, "0")}`;
}

/** A day and wall-clock time as the user entered them. */
export type LocalMoment = {
	localDay: string;
	time: string;
};

export type ResolvedLocalMoment = {
	occurredAt: number;
	localDay: string;
	tzOffsetMinutes: number;
};

/**
 * Resolves a day and HH:mm time the user chose into the instant it names,
 * keeping the offset that was in force so the reading can be reconstructed.
 */
export function resolveLocalMoment({
	localDay,
	time,
}: LocalMoment): ResolvedLocalMoment {
	const dayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDay);
	const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
	if (!dayMatch || !timeMatch) {
		throw new TypeError("Choose a real date and a time in HH:mm format.");
	}
	const year = Number(dayMatch[1]);
	const month = Number(dayMatch[2]);
	const day = Number(dayMatch[3]);
	const hour = Number(timeMatch[1]);
	const minute = Number(timeMatch[2]);
	if (hour > 23 || minute > 59) {
		throw new TypeError("Choose a real date and a time in HH:mm format.");
	}
	const occurred = new Date(year, month - 1, day, hour, minute, 0, 0);
	if (
		occurred.getFullYear() !== year ||
		occurred.getMonth() !== month - 1 ||
		occurred.getDate() !== day
	) {
		throw new TypeError("Choose a real date and a time in HH:mm format.");
	}
	return {
		occurredAt: occurred.getTime(),
		localDay,
		tzOffsetMinutes: occurred.getTimezoneOffset(),
	};
}
