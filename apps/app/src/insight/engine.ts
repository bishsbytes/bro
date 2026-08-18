import type { InsightCatalogueEntry } from "@bro/domain/insight-catalogue";
import { shiftLocalDay } from "../habits/cadence";

export const INSIGHT_WINDOW_DAYS = 90;
export const INSIGHT_MIN_OUTPUT_DAYS = 20;
export const INSIGHT_MIN_ARM_DAYS = 7;
export const INSIGHT_MIN_HALF_ARM_DAYS = 3;
export const SCORED_EFFECT_FLOOR = 0.5;
export const SLEEP_EFFECT_FLOOR_SECONDS = 30 * 60;

export type SignalReader = (
	metricSlug: string,
	localDay: string,
) => { value: number } | null;

export type InsightArm = {
	mean: number;
	count: number;
};

export type InsightGate =
	| "output-days"
	| "true-arm-days"
	| "false-arm-days"
	| "effect-floor"
	| "stability-data"
	| "stability-direction";

export type InsightNotYet = {
	kind: "not-yet";
	pair: InsightCatalogueEntry;
	gate: InsightGate;
	remaining: number;
	unit: "days" | "points" | "seconds" | "direction";
	outputDayCount: number;
	trueCount: number;
	falseCount: number;
};

export type ShownInsight = {
	kind: "shown";
	pair: InsightCatalogueEntry;
	fromLocalDay: string;
	throughLocalDay: string;
	trueArm: InsightArm;
	falseArm: InsightArm;
	effect: number;
	direction: "higher" | "lower";
};

export type InsightEvaluation = InsightNotYet | ShownInsight;

type AlignedPoint = {
	outputDay: string;
	arm: boolean;
	output: number;
};

function mean(points: readonly AlignedPoint[]): number {
	return (
		points.reduce((total, point) => total + point.output, 0) / points.length
	);
}

function inputMatches(pair: InsightCatalogueEntry, value: number): boolean {
	if (pair.input.kind === "presence") return value > 0;
	return pair.input.operator === "below"
		? value < pair.input.value
		: value >= pair.input.value;
}

function notYet(
	pair: InsightCatalogueEntry,
	gate: InsightGate,
	remaining: number,
	unit: InsightNotYet["unit"],
	outputDayCount: number,
	trueCount: number,
	falseCount: number,
): InsightNotYet {
	return {
		kind: "not-yet",
		pair,
		gate,
		remaining,
		unit,
		outputDayCount,
		trueCount,
		falseCount,
	};
}

function splitDirection(
	points: readonly AlignedPoint[],
): "higher" | "lower" | "same" {
	const truePoints = points.filter((point) => point.arm);
	const falsePoints = points.filter((point) => !point.arm);
	const difference = mean(truePoints) - mean(falsePoints);
	return difference > 0 ? "higher" : difference < 0 ? "lower" : "same";
}

export function evaluateInsight(
	pair: InsightCatalogueEntry,
	throughLocalDay: string,
	read: SignalReader,
): InsightEvaluation {
	const fromLocalDay = shiftLocalDay(
		throughLocalDay,
		-(INSIGHT_WINDOW_DAYS - 1),
	);
	const points: AlignedPoint[] = [];
	let outputDayCount = 0;

	for (let offset = 0; offset < INSIGHT_WINDOW_DAYS; offset += 1) {
		const outputDay = shiftLocalDay(fromLocalDay, offset);
		const output = read(pair.outputMetricSlug, outputDay);
		if (!output) continue;
		outputDayCount += 1;
		const inputDay = shiftLocalDay(outputDay, -pair.lagDays);
		const input = read(pair.input.metricSlug, inputDay);
		if (!input) continue;
		points.push({
			outputDay,
			arm: inputMatches(pair, input.value),
			output: output.value,
		});
	}

	const truePoints = points.filter((point) => point.arm);
	const falsePoints = points.filter((point) => !point.arm);
	if (outputDayCount < INSIGHT_MIN_OUTPUT_DAYS) {
		return notYet(
			pair,
			"output-days",
			INSIGHT_MIN_OUTPUT_DAYS - outputDayCount,
			"days",
			outputDayCount,
			truePoints.length,
			falsePoints.length,
		);
	}
	if (truePoints.length < INSIGHT_MIN_ARM_DAYS) {
		return notYet(
			pair,
			"true-arm-days",
			INSIGHT_MIN_ARM_DAYS - truePoints.length,
			"days",
			outputDayCount,
			truePoints.length,
			falsePoints.length,
		);
	}
	if (falsePoints.length < INSIGHT_MIN_ARM_DAYS) {
		return notYet(
			pair,
			"false-arm-days",
			INSIGHT_MIN_ARM_DAYS - falsePoints.length,
			"days",
			outputDayCount,
			truePoints.length,
			falsePoints.length,
		);
	}

	const trueMean = mean(truePoints);
	const falseMean = mean(falsePoints);
	const effect = trueMean - falseMean;
	const floor =
		pair.outputMetricSlug === "sleep_duration"
			? SLEEP_EFFECT_FLOOR_SECONDS
			: SCORED_EFFECT_FLOOR;
	if (Math.abs(effect) < floor) {
		return notYet(
			pair,
			"effect-floor",
			floor - Math.abs(effect),
			pair.outputMetricSlug === "sleep_duration" ? "seconds" : "points",
			outputDayCount,
			truePoints.length,
			falsePoints.length,
		);
	}

	const newerFrom = shiftLocalDay(fromLocalDay, INSIGHT_WINDOW_DAYS / 2);
	const older = points.filter((point) => point.outputDay < newerFrom);
	const newer = points.filter((point) => point.outputDay >= newerFrom);
	const halfCounts = [older, newer].flatMap((half) => [
		half.filter((point) => point.arm).length,
		half.filter((point) => !point.arm).length,
	]);
	const halfShortfall = Math.max(
		0,
		...halfCounts.map((count) => INSIGHT_MIN_HALF_ARM_DAYS - count),
	);
	if (halfShortfall > 0) {
		return notYet(
			pair,
			"stability-data",
			halfShortfall,
			"days",
			outputDayCount,
			truePoints.length,
			falsePoints.length,
		);
	}
	const direction = effect > 0 ? "higher" : "lower";
	if (
		splitDirection(older) !== direction ||
		splitDirection(newer) !== direction
	) {
		return notYet(
			pair,
			"stability-direction",
			0,
			"direction",
			outputDayCount,
			truePoints.length,
			falsePoints.length,
		);
	}

	return {
		kind: "shown",
		pair,
		fromLocalDay,
		throughLocalDay,
		trueArm: { mean: trueMean, count: truePoints.length },
		falseArm: { mean: falseMean, count: falsePoints.length },
		effect,
		direction,
	};
}

export type InsightTeaser = {
	watchedCount: number;
	nearest: InsightNotYet | null;
};

/**
 * Gates a user can close by adding days of the named kind. Stability-data is a
 * days-unit gate too, but its shortfall can sit in the fixed older half-window,
 * where no new day helps — so it never wins "nearest".
 */
const ACTIONABLE_DAY_GATES: ReadonlySet<InsightGate> = new Set([
	"output-days",
	"true-arm-days",
	"false-arm-days",
]);

export function aggregateInsightTeaser(
	evaluations: readonly InsightEvaluation[],
): InsightTeaser {
	const pending = evaluations.filter(
		(evaluation): evaluation is InsightNotYet =>
			evaluation.kind === "not-yet" &&
			ACTIONABLE_DAY_GATES.has(evaluation.gate),
	);
	const nearest = [...pending].sort(
		(left, right) =>
			left.remaining - right.remaining ||
			left.pair.id.localeCompare(right.pair.id),
	)[0];
	return { watchedCount: evaluations.length, nearest: nearest ?? null };
}
