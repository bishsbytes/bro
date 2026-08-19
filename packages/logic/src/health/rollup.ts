import { resolveMetric } from "@bro/domain/metric-registry";
import type { HealthPlatform } from "@bro/mobile-model";
import type { CanonicalHealthSample } from "./mapping";
import type { HealthMetricSlug } from "./policy";

export type HealthSampleIdentity = Pick<
	CanonicalHealthSample,
	"source" | "sourceRecordId"
>;

export type HealthSampleChanges = {
	additions: readonly CanonicalHealthSample[];
	deletions: readonly HealthSampleIdentity[];
};

export type RecomputedHealthRollup = {
	metricSlug: HealthMetricSlug;
	localDay: string;
	source: HealthPlatform;
	value: number | null;
};

export type AppliedHealthSampleChanges = {
	samples: CanonicalHealthSample[];
	rollups: RecomputedHealthRollup[];
};

function identityOf(sample: HealthSampleIdentity): string {
	return JSON.stringify([sample.source, sample.sourceRecordId]);
}

function rollupKey(
	sample: Pick<CanonicalHealthSample, "metricSlug" | "localDay" | "source">,
): string {
	return JSON.stringify([sample.metricSlug, sample.localDay, sample.source]);
}

function compareSamples(
	left: CanonicalHealthSample,
	right: CanonicalHealthSample,
): number {
	return (
		left.metricSlug.localeCompare(right.metricSlug) ||
		left.localDay.localeCompare(right.localDay) ||
		left.source.localeCompare(right.source) ||
		left.endedAt - right.endedAt ||
		left.startedAt - right.startedAt ||
		left.sourceRecordId.localeCompare(right.sourceRecordId)
	);
}

/**
 * A phone and a watch typically both record the same walking and the same
 * sleep, so summing every raw sample double counts whenever two recording
 * origins overlap. The platforms' own aggregate APIs deduplicate by origin
 * priority; the equivalent here is taking the single origin with the largest
 * daily total. Days recorded by one origin are unaffected, and origin-less
 * samples share one bucket.
 */
function dominantOriginTotal(
	samples: readonly CanonicalHealthSample[],
): number {
	const totals = new Map<string, number>();
	for (const sample of samples) {
		const origin = sample.origin ?? "";
		totals.set(origin, (totals.get(origin) ?? 0) + sample.value);
	}
	const dominant = [...totals.entries()].sort(
		(left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
	)[0];
	return dominant ? dominant[1] : 0;
}

export function rollupHealthSamples(
	metricSlug: HealthMetricSlug,
	samples: readonly CanonicalHealthSample[],
): number | null {
	if (samples.length === 0) return null;
	if (samples.some((sample) => sample.metricSlug !== metricSlug)) {
		throw new TypeError("A health rollup cannot mix metric slugs.");
	}
	const naturalKey = samples[0];
	if (
		!naturalKey ||
		samples.some(
			(sample) =>
				sample.localDay !== naturalKey.localDay ||
				sample.source !== naturalKey.source,
		)
	) {
		throw new TypeError("A health rollup cannot mix days or sources.");
	}
	const resolved = resolveMetric(metricSlug);
	if (resolved.kind !== "known" || resolved.metric.kind !== "measurement") {
		throw new TypeError(`Unknown health metric: ${metricSlug}`);
	}

	if (resolved.metric.aggregation === "last") {
		return [...samples].sort(compareSamples).at(-1)?.value ?? null;
	}
	if (resolved.metric.aggregation === "sum") {
		return dominantOriginTotal(samples);
	}
	const total = samples.reduce((sum, sample) => sum + sample.value, 0);
	if (resolved.metric.aggregation === "mean") return total / samples.length;
	throw new TypeError(
		`Aggregation ${resolved.metric.aggregation} cannot roll up health samples.`,
	);
}

/**
 * Applies a platform change batch in memory and recomputes every natural key
 * touched by an addition, update, move, or deletion. A null value means the
 * durable daily row must be removed.
 */
export function applyHealthSampleChanges(
	existing: readonly CanonicalHealthSample[],
	changes: HealthSampleChanges,
): AppliedHealthSampleChanges {
	const samplesByIdentity = new Map(
		existing.map((sample) => [identityOf(sample), sample]),
	);
	const touched = new Map<string, RecomputedHealthRollup>();
	const touch = (sample: CanonicalHealthSample) => {
		touched.set(rollupKey(sample), {
			metricSlug: sample.metricSlug,
			localDay: sample.localDay,
			source: sample.source,
			value: null,
		});
	};

	for (const deletion of changes.deletions) {
		const existingSample = samplesByIdentity.get(identityOf(deletion));
		if (existingSample) {
			touch(existingSample);
			samplesByIdentity.delete(identityOf(deletion));
		}
	}
	for (const addition of changes.additions) {
		const identity = identityOf(addition);
		const replaced = samplesByIdentity.get(identity);
		if (replaced) touch(replaced);
		touch(addition);
		samplesByIdentity.set(identity, addition);
	}

	const samples = [...samplesByIdentity.values()].sort(compareSamples);
	const rollups = [...touched.values()]
		.map((target) => ({
			...target,
			value: rollupHealthSamples(
				target.metricSlug,
				samples.filter((sample) => rollupKey(sample) === rollupKey(target)),
			),
		}))
		.sort(
			(left, right) =>
				left.metricSlug.localeCompare(right.metricSlug) ||
				left.localDay.localeCompare(right.localDay) ||
				left.source.localeCompare(right.source),
		);
	return { samples, rollups };
}
