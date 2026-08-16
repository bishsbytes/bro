import type { DailyMetric, Observation } from "@bro/database-app";
import { KILOGRAMS_PER_POUND } from "../units";
import {
	applyHealthSampleChanges,
	type CanonicalHealthSample,
	HEALTH_BACKFILL_DAYS,
	mapPlatformSample,
	RAW_SAMPLE_RETENTION_DAYS,
	resolveMetricDay,
	rollupHealthSamples,
	V1_HEALTH_METRIC_SLUGS,
} from ".";

function sample(
	metricSlug: CanonicalHealthSample["metricSlug"],
	value: number,
	overrides: Partial<CanonicalHealthSample> = {},
): CanonicalHealthSample {
	return {
		metricSlug,
		value,
		startedAt: Date.parse("2026-08-16T08:00:00.000Z"),
		endedAt: Date.parse("2026-08-16T09:00:00.000Z"),
		localDay: "2026-08-16",
		source: "health_connect",
		sourceRecordId: `${metricSlug}-${value}`,
		origin: null,
		...overrides,
	};
}

function observation(value: number): Observation {
	return {
		id: `user-${value}`,
		metricSlug: "weight",
		value,
		scaleMin: null,
		scaleMax: null,
		observedAt: 100,
		localDay: "2026-08-16",
		tzOffsetMinutes: 0,
		source: "user",
		sourceRecordId: null,
		assessmentId: null,
		createdAt: 100,
		updatedAt: 100,
	};
}

function dailyMetric(value: number, computedAt = 200): DailyMetric {
	return {
		id: `imported-${computedAt}`,
		metricSlug: "weight",
		localDay: "2026-08-16",
		value,
		source: "health_connect",
		computedAt,
		createdAt: computedAt,
		updatedAt: computedAt,
	};
}

describe("health import policy and pure math", () => {
	it("locks the v1 set, backfill depth, and raw retention window", () => {
		expect(V1_HEALTH_METRIC_SLUGS).toEqual([
			"sleep_duration",
			"steps",
			"resting_heart_rate",
			"weight",
			"body_fat",
		]);
		expect(HEALTH_BACKFILL_DAYS).toBe(365);
		expect(RAW_SAMPLE_RETENTION_DAYS).toBe(90);
	});

	it("converts platform units into the signed-off canonical units", () => {
		const base = {
			startedAt: Date.parse("2026-08-16T08:00:00.000Z"),
			endedAt: Date.parse("2026-08-16T09:00:00.000Z"),
			source: "health_connect" as const,
			sourceRecordId: "record",
		};
		expect(
			mapPlatformSample(
				{ ...base, metricSlug: "sleep_duration", value: 462, unit: "minute" },
				"Europe/London",
			).value,
		).toBe(27_720);
		expect(
			mapPlatformSample(
				{ ...base, metricSlug: "weight", value: 180, unit: "lb" },
				"Europe/London",
			).value,
		).toBeCloseTo(180 * KILOGRAMS_PER_POUND, 12);
		expect(
			mapPlatformSample(
				{ ...base, metricSlug: "body_fat", value: 18.5, unit: "percent" },
				"Europe/London",
			).value,
		).toBe(0.185);
		expect(
			mapPlatformSample(
				{ ...base, metricSlug: "steps", value: 10_432, unit: "count" },
				"Europe/London",
			).value,
		).toBe(10_432);
		expect(
			mapPlatformSample(
				{
					...base,
					metricSlug: "resting_heart_rate",
					value: 61.5,
					unit: "bpm",
				},
				"Europe/London",
			).value,
		).toBe(61.5);
	});

	it("attributes sleep to its wake day and other samples to their start day", () => {
		const sleep = mapPlatformSample(
			{
				metricSlug: "sleep_duration",
				value: 8,
				unit: "hour",
				startedAt: Date.parse("2026-10-24T22:30:00.000Z"),
				endedAt: Date.parse("2026-10-25T07:30:00.000Z"),
				source: "healthkit",
				sourceRecordId: "dst-sleep",
			},
			"Europe/London",
		);
		const steps = mapPlatformSample(
			{
				metricSlug: "steps",
				value: 100,
				unit: "count",
				startedAt: Date.parse("2026-08-15T15:30:00.000Z"),
				endedAt: Date.parse("2026-08-15T15:35:00.000Z"),
				source: "health_connect",
				sourceRecordId: "tokyo-steps",
			},
			"Asia/Tokyo",
		);

		expect(sleep.localDay).toBe("2026-10-25");
		expect(steps.localDay).toBe("2026-08-16");
	});

	it("applies sum, mean, and deterministic last rollups", () => {
		expect(
			rollupHealthSamples("steps", [
				sample("steps", 400),
				sample("steps", 600),
			]),
		).toBe(1_000);
		expect(
			rollupHealthSamples("sleep_duration", [
				sample("sleep_duration", 10_800),
				sample("sleep_duration", 14_400),
			]),
		).toBe(25_200);
		expect(
			rollupHealthSamples("resting_heart_rate", [
				sample("resting_heart_rate", 60),
				sample("resting_heart_rate", 66),
			]),
		).toBe(63);
		expect(
			rollupHealthSamples("weight", [
				sample("weight", 80, { endedAt: 100, sourceRecordId: "early" }),
				sample("weight", 79, { endedAt: 200, sourceRecordId: "late" }),
			]),
		).toBe(79);
	});

	it("sums only the dominant recording origin so two devices never double count", () => {
		expect(
			rollupHealthSamples("steps", [
				sample("steps", 3_000, { origin: "com.phone", sourceRecordId: "p-1" }),
				sample("steps", 2_000, { origin: "com.phone", sourceRecordId: "p-2" }),
				sample("steps", 7_000, { origin: "com.watch", sourceRecordId: "w-1" }),
			]),
		).toBe(7_000);
		// Origin-less samples share one bucket, so single-source days are unchanged.
		expect(
			rollupHealthSamples("steps", [
				sample("steps", 400),
				sample("steps", 600),
			]),
		).toBe(1_000);
		// Ties resolve deterministically to the lexicographically first origin.
		expect(
			rollupHealthSamples("sleep_duration", [
				sample("sleep_duration", 25_200, {
					origin: "b.app",
					sourceRecordId: "b",
				}),
				sample("sleep_duration", 25_200, {
					origin: "a.app",
					sourceRecordId: "a",
				}),
			]),
		).toBe(25_200);
		// Mean metrics still average every origin's samples.
		expect(
			rollupHealthSamples("resting_heart_rate", [
				sample("resting_heart_rate", 60, {
					origin: "com.watch",
					sourceRecordId: "rhr-w",
				}),
				sample("resting_heart_rate", 66, {
					origin: "com.phone",
					sourceRecordId: "rhr-p",
				}),
			]),
		).toBe(63);
	});

	it("recomputes both old and new days when an identity moves", () => {
		const existing = sample("steps", 400, {
			localDay: "2026-08-15",
			sourceRecordId: "moving",
		});
		const moved = sample("steps", 450, {
			localDay: "2026-08-16",
			sourceRecordId: "moving",
		});
		const applied = applyHealthSampleChanges([existing], {
			additions: [moved],
			deletions: [],
		});

		expect(applied.samples).toEqual([moved]);
		expect(applied.rollups).toEqual([
			{
				metricSlug: "steps",
				localDay: "2026-08-15",
				source: "health_connect",
				value: null,
			},
			{
				metricSlug: "steps",
				localDay: "2026-08-16",
				source: "health_connect",
				value: 450,
			},
		]);
	});

	it("recomputes a touched day after a platform deletion", () => {
		const first = sample("steps", 400, { sourceRecordId: "first" });
		const second = sample("steps", 600, { sourceRecordId: "second" });
		const applied = applyHealthSampleChanges([first, second], {
			additions: [],
			deletions: [{ source: "health_connect", sourceRecordId: "first" }],
		});

		expect(applied.samples).toEqual([second]);
		expect(applied.rollups).toEqual([
			{
				metricSlug: "steps",
				localDay: "2026-08-16",
				source: "health_connect",
				value: 600,
			},
		]);
	});

	it("removes an emptied rollup and converges when a batch is replayed", () => {
		const existing = sample("steps", 400, { sourceRecordId: "only" });
		const removed = applyHealthSampleChanges([existing], {
			additions: [],
			deletions: [{ source: "health_connect", sourceRecordId: "only" }],
		});
		expect(removed).toEqual({
			samples: [],
			rollups: [
				{
					metricSlug: "steps",
					localDay: "2026-08-16",
					source: "health_connect",
					value: null,
				},
			],
		});

		const addition = sample("steps", 500, { sourceRecordId: "replayed" });
		const first = applyHealthSampleChanges([], {
			additions: [addition],
			deletions: [],
		});
		const replayed = applyHealthSampleChanges(first.samples, {
			additions: [addition],
			deletions: [],
		});
		expect(replayed.samples).toEqual(first.samples);
		expect(replayed.rollups).toEqual(first.rollups);
	});

	it("selects imported objective data while retaining both provenances", () => {
		const user = observation(80);
		const olderImport = dailyMetric(81, 200);
		const latestImport = dailyMetric(79, 300);
		const resolved = resolveMetricDay(
			"weight",
			"2026-08-16",
			[user],
			[latestImport, olderImport],
		);

		expect(resolved.value).toBe(79);
		expect(resolved.selected).toEqual({
			kind: "imported",
			row: latestImport,
		});
		expect(resolved.userRows).toEqual([user]);
		expect(resolved.importedRows).toEqual([olderImport, latestImport]);
		expect(
			resolveMetricDay("weight", "2026-08-16", [user], []).selected,
		).toEqual({ kind: "user", rows: [user] });
	});
});
