import { type WeekStartDay, weekStartOf } from "./calendar";

describe("weekStartOf", () => {
	it.each([
		["monday", "2026-08-17"],
		["sunday", "2026-08-16"],
		["saturday", "2026-08-15"],
	] satisfies [WeekStartDay, string][])(
		"anchors a Thursday to the containing %s week",
		(weekStart, expected) => {
			expect(weekStartOf("2026-08-20", weekStart)).toBe(expected);
		},
	);

	it("crosses a year boundary without consulting a time zone", () => {
		expect(weekStartOf("2027-01-01", "monday")).toBe("2026-12-28");
		expect(weekStartOf("2027-01-01", "saturday")).toBe("2026-12-26");
	});

	it("keeps local-day arithmetic stable across a DST boundary", () => {
		expect(weekStartOf("2026-03-29", "monday")).toBe("2026-03-23");
		expect(weekStartOf("2026-03-29", "sunday")).toBe("2026-03-29");
	});
});
