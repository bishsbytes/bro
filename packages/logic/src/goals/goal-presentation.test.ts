import type { Goal } from "@bro/database-app";
import { goalTargetReached, resolveGoalProgress } from "./goal-presentation";

function goal(overrides: Partial<Goal> = {}): Goal {
	return {
		id: "goal-1",
		metricSlug: "weight",
		direction: "decrease",
		targetValue: 80,
		targetDate: null,
		startedAt: 1_000,
		achievedAt: null,
		abandonedAt: null,
		createdAt: 1_000,
		updatedAt: 1_000,
		...overrides,
	};
}

const format = (value: number) => `${value} kg`;

describe("goal presentation", () => {
	it("derives start and current from the series around startedAt", () => {
		const progress = resolveGoalProgress({
			goal: goal(),
			series: [
				{ observedAt: 500, value: 88 },
				{ observedAt: 900, value: 86 },
				{ observedAt: 2_000, value: 83 },
			],
			format,
		});
		expect(progress).toMatchObject({
			status: "active",
			startValue: 86,
			currentValue: 83,
			progressPercent: 50,
			targetReached: false,
			targetFormatted: "80 kg",
			startFormatted: "86 kg",
			currentFormatted: "83 kg",
		});
	});

	it("keeps formatted values null when the series has no data", () => {
		const progress = resolveGoalProgress({ goal: goal(), series: [], format });
		expect(progress).toMatchObject({
			startValue: null,
			currentValue: null,
			progressPercent: null,
			targetReached: false,
			startFormatted: null,
			currentFormatted: null,
			targetFormatted: "80 kg",
		});
	});

	it("lets a caller override start and current without losing presentation", () => {
		const progress = resolveGoalProgress({
			goal: goal({ direction: "decrease", targetValue: 2 }),
			series: [{ observedAt: 2_000, value: 9 }],
			startValue: 6,
			currentValue: 2,
			format: (value) => `${value} units`,
		});
		expect(progress).toMatchObject({
			startValue: 6,
			currentValue: 2,
			progressPercent: 100,
			targetReached: true,
			currentFormatted: "2 units",
		});
	});

	it("flags target reached in both directions for active goals only", () => {
		const increase = goal({ direction: "increase", targetValue: 8 });
		expect(goalTargetReached(increase, "active", 8)).toBe(true);
		expect(goalTargetReached(increase, "active", 7.9)).toBe(false);
		const decrease = goal({ direction: "decrease", targetValue: 80 });
		expect(goalTargetReached(decrease, "active", 80)).toBe(true);
		expect(goalTargetReached(decrease, "active", 81)).toBe(false);
		expect(goalTargetReached(decrease, "achieved", 79)).toBe(false);
		expect(goalTargetReached(decrease, "abandoned", 79)).toBe(false);
		expect(goalTargetReached(decrease, "active", null)).toBe(false);
	});
});
