import type {
	ConsumptionEntry,
	DailyMetric,
	Observation,
} from "@bro/mobile-model";
import { resolveMetricDay } from "../health/resolved-day";
import { resolveMetricObservations } from "../health/resolved-series";
import {
	consumptionMetricDayTotal,
	consumptionMetricTrailingDailyMean,
} from "./daily-totals";

function entry(
	id: string,
	localDay: string,
	values: Partial<
		Pick<
			ConsumptionEntry,
			| "volumeL"
			| "ethanolKg"
			| "caffeineKg"
			| "energyKcal"
			| "proteinG"
			| "carbsG"
			| "fatG"
		>
	>,
): ConsumptionEntry {
	return {
		id,
		kind: "drink",
		catalogueRef: `drink:${id}`,
		consumableRef: null,
		label: id,
		servingLabel: "serving",
		quantity: 1,
		volumeL: null,
		ethanolKg: null,
		caffeineKg: null,
		energyKcal: null,
		proteinG: null,
		carbsG: null,
		fatG: null,
		occurredAt: Date.parse(`${localDay}T18:00:00.000Z`),
		localDay,
		tzOffsetMinutes: 0,
		createdAt: 100,
		updatedAt: 100,
		...values,
	};
}

const lager = entry("lager", "2026-08-15", {
	volumeL: 0.568_261_25,
	ethanolKg: 0.020_181_999,
	caffeineKg: 0,
	energyKcal: 244,
});
const coffee = entry("coffee", "2026-08-15", {
	volumeL: 0.25,
	ethanolKg: 0,
	caffeineKg: 0.000_095,
	energyKcal: 2,
});
const anotherLager = entry("lager-2", "2026-08-15", {
	volumeL: 0.33,
	ethanolKg: 0.011_718_214,
	caffeineKg: 0,
	energyKcal: 142,
});
const nextDayWater = entry("water", "2026-08-16", {
	volumeL: 0.5,
	ethanolKg: 0,
	caffeineKg: 0,
	energyKcal: 0,
});
const chicken = entry("chicken", "2026-08-15", {
	energyKcal: 420,
	proteinG: 52,
	carbsG: 0,
	fatG: 24,
});

describe("consumption-derived daily totals", () => {
	it("sums each canonical entry field and distinguishes no data from zero", () => {
		const entries = [lager, coffee, anotherLager, nextDayWater];
		expect(
			consumptionMetricDayTotal("alcohol_intake", "2026-08-15", entries).value,
		).toBeCloseTo(0.031_900_213, 12);
		expect(
			consumptionMetricDayTotal("caffeine_intake", "2026-08-15", entries).value,
		).toBe(0.000_095);
		expect(
			consumptionMetricDayTotal("fluid_intake", "2026-08-15", entries).value,
		).toBeCloseTo(1.148_261_25, 12);
		expect(
			consumptionMetricDayTotal("energy_intake", "2026-08-15", entries).value,
		).toBe(388);
		expect(
			consumptionMetricDayTotal("alcohol_intake", "2026-08-16", entries).value,
		).toBe(0);
		expect(
			consumptionMetricDayTotal("alcohol_intake", "2026-08-17", entries),
		).toMatchObject({ value: null, entries: [] });
	});

	it("sums food energy with drinks and keeps macros independent", () => {
		const entries = [lager, coffee, chicken];
		expect(
			consumptionMetricDayTotal("energy_intake", "2026-08-15", entries).value,
		).toBe(666);
		expect(
			consumptionMetricDayTotal("protein_intake", "2026-08-15", entries).value,
		).toBeCloseTo(0.052, 12);
		expect(
			consumptionMetricDayTotal("carbs_intake", "2026-08-15", entries).value,
		).toBe(0);
		expect(
			consumptionMetricDayTotal("fat_intake", "2026-08-15", entries).value,
		).toBeCloseTo(0.024, 12);
	});

	it("selects entry provenance and changes immediately after a correction", () => {
		const withThree = resolveMetricDay(
			"alcohol_intake",
			"2026-08-15",
			[],
			[],
			[lager, coffee, anotherLager],
		);
		expect(withThree.value).toBeCloseTo(0.031_900_213, 12);
		expect(withThree.selected).toEqual({
			kind: "consumption",
			entries: [lager, coffee, anotherLager],
		});
		expect(
			resolveMetricDay("alcohol_intake", "2026-08-15", [], [], [lager, coffee])
				.value,
		).toBeCloseTo(0.020_181_999, 12);
	});

	it("does not let observation or import rows override a consumption metric", () => {
		const observation: Observation = {
			id: "wrong-user-source",
			metricSlug: "alcohol_intake",
			value: 999,
			scaleMin: null,
			scaleMax: null,
			observedAt: 1,
			localDay: "2026-08-15",
			tzOffsetMinutes: 0,
			source: "user",
			sourceRecordId: null,
			assessmentId: null,
			createdAt: 1,
			updatedAt: 1,
		};
		const imported: DailyMetric = {
			id: "wrong-import-source",
			metricSlug: "alcohol_intake",
			localDay: "2026-08-15",
			value: 888,
			source: "healthkit",
			computedAt: 1,
			createdAt: 1,
			updatedAt: 1,
		};
		const resolved = resolveMetricDay(
			"alcohol_intake",
			"2026-08-15",
			[observation],
			[imported],
			[lager],
		);
		expect(resolved.value).toBe(lager.ethanolKg);
		expect(resolved.userRows).toEqual([]);
		expect(resolved.importedRows).toEqual([]);
	});

	it("averages a trailing window with unlogged days counting as zero", () => {
		const entries = [lager, coffee, anotherLager, nextDayWater];
		// Window 2026-08-10..2026-08-16: one drinking day among seven.
		expect(
			consumptionMetricTrailingDailyMean(
				"alcohol_intake",
				"2026-08-16",
				7,
				entries,
			),
		).toBeCloseTo(0.031_900_213 / 7, 12);
		// The window is bounded: entries after throughLocalDay do not leak in.
		expect(
			consumptionMetricTrailingDailyMean(
				"alcohol_intake",
				"2026-08-14",
				7,
				entries,
			),
		).toBe(0);
		expect(
			consumptionMetricTrailingDailyMean("alcohol_intake", "2026-08-16", 1, [
				nextDayWater,
			]),
		).toBe(0);
		expect(() =>
			consumptionMetricTrailingDailyMean("alcohol_intake", "2026-08-16", 0, []),
		).toThrow("positive integer");
	});

	it("produces one summed series point per entry day", () => {
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
			{ localDay: "2026-08-15", value: 0.818_261_25, source: "consumption" },
			{ localDay: "2026-08-16", value: 0.5, source: "consumption" },
		]);
		expect(series[0]?.resolvedDay.consumptionEntries).toEqual([lager, coffee]);
	});
});
