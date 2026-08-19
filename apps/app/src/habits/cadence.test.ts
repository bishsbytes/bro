import { localDayAt } from "../health/mapping";
import {
	isHabitScheduled,
	isoWeekdayForLocalDay,
	scheduledDaysBetween,
	shiftLocalDay,
} from "./cadence";

describe("habit cadence", () => {
	it("expands Monday-first masks across month and DST boundaries", () => {
		const mondayWednesdayFriday = 0b001_0101;
		expect(
			scheduledDaysBetween("2026-03-27", "2026-04-03", mondayWednesdayFriday),
		).toEqual(["2026-03-27", "2026-03-30", "2026-04-01", "2026-04-03"]);
		expect(shiftLocalDay("2026-03-28", 1)).toBe("2026-03-29");
		expect(shiftLocalDay("2026-03-29", 1)).toBe("2026-03-30");
	});

	it("uses the resolved local day on either side of midnight", () => {
		const beforeMidnight = localDayAt(
			Date.parse("2026-08-16T22:59:59.999Z"),
			"Europe/London",
		);
		const afterMidnight = localDayAt(
			Date.parse("2026-08-16T23:00:00.000Z"),
			"Europe/London",
		);
		expect(beforeMidnight).toBe("2026-08-16");
		expect(afterMidnight).toBe("2026-08-17");
		expect(isoWeekdayForLocalDay(beforeMidnight)).toBe(6);
		expect(isoWeekdayForLocalDay(afterMidnight)).toBe(0);
		expect(isHabitScheduled(beforeMidnight, 0b000_0001)).toBe(false);
		expect(isHabitScheduled(afterMidnight, 0b000_0001)).toBe(true);
	});

	it("rejects impossible dates, empty masks, and backwards ranges", () => {
		expect(() => shiftLocalDay("2026-02-30", 1)).toThrow("real YYYY-MM-DD");
		expect(() => isHabitScheduled("2026-08-16", 0)).toThrow(
			"select at least one",
		);
		expect(() => scheduledDaysBetween("2026-08-17", "2026-08-16", 0b1)).toThrow(
			"run forwards",
		);
	});
});
