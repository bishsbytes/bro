import type { Observation } from "@bro/mobile-model";
import {
	MEASUREMENT_BASELINE_MIN_READINGS,
	resolveMeasurementBaseline,
} from "./baseline";

function reading(
	id: string,
	localDay: string,
	value: number,
	overrides: Partial<Observation> = {},
): Observation {
	return {
		id,
		metricSlug: "waist",
		value,
		scaleMin: null,
		scaleMax: null,
		observedAt: Date.parse(`${localDay}T08:00:00.000Z`),
		localDay,
		tzOffsetMinutes: 0,
		source: "user",
		sourceRecordId: null,
		assessmentId: null,
		slot: null,
		createdAt: Date.parse(`${localDay}T08:00:00.000Z`),
		updatedAt: Date.parse(`${localDay}T08:00:00.000Z`),
		...overrides,
	};
}

describe("measurement baseline", () => {
	it("reads nothing from no readings", () => {
		expect(resolveMeasurementBaseline([], "2026-09-02")).toEqual({
			current: null,
			previous: null,
			delta: null,
			usualRange: null,
			rail: null,
			readingCount: 0,
		});
	});

	it("measures the delta from the reading before, in either direction", () => {
		const down = resolveMeasurementBaseline(
			[reading("a", "2026-08-03", 0.88), reading("b", "2026-09-02", 0.865)],
			"2026-09-02",
		);
		expect(down.current).toMatchObject({
			value: 0.865,
			localDay: "2026-09-02",
		});
		expect(down.previous).toMatchObject({
			value: 0.88,
			localDay: "2026-08-03",
		});
		expect(down.delta).toBeCloseTo(-0.015, 10);

		const up = resolveMeasurementBaseline(
			[reading("a", "2026-08-03", 0.364), reading("b", "2026-09-02", 0.368)],
			"2026-09-02",
		);
		expect(up.delta).toBeCloseTo(0.004, 10);
	});

	it("orders by when a reading was observed, not by the order given", () => {
		const baseline = resolveMeasurementBaseline(
			[reading("late", "2026-09-02", 82), reading("early", "2026-08-03", 84)],
			"2026-09-02",
		);
		expect(baseline.current?.localDay).toBe("2026-09-02");
		expect(baseline.previous?.localDay).toBe("2026-08-03");
	});

	it("withholds a band until there are enough readings across enough days", () => {
		const days = ["2026-08-05", "2026-08-19", "2026-09-02"];
		const sparse = resolveMeasurementBaseline(
			days.map((day, index) => reading(`r${index}`, day, 86 + index)),
			"2026-09-02",
		);
		expect(sparse.readingCount).toBeLessThan(MEASUREMENT_BASELINE_MIN_READINGS);
		expect(sparse.usualRange).toBeNull();
		expect(sparse.rail).not.toBeNull();

		const crammed = resolveMeasurementBaseline(
			["2026-09-01", "2026-09-01", "2026-09-02", "2026-09-02"].map(
				(day, index) => reading(`c${index}`, day, 86 + index),
			),
			"2026-09-02",
		);
		expect(crammed.readingCount).toBe(4);
		expect(crammed.usualRange).toBeNull();
	});

	it("bands the middle half of the window and pads the rail around it", () => {
		const values = [84, 85, 86, 87, 88];
		const baseline = resolveMeasurementBaseline(
			values.map((value, index) =>
				reading(
					`r${index}`,
					`2026-07-${String(index * 7 + 1).padStart(2, "0")}`,
					value,
				),
			),
			"2026-09-02",
		);
		expect(baseline.usualRange).toEqual({ min: 85, max: 87 });
		expect(baseline.rail).toEqual({ min: 84 - 0.6, max: 88 + 0.6 });
		expect(baseline.readingCount).toBe(5);
	});

	it("leaves a reading older than the window out of the band and the rail", () => {
		const baseline = resolveMeasurementBaseline(
			[
				reading("ancient", "2025-01-01", 200),
				reading("a", "2026-07-01", 84),
				reading("b", "2026-07-15", 85),
				reading("c", "2026-08-01", 86),
				reading("d", "2026-09-02", 87),
			],
			"2026-09-02",
		);
		expect(baseline.readingCount).toBe(4);
		expect(baseline.usualRange).toEqual({ min: 84.75, max: 86.25 });
		expect(baseline.rail).toEqual({ min: 84 - 0.45, max: 87 + 0.45 });
	});

	it("still fits the previous reading on the rail when the window has moved past it", () => {
		const baseline = resolveMeasurementBaseline(
			[reading("then", "2026-01-05", 96), reading("now", "2026-09-02", 86)],
			"2026-09-02",
		);
		expect(baseline.previous?.value).toBe(96);
		expect(baseline.rail?.min).toBeLessThan(86);
		expect(baseline.rail?.max).toBeGreaterThan(96);
	});

	it("gives a rail width to a value that has never moved", () => {
		const baseline = resolveMeasurementBaseline(
			["2026-07-01", "2026-07-15", "2026-08-01", "2026-09-02"].map(
				(day, index) => reading(`r${index}`, day, 40),
			),
			"2026-09-02",
		);
		expect(baseline.usualRange).toEqual({ min: 40, max: 40 });
		expect(baseline.rail).toEqual({ min: 38, max: 42 });
		expect(baseline.delta).toBe(0);
	});
});
