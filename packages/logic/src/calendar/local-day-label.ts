import { isCalendarDay, previousLocalDay } from "@bro/domain";

function assertLocalDays(localDay: string, todayLocalDay: string): void {
	if (!isCalendarDay(localDay) || !isCalendarDay(todayLocalDay)) {
		throw new TypeError("Local day must be a real YYYY-MM-DD date.");
	}
}

/** "Today" or "Yesterday" where either fits, otherwise null. */
function relativeLabel(localDay: string, todayLocalDay: string): string | null {
	if (localDay === todayLocalDay) return "Today";
	if (localDay === previousLocalDay(todayLocalDay)) return "Yesterday";
	return null;
}

function formatted(
	localDay: string,
	options: Intl.DateTimeFormatOptions,
	locale?: string,
): string {
	return new Intl.DateTimeFormat(locale, {
		...options,
		timeZone: "UTC",
	}).format(new Date(`${localDay}T00:00:00.000Z`));
}

/** "Today", "Yesterday", or a locale-formatted weekday-and-date label. */
export function formatLocalDayLabel(
	localDay: string,
	todayLocalDay: string,
	locale?: string,
): string {
	assertLocalDays(localDay, todayLocalDay);
	const relative = relativeLabel(localDay, todayLocalDay);
	if (relative) return relative;

	const sameYear = localDay.slice(0, 4) === todayLocalDay.slice(0, 4);
	return formatted(
		localDay,
		{
			weekday: "long",
			day: "numeric",
			month: "long",
			year: sameYear ? undefined : "numeric",
		},
		locale,
	);
}

/**
 * The same label, abbreviated for somewhere narrow — a navigation bar, a chip.
 *
 * Drops the weekday and shortens the month, which is what has to give when the
 * label shares a row with a title and a back button.
 */
export function formatLocalDayLabelShort(
	localDay: string,
	todayLocalDay: string,
	locale?: string,
): string {
	assertLocalDays(localDay, todayLocalDay);
	const relative = relativeLabel(localDay, todayLocalDay);
	if (relative) return relative;

	const sameYear = localDay.slice(0, 4) === todayLocalDay.slice(0, 4);
	return formatted(
		localDay,
		{
			day: "numeric",
			month: "short",
			year: sameYear ? undefined : "numeric",
		},
		locale,
	);
}
