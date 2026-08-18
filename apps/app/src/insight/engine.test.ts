import type { InsightCatalogueEntry } from "@bro/domain/insight-catalogue";
import { shiftLocalDay } from "../habits/cadence";
import {
	aggregateInsightTeaser,
	evaluateInsight,
	INSIGHT_WINDOW_DAYS,
} from "./engine";

const pair: InsightCatalogueEntry = {
	id: "insight:test-mood",
	input: { kind: "presence", metricSlug: "training" },
	outputMetricSlug: "mood",
	lagDays: 0,
	tier: "premium",
	copy: {
		summary:
			"Your mood averaged {trueMean} on training days ({trueCount} days), against {falseMean} otherwise ({falseCount} days).",
		trueArmLabel: "Training days",
		falseArmLabel: "Other days",
	},
};

function series(
	throughLocalDay: string,
	options: {
		outputDays?: number;
		trueEvery?: number;
		output?: (offset: number, active: boolean) => number;
	} = {},
) {
	const values = new Map<string, number>();
	const from = shiftLocalDay(throughLocalDay, -(INSIGHT_WINDOW_DAYS - 1));
	const outputDays = options.outputDays ?? INSIGHT_WINDOW_DAYS;
	const trueEvery = options.trueEvery ?? 3;
	for (let offset = 0; offset < outputDays; offset += 1) {
		const day = shiftLocalDay(from, offset);
		const active = offset % trueEvery === 0;
		values.set(`training:${day}`, active ? 1 : 0);
		values.set(
			`mood:${day}`,
			options.output?.(offset, active) ?? (active ? 2 : 4),
		);
	}
	return {
		values,
		read: (metricSlug: string, localDay: string) => {
			const value = values.get(`${metricSlug}:${localDay}`);
			return value === undefined ? null : { value };
		},
	};
}

describe("insight engine", () => {
	it("shows only a stable, above-floor comparison with both arms", () => {
		const data = series("2026-04-30");
		const result = evaluateInsight(pair, "2026-04-30", data.read);

		expect(result).toMatchObject({
			kind: "shown",
			direction: "lower",
			trueArm: { mean: 2, count: 30 },
			falseArm: { mean: 4, count: 60 },
			effect: -2,
		});
	});

	it("reports output, arm, and effect distances at their exact edges", () => {
		const outputShort = evaluateInsight(
			pair,
			"2026-04-30",
			series("2026-04-30", { outputDays: 19 }).read,
		);
		expect(outputShort).toMatchObject({
			kind: "not-yet",
			gate: "output-days",
			remaining: 1,
		});

		const armShort = evaluateInsight(
			pair,
			"2026-04-30",
			series("2026-04-30", { outputDays: 20, trueEvery: 4 }).read,
		);
		expect(armShort).toMatchObject({
			kind: "not-yet",
			gate: "true-arm-days",
			remaining: 2,
		});

		const floorShort = evaluateInsight(
			pair,
			"2026-04-30",
			series("2026-04-30", {
				output: (_offset, active) => (active ? 3.8 : 4),
			}).read,
		);
		expect(floorShort).toMatchObject({
			kind: "not-yet",
			gate: "effect-floor",
			remaining: expect.closeTo(0.3),
		});
	});

	it("rejects a direction reversal between the older and newer halves", () => {
		const data = series("2026-04-30", {
			output: (offset, active) =>
				offset < 45 ? (active ? 1 : 5) : active ? 5 : 4,
		});
		expect(evaluateInsight(pair, "2026-04-30", data.read)).toMatchObject({
			kind: "not-yet",
			gate: "stability-direction",
		});
	});

	it("aligns lag-one input over a month and DST boundary", () => {
		const lagged = {
			...pair,
			id: "insight:test-mood-lag1" as const,
			lagDays: 1 as const,
		};
		const data = series("2026-04-30");
		data.values.clear();
		const from = shiftLocalDay("2026-04-30", -(INSIGHT_WINDOW_DAYS - 1));
		for (let offset = 0; offset < INSIGHT_WINDOW_DAYS; offset += 1) {
			const outputDay = shiftLocalDay(from, offset);
			const inputDay = shiftLocalDay(outputDay, -1);
			const active = offset % 3 === 0;
			data.values.set(`training:${inputDay}`, active ? 1 : 0);
			data.values.set(`mood:${outputDay}`, active ? 2 : 4);
		}

		const result = evaluateInsight(lagged, "2026-04-30", data.read);
		expect(result.kind).toBe("shown");
		expect(data.values.has("training:2026-03-29")).toBe(true);
		expect(data.values.has("mood:2026-03-30")).toBe(true);
	});

	it("aggregates watched count and the nearest day distance", () => {
		const first = evaluateInsight(
			pair,
			"2026-04-30",
			series("2026-04-30", { outputDays: 19 }).read,
		);
		const second = evaluateInsight(
			{ ...pair, id: "insight:test-two" },
			"2026-04-30",
			series("2026-04-30", { outputDays: 14 }).read,
		);
		expect(aggregateInsightTeaser([second, first])).toMatchObject({
			watchedCount: 2,
			nearest: { remaining: 1 },
		});
	});

	it("never offers a gate new days cannot close as the nearest pattern", () => {
		const base = {
			kind: "not-yet" as const,
			pair,
			unit: "days" as const,
			outputDayCount: 45,
			trueCount: 15,
			falseCount: 30,
		};
		const stalled = { ...base, gate: "stability-data" as const, remaining: 1 };
		const actionable = {
			...base,
			pair: { ...pair, id: "insight:test-two" as const },
			gate: "true-arm-days" as const,
			remaining: 5,
		};
		expect(aggregateInsightTeaser([stalled, actionable])).toMatchObject({
			nearest: { gate: "true-arm-days", remaining: 5 },
		});
		expect(aggregateInsightTeaser([stalled]).nearest).toBeNull();
	});

	it("heals in either direction when a late input changes an arm", () => {
		const data = series("2026-04-30", {
			output: (_offset, active) => (active ? 3.5 : 4),
		});
		expect(evaluateInsight(pair, "2026-04-30", data.read).kind).toBe("shown");

		const from = shiftLocalDay("2026-04-30", -(INSIGHT_WINDOW_DAYS - 1));
		data.values.set(`training:${from}`, 0);
		expect(evaluateInsight(pair, "2026-04-30", data.read)).toMatchObject({
			kind: "not-yet",
			gate: "effect-floor",
		});

		data.values.set(`training:${from}`, 1);
		expect(evaluateInsight(pair, "2026-04-30", data.read).kind).toBe("shown");
	});
});
