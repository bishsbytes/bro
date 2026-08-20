import { isCalendarDay, previousLocalDay } from "@bro/domain";

/** "Today", "Yesterday", or a locale-formatted weekday-and-date label. */
export function formatLocalDayLabel(
	localDay: string,
	todayLocalDay: string,
	locale?: string,
): string {
	if (!isCalendarDay(localDay) || !isCalendarDay(todayLocalDay)) {
		throw new TypeError("Local day must be a real YYYY-MM-DD date.");
	}
	if (localDay === todayLocalDay) return "Today";
	if (localDay === previousLocalDay(todayLocalDay)) return "Yesterday";

	return new Intl.DateTimeFormat(locale, {
		weekday: "long",
		day: "numeric",
		month: "long",
		timeZone: "UTC",
	}).format(new Date(`${localDay}T00:00:00.000Z`));
}
