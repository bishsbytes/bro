import type {
	DayNote,
	Observation,
	TrackedMetric,
} from "@bro/database-app";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	type MetricDefinition,
	resolveMetric,
} from "./content/metric-registry";
import {
	buildCheckInExport,
	CHECK_IN_EXPORT_FORMAT_VERSION,
	serializeCheckInExport,
} from "./export/check-in-export";

function knownMetric(slug: string): MetricDefinition {
	const resolved = resolveMetric(slug);
	if (resolved.kind !== "known") {
		throw new Error(`Expected ${slug} to be registered.`);
	}
	return resolved.metric;
}

const moodObservation: Observation = {
	id: "observation-mood",
	metricSlug: "mood",
	value: 4,
	scaleMin: 1,
	scaleMax: 5,
	observedAt: 1_786_701_600_000,
	localDay: "2026-08-14",
	tzOffsetMinutes: -60,
	source: "user",
	sourceRecordId: null,
	assessmentId: null,
	createdAt: 1_786_701_600_100,
	updatedAt: 1_786_701_600_100,
};

const alcoholObservation: Observation = {
	...moodObservation,
	id: "observation-alcohol",
	metricSlug: "alcohol",
	value: 1,
	scaleMin: null,
	scaleMax: null,
	observedAt: 1_786_705_200_000,
	createdAt: 1_786_705_200_100,
	updatedAt: 1_786_705_200_100,
};

const note: DayNote = {
	id: "note-1",
	localDay: "2026-08-14",
	body: "A useful day",
	createdAt: 1_786_708_800_000,
	updatedAt: 1_786_708_800_000,
};

const trackedAlcohol: TrackedMetric = {
	id: "tracked-alcohol",
	metricSlug: "alcohol",
	position: 6,
	addedAt: null,
	removedAt: 1_786_708_800_000,
	customLabel: null,
	createdAt: 1_786_708_800_000,
	updatedAt: 1_786_708_800_000,
};

describe("check-in export", () => {
	it("matches the version 1 golden file with stable ordering", () => {
		const serialized = serializeCheckInExport(
			{
				observations: [alcoholObservation, moodObservation],
				dayNotes: [note],
				trackedMetrics: [trackedAlcohol],
				registry: [knownMetric("alcohol"), knownMetric("mood")],
			},
			{
				appVersion: "1.0.0",
				exportedAt: 1_786_708_800_000,
			},
		);
		const golden = readFileSync(
			join(__dirname, "export", "__fixtures__", "check-in-export-v1.json"),
			"utf8",
		);

		expect(serialized).toBe(`${golden.trimEnd()}\n`);
		expect(JSON.parse(serialized).metadata.formatVersion).toBe(
			CHECK_IN_EXPORT_FORMAT_VERSION,
		);
	});

	it("includes sensitive metrics by default and can deliberately exclude them", () => {
		const sensitiveMetric: MetricDefinition = {
			...knownMetric("mood"),
			slug: "libido",
			label: "Libido",
			sensitive: true,
		};
		const sensitiveObservation: Observation = {
			...moodObservation,
			id: "observation-libido",
			metricSlug: "libido",
		};
		const unknownObservation: Observation = {
			...moodObservation,
			id: "observation-future",
			metricSlug: "future_metric",
		};
		const sensitiveOverlay: TrackedMetric = {
			...trackedAlcohol,
			id: "tracked-libido",
			metricSlug: "libido",
		};
		const unknownOverlay: TrackedMetric = {
			...trackedAlcohol,
			id: "tracked-future",
			metricSlug: "future_metric",
		};

		const input = {
			observations: [
				moodObservation,
				sensitiveObservation,
				unknownObservation,
			],
			dayNotes: [note],
			trackedMetrics: [sensitiveOverlay, unknownOverlay],
			registry: [knownMetric("mood"), sensitiveMetric],
		};
		const included = buildCheckInExport(input, {
			appVersion: "1.0.0",
			exportedAt: 1_786_708_800_000,
		});
		expect(included.observations.map((row) => row.metricSlug)).toContain(
			"libido",
		);

		const exported = buildCheckInExport(input, {
			appVersion: "1.0.0",
			exportedAt: 1_786_708_800_000,
			excludeSensitiveMetrics: true,
		});

		expect(exported.registry.metrics.map((metric) => metric.slug)).toEqual([
			"mood",
		]);
		expect(exported.observations.map((row) => row.metricSlug)).toEqual([
			"future_metric",
			"mood",
		]);
		expect(exported.trackedMetrics.map((row) => row.metricSlug)).toEqual([
			"future_metric",
		]);
		expect(exported.dayNotes).toEqual([note]);
	});

	it("produces a valid versioned export for an empty database", () => {
		const exported = buildCheckInExport(
			{
				observations: [],
				dayNotes: [],
				trackedMetrics: [],
				registry: [knownMetric("mood")],
			},
			{ appVersion: "1.0.0", exportedAt: 0 },
		);

		expect(exported).toMatchObject({
			metadata: {
				formatVersion: 1,
				exportedAt: "1970-01-01T00:00:00.000Z",
				appVersion: "1.0.0",
			},
			observations: [],
			dayNotes: [],
			trackedMetrics: [],
		});
		expect(exported.registry.metrics).toHaveLength(1);
	});
});
