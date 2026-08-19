import {
	EVERY_DAY_MASK,
	ISO_WEEKDAYS,
	includesWeekday,
	isoWeekdayIndex,
	weekdaysFromMask,
	weekdaysToMask,
} from "./day-bitmask";

describe("ISO weekday bitmasks", () => {
	it("maps JavaScript Sunday-first dates into Monday-first bit positions", () => {
		const monday = new Date(2026, 7, 10, 12);
		for (const day of ISO_WEEKDAYS) {
			const date = new Date(2026, 7, monday.getDate() + day.index, 12);
			expect(isoWeekdayIndex(date)).toBe(day.index);
			expect(includesWeekday(1 << day.index, day.index)).toBe(true);
		}
	});

	it("round-trips every possible mask", () => {
		for (let mask = 0; mask <= EVERY_DAY_MASK; mask += 1) {
			expect(weekdaysToMask(weekdaysFromMask(mask))).toBe(mask);
		}
	});
});
