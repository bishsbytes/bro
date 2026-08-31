import { resolveMetric } from "@bro/domain/metric-registry";
import type { Observation } from "@bro/mobile-model";
import { buildTrendSeries, trendRange } from "./trend-math";

function observation(
	id: string,
	localDay: string,
	value: number,
	overrides: Partial<Observation> = {},
): Observation {
	return {
		id,
		metricSlug: "mood",
		value,
		scaleMin: 1,
		scaleMax: 5,
		observedAt: Date.parse(`${localDay}T12:00:00.000Z`),
		localDay,
		tzOffsetMinutes: 0,
		source: "user",
		sourceRecordId: null,
		assessmentId: null,
		slot: "morning",
		createdAt: 1,
		updatedAt: 1,
		...overrides,
	};
}

function knownMetric(slug: string) {
	const resolved = resolveMetric(slug);
	if (resolved.kind !== "known") {
		throw new Error(`Expected ${slug} to be registered.`);
	}
	return resolved.metric;
}

describe("trend math", () => {
	it("means repeated check-ins by registry rule and leaves missing days as gaps", () => {
		const series = buildTrendSeries(
			[
				observation("a", "2026-08-08", 1),
				observation("b", "2026-08-08", 5),
				observation("c", "2026-08-10", 4),
			],
			knownMetric("mood"),
			"2026-08-14",
			7,
		);

		expect(series.points).toEqual([
			{ localDay: "2026-08-08", value: 3 },
			{ localDay: "2026-08-09", value: null },
			{ localDay: "2026-08-10", value: 4 },
			{ localDay: "2026-08-11", value: null },
			{ localDay: "2026-08-12", value: null },
			{ localDay: "2026-08-13", value: null },
			{ localDay: "2026-08-14", value: null },
		]);
		expect(series.segments).toHaveLength(2);
		expect(series.observedDayCount).toBe(2);
		expect(series.daysUntilMeaningful).toBe(5);
	});

	it("normalises stored scale snapshots before aggregating", () => {
		const series = buildTrendSeries(
			[
				observation("old", "2026-08-14", 50, {
					scaleMin: 0,
					scaleMax: 100,
				}),
				observation("current", "2026-08-14", 5),
			],
			knownMetric("mood"),
			"2026-08-14",
			7,
		);

		expect(series.points.at(-1)?.value).toBe(4);
	});

	it("normalises assessment snapshots onto the current wheel scale", () => {
		const series = buildTrendSeries(
			[
				observation("old-wheel", "2026-08-14", 50, {
					metricSlug: "wheel:career",
					scaleMin: 0,
					scaleMax: 100,
				}),
				observation("current-wheel", "2026-08-14", 10, {
					metricSlug: "wheel:career",
					scaleMin: 1,
					scaleMax: 10,
				}),
			],
			knownMetric("wheel:career"),
			"2026-08-14",
			7,
		);

		expect(series.points.at(-1)?.value).toBe(7.75);
	});

	it("uses presence aggregation and produces inclusive 30-day ranges", () => {
		const tag = knownMetric("stress");
		const series = buildTrendSeries(
			[
				observation("stress-1", "2026-08-14", 9, {
					metricSlug: "stress",
					scaleMin: null,
					scaleMax: null,
				}),
			],
			tag,
			"2026-08-14",
			30,
		);

		expect(trendRange("2026-08-14", 30)).toEqual({
			fromLocalDay: "2026-07-16",
			throughLocalDay: "2026-08-14",
		});
		expect(series.points).toHaveLength(30);
		expect(series.points.at(-1)?.value).toBe(1);
	});

	it("uses the last observed measurement each day and keeps gaps", () => {
		const series = buildTrendSeries(
			[
				observation("later-created", "2026-08-13", 79, {
					metricSlug: "weight",
					scaleMin: null,
					scaleMax: null,
					observedAt: Date.parse("2026-08-13T08:00:00.000Z"),
					createdAt: 2,
				}),
				observation("later-observed", "2026-08-13", 78, {
					metricSlug: "weight",
					scaleMin: null,
					scaleMax: null,
					observedAt: Date.parse("2026-08-13T20:00:00.000Z"),
					createdAt: 1,
				}),
			],
			knownMetric("weight"),
			"2026-08-14",
			7,
		);

		expect(series.points.at(-2)).toEqual({
			localDay: "2026-08-13",
			value: 78,
		});
		expect(series.points.at(-1)).toEqual({
			localDay: "2026-08-14",
			value: null,
		});
		expect(series.markers).toHaveLength(1);
		expect(series.markers[0]?.y).toBe(60);
	});

	it("supports registry-driven sum aggregation", () => {
		const series = buildTrendSeries(
			[
				observation("morning", "2026-08-14", 4_000, {
					metricSlug: "steps",
					scaleMin: null,
					scaleMax: null,
				}),
				observation("evening", "2026-08-14", 6_000, {
					metricSlug: "steps",
					scaleMin: null,
					scaleMax: null,
				}),
			],
			knownMetric("steps"),
			"2026-08-14",
			7,
		);

		expect(series.points.at(-1)?.value).toBe(10_000);
	});

	it("marks a metric meaningful after seven distinct logged days", () => {
		const rows = Array.from({ length: 7 }, (_, index) =>
			observation(
				`day-${index}`,
				`2026-08-${String(index + 8).padStart(2, "0")}`,
				3,
			),
		);
		const series = buildTrendSeries(rows, knownMetric("mood"), "2026-08-14", 7);

		expect(series.observedDayCount).toBe(7);
		expect(series.daysUntilMeaningful).toBe(0);
	});
});
