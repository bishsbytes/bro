import { resolveMetric, TAG_PRESENCE_VALUE } from "@bro/domain/metric-registry";
import type { DailyMetric, IntakeEvent, Observation } from "@bro/mobile-model";
import { resolveMetricDay } from "../health/resolved-day";

export type DailySignal = {
	metricSlug: string;
	localDay: string;
	value: number;
};

export type DailySignalSource = {
	observations: readonly Observation[];
	dailyMetrics: readonly DailyMetric[];
	intakeEvents?: readonly IntakeEvent[];
	tagActive?: (metricSlug: string, localDay: string) => boolean;
};

export type DailySignalReader = (
	metricSlug: string,
	localDay: string,
) => DailySignal | null;

function signalKey(metricSlug: string, localDay: string): string {
	return `${metricSlug}\u0000${localDay}`;
}

function groupByKey<Row extends { metricSlug: string; localDay: string }>(
	rows: readonly Row[],
): Map<string, Row[]> {
	const byKey = new Map<string, Row[]>();
	for (const row of rows) {
		const key = signalKey(row.metricSlug, row.localDay);
		const grouped = byKey.get(key);
		if (grouped) grouped.push(row);
		else byKey.set(key, [row]);
	}
	return byKey;
}

/** Indexes the source once so each per-day read costs a map lookup, not a scan. */
export function createDailySignalReader(
	source: DailySignalSource,
): DailySignalReader {
	const observationsByKey = groupByKey(source.observations);
	const metricsByKey = groupByKey(source.dailyMetrics);
	const intakeEventsByDay = new Map<string, IntakeEvent[]>();
	for (const event of source.intakeEvents ?? []) {
		const events = intakeEventsByDay.get(event.localDay);
		if (events) events.push(event);
		else intakeEventsByDay.set(event.localDay, [event]);
	}

	return (metricSlug, localDay) => {
		const resolved = resolveMetric(metricSlug);
		if (resolved.kind !== "known") return null;
		const metric = resolved.metric;
		const dayRows =
			observationsByKey.get(signalKey(metricSlug, localDay)) ?? [];

		if (metric.kind === "tag") {
			const present = dayRows.some((row) => row.value === TAG_PRESENCE_VALUE);
			if (present) {
				return { metricSlug, localDay, value: 1 };
			}
			// Only an explicit absence is a negative observation. A mood check-in
			// does not establish whether the person reviewed their activity tags.
			return dayRows.some((row) => row.value === 0)
				? { metricSlug, localDay, value: 0 }
				: null;
		}

		if (metric.kind === "measurement") {
			const value = resolveMetricDay(
				metric.slug,
				localDay,
				dayRows,
				metricsByKey.get(signalKey(metricSlug, localDay)) ?? [],
				intakeEventsByDay.get(localDay) ?? [],
			).value;
			if (value !== null) {
				return { metricSlug, localDay, value };
			}
			return null;
		}

		const rows = dayRows.filter(
			(row) =>
				metric.kind !== "scored" ||
				(row.scaleMin === metric.scaleMin && row.scaleMax === metric.scaleMax),
		);
		if (rows.length === 0) return null;
		const total = rows.reduce((sum, row) => sum + row.value, 0);
		return {
			metricSlug,
			localDay,
			value: total / rows.length,
		};
	};
}

/** Returns at most one canonical value for a metric on a local calendar day. */
export function readDailySignal(
	metricSlug: string,
	localDay: string,
	source: DailySignalSource,
): DailySignal | null {
	return createDailySignalReader(source)(metricSlug, localDay);
}
