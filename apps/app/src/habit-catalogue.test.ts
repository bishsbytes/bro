import {
	HABIT_CATALOGUE,
	habitsForArea,
	resolveHabit,
} from "./content/habit-catalogue";
import { LIFE_AREA_CATALOGUE } from "./content/life-area-catalogue";
import { resolveMetric } from "./content/metric-registry";

describe("habit catalogue", () => {
	it("uses permanent unique slugs, positions, and valid cadence masks", () => {
		const slugs = HABIT_CATALOGUE.map((habit) => habit.slug);
		const positions = HABIT_CATALOGUE.map((habit) => habit.defaultPosition);
		expect(new Set(slugs).size).toBe(slugs.length);
		expect(slugs).toEqual([
			"habit:steps-10k",
			"habit:sleep-7h",
			"habit:alcohol-free",
			"habit:training",
			"habit:outdoors",
			"habit:reading",
			"habit:meditation",
			"habit:call-someone",
			"habit:date-night",
			"habit:tidy-reset",
			"habit:weekly-priority",
			"habit:money-check-in",
			"habit:family-moment",
			"habit:fun-break",
		]);
		expect(new Set(positions).size).toBe(positions.length);
		for (const habit of HABIT_CATALOGUE) {
			expect(habit.slug).toMatch(/^habit:[a-z0-9-]+$/);
			expect(habit.defaultDaysOfWeek).toBeGreaterThan(0);
			expect(habit.defaultDaysOfWeek).toBeLessThanOrEqual(0b111_1111);
			expect(resolveHabit(habit.slug)).toBe(habit);
		}
		expect(resolveHabit("habit:future")).toBeNull();
	});

	it("links metric habits only to objective registry series", () => {
		for (const habit of HABIT_CATALOGUE) {
			if (habit.kind === "manual") {
				expect(habit).toMatchObject({
					metricSlug: null,
					direction: null,
					defaultTargetValue: null,
				});
				continue;
			}
			const resolved = resolveMetric(habit.metricSlug);
			expect(resolved.kind).toBe("known");
			if (resolved.kind !== "known") throw new Error("Missing habit metric");
			expect(resolved.metric).toMatchObject({
				kind: "measurement",
				userEnterable: false,
			});
			expect(["sum", "mean"]).toContain(resolved.metric.aggregation);
			expect(habit.direction).toBe("at_least");
			expect(Number.isFinite(habit.defaultTargetValue)).toBe(true);
		}
	});

	it("covers every default area and keeps sensitivity aligned", () => {
		for (const area of LIFE_AREA_CATALOGUE) {
			const habits = habitsForArea(area.slug);
			if (area.defaultEnabled) expect(habits.length).toBeGreaterThan(0);
			for (const habit of habits) {
				const metric =
					habit.kind === "metric" ? resolveMetric(habit.metricSlug) : null;
				const metricSensitive =
					metric?.kind === "known" ? metric.metric.sensitive : false;
				expect(habit.sensitive).toBe(area.sensitive || metricSensitive);
			}
		}
		expect(resolveHabit("habit:alcohol-free")?.sensitive).toBe(true);
	});
});
