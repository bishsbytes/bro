import { formatLocalDayLabel } from "./local-day-label";

describe("formatLocalDayLabel", () => {
	it("uses relative labels for today and yesterday", () => {
		expect(formatLocalDayLabel("2026-08-20", "2026-08-20", "en-GB")).toBe(
			"Today",
		);
		expect(formatLocalDayLabel("2026-08-19", "2026-08-20", "en-GB")).toBe(
			"Yesterday",
		);
	});

	it("formats other days in the requested locale", () => {
		expect(formatLocalDayLabel("2026-08-18", "2026-08-20", "en-GB")).toBe(
			"Tuesday 18 August",
		);
		expect(formatLocalDayLabel("2026-08-18", "2026-08-20", "en-US")).toBe(
			"Tuesday, August 18",
		);
	});

	it("adds the year once the day falls outside the current year", () => {
		expect(formatLocalDayLabel("2025-08-18", "2026-08-20", "en-GB")).toBe(
			"Monday, 18 August 2025",
		);
		expect(formatLocalDayLabel("2026-01-01", "2026-08-20", "en-GB")).toBe(
			"Thursday 1 January",
		);
	});

	it("rejects invalid local days", () => {
		expect(() =>
			formatLocalDayLabel("2026-02-30", "2026-08-20", "en-GB"),
		).toThrow("real YYYY-MM-DD date");
	});
});
