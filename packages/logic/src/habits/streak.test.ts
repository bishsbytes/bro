import type { Habit } from "@bro/mobile-model";
import { localDayAt } from "../health/mapping";
import { isMetricHabitComplete } from "./completion";
import { deriveHabitStreak } from "./streak";

describe("habit streaks", () => {
	it("counts consecutive scheduled completions and ignores unscheduled days", () => {
		const complete = new Set(["2026-08-12", "2026-08-14"]);
		expect(
			deriveHabitStreak({
				startedOn: "2026-08-10",
				todayLocalDay: "2026-08-17",
				daysOfWeek: 0b001_0101,
				isComplete: (localDay) => complete.has(localDay),
			}),
		).toBe(2);
	});

	it("does not let an incomplete today break yesterday's streak", () => {
		const complete = new Set(["2026-08-14", "2026-08-15"]);
		expect(
			deriveHabitStreak({
				startedOn: "2026-08-13",
				todayLocalDay: "2026-08-16",
				daysOfWeek: 0b111_1111,
				isComplete: (localDay) => complete.has(localDay),
			}),
		).toBe(2);
		complete.add("2026-08-16");
		expect(
			deriveHabitStreak({
				startedOn: "2026-08-13",
				todayLocalDay: "2026-08-16",
				daysOfWeek: 0b111_1111,
				isComplete: (localDay) => complete.has(localDay),
			}),
		).toBe(3);
	});

	it("heals retroactively when a late import completes a scheduled day", () => {
		const habit = {
			kind: "metric",
			metricSlug: "steps",
			direction: "at_least",
			targetValue: 10_000,
		} satisfies Pick<
			Habit,
			"kind" | "metricSlug" | "direction" | "targetValue"
		>;
		const values = new Map([
			["2026-08-14", 10_500],
			["2026-08-15", 9_000],
		]);
		const streak = () =>
			deriveHabitStreak({
				startedOn: "2026-08-13",
				todayLocalDay: "2026-08-16",
				daysOfWeek: 0b111_1111,
				isComplete: (localDay) =>
					isMetricHabitComplete(habit, {
						metricSlug: "steps",
						value: values.get(localDay) ?? null,
					}),
			});

		expect(streak()).toBe(0);
		values.set("2026-08-15", 10_012);
		expect(streak()).toBe(2);
	});

	it("changes the today rule at local midnight, including a DST zone", () => {
		const complete = new Set(["2026-10-24"]);
		const beforeMidnight = localDayAt(
			Date.parse("2026-10-25T23:59:59.999Z"),
			"Europe/London",
		);
		const afterMidnight = localDayAt(
			Date.parse("2026-10-26T00:00:00.000Z"),
			"Europe/London",
		);
		expect(beforeMidnight).toBe("2026-10-25");
		expect(afterMidnight).toBe("2026-10-26");
		expect(
			deriveHabitStreak({
				startedOn: "2026-10-24",
				todayLocalDay: beforeMidnight,
				daysOfWeek: 0b111_1111,
				isComplete: (localDay) => complete.has(localDay),
			}),
		).toBe(1);
		expect(
			deriveHabitStreak({
				startedOn: "2026-10-24",
				todayLocalDay: afterMidnight,
				daysOfWeek: 0b111_1111,
				isComplete: (localDay) => complete.has(localDay),
			}),
		).toBe(0);
	});
});
