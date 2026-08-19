export const ISO_WEEKDAYS = [
	{ index: 0, shortLabel: "Mon", label: "Monday" },
	{ index: 1, shortLabel: "Tue", label: "Tuesday" },
	{ index: 2, shortLabel: "Wed", label: "Wednesday" },
	{ index: 3, shortLabel: "Thu", label: "Thursday" },
	{ index: 4, shortLabel: "Fri", label: "Friday" },
	{ index: 5, shortLabel: "Sat", label: "Saturday" },
	{ index: 6, shortLabel: "Sun", label: "Sunday" },
] as const;

export type IsoWeekdayIndex = (typeof ISO_WEEKDAYS)[number]["index"];

export const EVERY_DAY_MASK = 0b111_1111;

export function isoWeekdayIndex(date: Date): IsoWeekdayIndex {
	return ((date.getDay() + 6) % 7) as IsoWeekdayIndex;
}

export function includesWeekday(
	mask: number,
	weekday: IsoWeekdayIndex,
): boolean {
	return (mask & (1 << weekday)) !== 0;
}

export function weekdaysToMask(days: readonly IsoWeekdayIndex[]): number {
	return days.reduce<number>((mask, day) => mask | (1 << day), 0);
}

export function weekdaysFromMask(mask: number): IsoWeekdayIndex[] {
	return ISO_WEEKDAYS.filter(({ index }) => includesWeekday(mask, index)).map(
		({ index }) => index,
	);
}
