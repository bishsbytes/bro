import type { Goal } from "@bro/mobile-model";
import {
	type GoalStatus,
	goalProgressPercent,
	goalStatus,
} from "./goal-progress";

export type GoalSeriesPoint = {
	observedAt: number;
	value: number;
};

export type ResolvedGoalProgress = {
	goal: Goal;
	status: GoalStatus;
	startValue: number | null;
	currentValue: number | null;
	progressPercent: number | null;
	/** The tracked value has met the target, but only a person marks it done. */
	targetReached: boolean;
	targetFormatted: string;
	startFormatted: string | null;
	currentFormatted: string | null;
};

export function goalTargetReached(
	goal: Goal,
	status: GoalStatus,
	currentValue: number | null,
): boolean {
	if (status !== "active" || currentValue === null) {
		return false;
	}
	return goal.direction === "increase"
		? currentValue >= goal.targetValue
		: currentValue <= goal.targetValue;
}

/**
 * One shared derivation for every goal surface (wheel, body, consumption).
 * The series carries canonical values in ascending observedAt order; a caller
 * whose "current" is not simply the latest point (a rolling consumption mean)
 * overrides the values while keeping the same presentation shape.
 */
export function resolveGoalProgress(options: {
	goal: Goal;
	series: readonly GoalSeriesPoint[];
	currentValue?: number | null;
	startValue?: number | null;
	format: (value: number) => string;
}): ResolvedGoalProgress {
	const { goal, series, format } = options;
	const startValue =
		options.startValue !== undefined
			? options.startValue
			: (series.filter((point) => point.observedAt <= goal.startedAt).at(-1)
					?.value ?? null);
	const currentValue =
		options.currentValue !== undefined
			? options.currentValue
			: (series.at(-1)?.value ?? null);
	const status = goalStatus(goal);
	return {
		goal,
		status,
		startValue,
		currentValue,
		progressPercent: goalProgressPercent(goal, startValue, currentValue),
		targetReached: goalTargetReached(goal, status, currentValue),
		targetFormatted: format(goal.targetValue),
		startFormatted: startValue === null ? null : format(startValue),
		currentFormatted: currentValue === null ? null : format(currentValue),
	};
}
