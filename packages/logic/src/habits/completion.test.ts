import type { Habit } from "@bro/database-app";
import { isMetricHabitComplete } from "./completion";

function metricHabit(overrides: Partial<Habit> = {}): Habit {
	return {
		id: "habit-1",
		slug: "habit:steps-10k",
		customLabel: null,
		kind: "metric",
		metricSlug: "steps",
		direction: "at_least",
		targetValue: 10_000,
		daysOfWeek: 0b111_1111,
		position: 0,
		addedAt: 1,
		removedAt: null,
		createdAt: 1,
		updatedAt: 1,
		...overrides,
	};
}

describe("derived metric habit completion", () => {
	it("uses the resolved value and treats no data as incomplete", () => {
		const habit = metricHabit();
		expect(
			isMetricHabitComplete(habit, { metricSlug: "steps", value: null }),
		).toBe(false);
		expect(
			isMetricHabitComplete(habit, { metricSlug: "steps", value: 9_999 }),
		).toBe(false);
		expect(
			isMetricHabitComplete(habit, { metricSlug: "steps", value: 10_000 }),
		).toBe(true);
	});

	it("recomputes retroactively when a late resolved value crosses the target", () => {
		const habit = metricHabit();
		const beforeImport = { metricSlug: "steps" as const, value: 9_200 };
		const afterImport = { metricSlug: "steps" as const, value: 10_012 };
		expect(isMetricHabitComplete(habit, beforeImport)).toBe(false);
		expect(isMetricHabitComplete(habit, afterImport)).toBe(true);
	});

	it("supports at-most targets and rejects mismatched series", () => {
		const habit = metricHabit({
			metricSlug: "resting_heart_rate",
			direction: "at_most",
			targetValue: 60,
		});
		expect(
			isMetricHabitComplete(habit, {
				metricSlug: "resting_heart_rate",
				value: 59,
			}),
		).toBe(true);
		expect(() =>
			isMetricHabitComplete(habit, { metricSlug: "steps", value: 59 }),
		).toThrow("does not match");
	});
});
