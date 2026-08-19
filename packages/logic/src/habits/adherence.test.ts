import type { Habit } from "@bro/database-app";
import { deriveHabitAdherence } from "./adherence";

const manual: Habit = {
	id: "habit-1",
	slug: "habit:reading",
	customLabel: null,
	kind: "manual",
	metricSlug: null,
	direction: null,
	targetValue: null,
	areaSlug: null,
	daysOfWeek: 0b001_0101,
	position: 0,
	addedAt: 0,
	removedAt: null,
	createdAt: 0,
	updatedAt: 0,
};

describe("habit adherence", () => {
	it("keeps done, missed, and unscheduled days distinct", () => {
		expect(
			deriveHabitAdherence({
				habit: manual,
				fromLocalDay: "2026-08-17",
				throughLocalDay: "2026-08-23",
				startedOn: "2026-08-17",
				completedDays: new Set(["2026-08-17"]),
			}).map((day) => day.state),
		).toEqual([
			"done",
			"unscheduled",
			"missed",
			"unscheduled",
			"missed",
			"unscheduled",
			"unscheduled",
		]);
	});

	it("does not mark days after removal as missed", () => {
		expect(
			deriveHabitAdherence({
				habit: manual,
				fromLocalDay: "2026-08-17",
				throughLocalDay: "2026-08-23",
				startedOn: "2026-08-17",
				removedOn: "2026-08-19",
				completedDays: new Set(["2026-08-17"]),
			}).map((day) => day.state),
		).toEqual([
			"done",
			"unscheduled",
			"missed",
			"unscheduled",
			"unscheduled",
			"unscheduled",
			"unscheduled",
		]);
	});

	it("does not turn missing metric data into a miss", () => {
		const metric: Habit = {
			...manual,
			kind: "metric",
			metricSlug: "steps",
			direction: "at_least",
			targetValue: 8_000,
			daysOfWeek: 0b111_1111,
		};
		const values = new Map([
			["2026-08-17", 10_000],
			["2026-08-18", 5_000],
		]);
		expect(
			deriveHabitAdherence({
				habit: metric,
				fromLocalDay: "2026-08-17",
				throughLocalDay: "2026-08-19",
				startedOn: "2026-08-17",
				metricValue: (day) => values.get(day) ?? null,
			}).map((day) => day.state),
		).toEqual(["done", "missed", "no-data"]);
	});

	it("accepts consumption-derived habit metrics", () => {
		const alcoholFree: Habit = {
			...manual,
			slug: "habit:alcohol-free",
			kind: "metric",
			metricSlug: "alcohol_intake",
			direction: "at_most",
			targetValue: 0,
			daysOfWeek: 0b111_1111,
		};
		const values = new Map([
			["2026-08-17", 0],
			["2026-08-18", 0.02],
		]);
		expect(
			deriveHabitAdherence({
				habit: alcoholFree,
				fromLocalDay: "2026-08-17",
				throughLocalDay: "2026-08-19",
				startedOn: "2026-08-17",
				metricValue: (day) => values.get(day) ?? null,
			}).map((day) => day.state),
		).toEqual(["done", "missed", "no-data"]);
	});
});
