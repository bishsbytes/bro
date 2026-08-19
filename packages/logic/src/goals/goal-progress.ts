import type { Goal } from "@bro/mobile-model";

export type GoalStatus = "active" | "achieved" | "abandoned";

export function goalStatus(goal: Goal): GoalStatus {
	if (goal.achievedAt !== null) {
		return "achieved";
	}
	if (goal.abandonedAt !== null) {
		return "abandoned";
	}
	return "active";
}

export function goalProgressPercent(
	goal: Goal,
	startValue: number | null,
	currentValue: number | null,
): number | null {
	if (startValue === null || currentValue === null) {
		return null;
	}
	const distance =
		goal.direction === "increase"
			? goal.targetValue - startValue
			: startValue - goal.targetValue;
	if (distance <= 0) {
		return null;
	}
	const travelled =
		goal.direction === "increase"
			? currentValue - startValue
			: startValue - currentValue;
	return Math.round(Math.max(0, Math.min(1, travelled / distance)) * 100);
}
