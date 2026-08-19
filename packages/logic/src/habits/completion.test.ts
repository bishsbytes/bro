import type { Habit } from "@bro/mobile-model";
import { habitMetricDayValue, isMetricHabitComplete } from "./completion";

function metricHabit(overrides: Partial<Habit> = {}): Habit {
	return {
		id: "habit-1",
		slug: "habit:steps-10k",
		customLabel: null,
		kind: "metric",
		metricSlug: "steps",
		direction: "at_least",
		targetValue: 10_000,
		areaSlug: null,
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

	it("reads an unlogged day as zero only for consumption ceilings", () => {
		const alcoholFree = metricHabit({
			slug: "habit:alcohol-free",
			metricSlug: "alcohol_intake",
			direction: "at_most",
			targetValue: 0,
		});
		expect(habitMetricDayValue(alcoholFree, null)).toBe(0);
		expect(habitMetricDayValue(alcoholFree, 0.02)).toBe(0.02);
		expect(
			isMetricHabitComplete(alcoholFree, {
				metricSlug: "alcohol_intake",
				value: habitMetricDayValue(alcoholFree, null),
			}),
		).toBe(true);

		// A consumption floor must never succeed on silence…
		const fluidFloor = metricHabit({
			metricSlug: "fluid_intake",
			direction: "at_least",
			targetValue: 2,
		});
		expect(habitMetricDayValue(fluidFloor, null)).toBeNull();
		// …and an imported-metric ceiling keeps honest missing-device-data days.
		const heartCeiling = metricHabit({
			metricSlug: "resting_heart_rate",
			direction: "at_most",
			targetValue: 60,
		});
		expect(habitMetricDayValue(heartCeiling, null)).toBeNull();
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
