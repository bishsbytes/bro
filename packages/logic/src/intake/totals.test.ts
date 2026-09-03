import { resolveMetric } from "@bro/domain/metric-registry";
import type { DailyMetric, IntakeEvent, Observation } from "@bro/mobile-model";
import { resolveMetricDay } from "../health/resolved-day";
import { resolveMetricObservations } from "../health/resolved-series";
import {
	intakeDayTotal,
	intakePeriodTotals,
	intakeTrailingDailyMean,
} from "./totals";

function event(
	id: string,
	localDay: string,
	constituents: IntakeEvent["constituents"],
	overrides: Partial<IntakeEvent> = {},
): IntakeEvent {
	return {
		id,
		kind: "drink",
		consumableId: null,
		sourceRef: `system:drink:${id}`,
		name: id,
		brand: null,
		portionLabel: "portion",
		quantity: 1,
		massKg: null,
		volumeL: constituents.fluid ?? null,
		constituents,
		context: null,
		notes: null,
		occurredAt: Date.parse(`${localDay}T18:00:00.000Z`),
		localDay,
		tzOffsetMinutes: 0,
		createdAt: 100,
		updatedAt: 100,
		...overrides,
	};
}

const lager = event("lager", "2026-08-15", {
	fluid: 0.568_261_25,
	ethanol: 0.020_181_999,
	caffeine: 0,
	energy: 244,
});
const coffee = event("coffee", "2026-08-15", {
	fluid: 0.25,
	ethanol: 0,
	caffeine: 0.000_095,
	energy: 2,
});
const anotherLager = event("lager-2", "2026-08-15", {
	fluid: 0.33,
	ethanol: 0.011_718_214,
	caffeine: 0,
	energy: 142,
});
const nextDayWater = event("water", "2026-08-16", {
	fluid: 0.5,
	ethanol: 0,
	caffeine: 0,
	energy: 0,
});
const chicken = event(
	"chicken",
	"2026-08-15",
	{ energy: 420, protein: 0.052, carbohydrate: 0, fat: 0.024 },
	{ kind: "food", massKg: 0.24 },
);
const cigarette = event(
	"cigarette",
	"2026-08-15",
	{ nicotine: 1.2e-6 },
	{ kind: "nicotine" },
);
const vape = event(
	"vape",
	"2026-08-15",
	{ nicotine: 0.8e-6 },
	{ kind: "nicotine" },
);
const edible = event(
	"edible",
	"2026-08-15",
	{ energy: 90, thc: 1e-5 },
	{ kind: "other" },
);

describe("intake day totals", () => {
	it("sums each constituent code and distinguishes no data from zero", () => {
		const events = [lager, coffee, anotherLager, nextDayWater];
		expect(intakeDayTotal("ethanol", "2026-08-15", events).value).toBeCloseTo(
			0.031_900_213,
			12,
		);
		expect(intakeDayTotal("caffeine", "2026-08-15", events).value).toBe(
			0.000_095,
		);
		expect(intakeDayTotal("fluid", "2026-08-15", events).value).toBeCloseTo(
			1.148_261_25,
			12,
		);
		expect(intakeDayTotal("energy", "2026-08-15", events).value).toBe(388);
		expect(intakeDayTotal("ethanol", "2026-08-16", events).value).toBe(0);
		expect(intakeDayTotal("ethanol", "2026-08-17", events)).toMatchObject({
			value: null,
			events: [],
		});
	});

	it("sums food with drinks and keeps every code independent of kind", () => {
		const events = [lager, coffee, chicken, cigarette, vape];
		expect(intakeDayTotal("energy", "2026-08-15", events).value).toBe(666);
		expect(intakeDayTotal("protein", "2026-08-15", events).value).toBeCloseTo(
			0.052,
			12,
		);
		expect(intakeDayTotal("carbohydrate", "2026-08-15", events).value).toBe(0);
		expect(intakeDayTotal("nicotine", "2026-08-15", events).value).toBeCloseTo(
			2e-6,
			12,
		);
		// A day with drinks but no smoke has no nicotine reading at all, which is
		// what lets an unlogged day differ from a logged zero.
		expect(
			intakeDayTotal("nicotine", "2026-08-16", [nextDayWater]),
		).toMatchObject({ value: null, events: [] });
	});

	it("carries an unknown code through arithmetic but into no metric", () => {
		const events = [chicken, edible];
		// A new constituent appears in totals with a catalogue entry and nothing
		// else; until then it round-trips and reaches no metric.
		expect(intakeDayTotal("thc", "2026-08-15", events).value).toBe(1e-5);
		expect(intakeDayTotal("energy", "2026-08-15", events).value).toBe(510);
		expect(resolveMetric("thc_intake")).toEqual({
			kind: "unknown",
			slug: "thc_intake",
		});
	});

	it("resolves an intake metric to the day's sum of its constituent code", () => {
		const withThree = resolveMetricDay(
			"ethanol_intake",
			"2026-08-15",
			[],
			[],
			[lager, coffee, anotherLager],
		);
		expect(withThree.value).toBeCloseTo(0.031_900_213, 12);
		expect(withThree.selected).toEqual({
			kind: "intake",
			events: [lager, coffee, anotherLager],
		});
		expect(
			resolveMetricDay("ethanol_intake", "2026-08-15", [], [], [lager, coffee])
				.value,
		).toBeCloseTo(0.020_181_999, 12);
		expect(
			resolveMetricDay("protein_intake", "2026-08-15", [], [], [lager, chicken])
				.value,
		).toBeCloseTo(0.052, 12);
		expect(
			resolveMetricDay("nicotine_intake", "2026-08-15", [], [], [cigarette])
				.value,
		).toBeCloseTo(1.2e-6, 12);
	});

	it("does not let observation or import rows override an intake metric", () => {
		const observation: Observation = {
			id: "wrong-user-source",
			metricSlug: "ethanol_intake",
			value: 999,
			scaleMin: null,
			scaleMax: null,
			observedAt: 1,
			localDay: "2026-08-15",
			tzOffsetMinutes: 0,
			source: "user",
			sourceRecordId: null,
			assessmentId: null,
			slot: null,
			createdAt: 1,
			updatedAt: 1,
		};
		const imported: DailyMetric = {
			id: "wrong-import-source",
			metricSlug: "ethanol_intake",
			localDay: "2026-08-15",
			value: 888,
			source: "healthkit",
			computedAt: 1,
			createdAt: 1,
			updatedAt: 1,
		};
		const resolved = resolveMetricDay(
			"ethanol_intake",
			"2026-08-15",
			[observation],
			[imported],
			[lager],
		);
		expect(resolved.value).toBe(lager.constituents.ethanol);
		expect(resolved.userRows).toEqual([]);
		expect(resolved.importedRows).toEqual([]);
		// Observation- and import-backed metrics are untouched by intake events.
		expect(
			resolveMetricDay(
				"weight",
				"2026-08-15",
				[{ ...observation, metricSlug: "weight", value: 80 }],
				[],
				[lager],
			),
		).toMatchObject({
			value: 80,
			selected: { kind: "user" },
			intakeEvents: [],
		});
	});

	it("averages a trailing window with unlogged days counting as zero", () => {
		const events = [lager, coffee, anotherLager, nextDayWater];
		expect(
			intakeTrailingDailyMean("ethanol", "2026-08-16", 7, events),
		).toBeCloseTo(0.031_900_213 / 7, 12);
		expect(intakeTrailingDailyMean("ethanol", "2026-08-14", 7, events)).toBe(0);
		expect(
			intakeTrailingDailyMean("ethanol", "2026-08-16", 1, [nextDayWater]),
		).toBe(0);
		expect(() =>
			intakeTrailingDailyMean("ethanol", "2026-08-16", 0, []),
		).toThrow("positive integer");
	});

	it("produces a daily series and sum over a window", () => {
		const period = intakePeriodTotals("energy", "2026-08-14", "2026-08-16", [
			lager,
			coffee,
			chicken,
			nextDayWater,
		]);
		expect(period.days).toEqual([
			{ localDay: "2026-08-14", value: null },
			{ localDay: "2026-08-15", value: 666 },
			{ localDay: "2026-08-16", value: 0 },
		]);
		expect(period.sum).toBe(666);
		expect(period.loggedDays).toBe(2);
		expect(() =>
			intakePeriodTotals("energy", "2026-08-16", "2026-08-14", []),
		).toThrow("run forwards");
	});

	it("produces one summed series point per event day", () => {
		const series = resolveMetricObservations(
			"fluid_intake",
			[],
			[],
			[lager, coffee, nextDayWater],
		);
		expect(
			series.map(({ localDay, value, source }) => ({
				localDay,
				value,
				source,
			})),
		).toEqual([
			{ localDay: "2026-08-15", value: 0.818_261_25, source: "intake" },
			{ localDay: "2026-08-16", value: 0.5, source: "intake" },
		]);
		expect(series[0]?.resolvedDay.intakeEvents).toEqual([lager, coffee]);
	});
});
