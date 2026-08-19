import type {
	ConsumptionEntry,
	DailyMetric,
	Observation,
} from "@bro/database-app";
import {
	FACTOR_PRESENCE_VALUE,
	resolveMetric,
} from "@bro/domain/metric-registry";
import { resolveMetricDay } from "../health/resolved-day";

export type DailySignal = {
	metricSlug: string;
	localDay: string;
	value: number;
};

export type DailySignalSource = {
	observations: readonly Observation[];
	dailyMetrics: readonly DailyMetric[];
	consumptionEntries?: readonly ConsumptionEntry[];
	factorActive?: (metricSlug: string, localDay: string) => boolean;
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

function consumptionFactorPresent(
	metricSlug: string,
	entries: readonly ConsumptionEntry[],
): boolean {
	if (metricSlug === "alcohol") {
		return entries.some((entry) => (entry.ethanolKg ?? 0) > 0);
	}
	if (metricSlug === "caffeine") {
		return entries.some((entry) => (entry.caffeineKg ?? 0) > 0);
	}
	return false;
}

/** Indexes the source once so each per-day read costs a map lookup, not a scan. */
export function createDailySignalReader(
	source: DailySignalSource,
): DailySignalReader {
	const observationsByKey = groupByKey(source.observations);
	const metricsByKey = groupByKey(source.dailyMetrics);
	const consumptionEntriesByDay = new Map<string, ConsumptionEntry[]>();
	for (const entry of source.consumptionEntries ?? []) {
		const entries = consumptionEntriesByDay.get(entry.localDay);
		if (entries) entries.push(entry);
		else consumptionEntriesByDay.set(entry.localDay, [entry]);
	}
	const checkInDays = new Set<string>();
	for (const row of source.observations) {
		const resolved = resolveMetric(row.metricSlug);
		if (resolved.kind === "known" && resolved.metric.kind === "scored") {
			checkInDays.add(row.localDay);
		}
	}

	return (metricSlug, localDay) => {
		const resolved = resolveMetric(metricSlug);
		if (resolved.kind !== "known") return null;
		const metric = resolved.metric;
		const dayRows =
			observationsByKey.get(signalKey(metricSlug, localDay)) ?? [];

		if (metric.kind === "factor") {
			const present = dayRows.some(
				(row) => row.value === FACTOR_PRESENCE_VALUE,
			);
			const derivedPresent = consumptionFactorPresent(
				metricSlug,
				consumptionEntriesByDay.get(localDay) ?? [],
			);
			if (present || derivedPresent) {
				return { metricSlug, localDay, value: 1 };
			}
			return checkInDays.has(localDay) &&
				(source.factorActive?.(metricSlug, localDay) ?? true)
				? { metricSlug, localDay, value: 0 }
				: null;
		}

		if (metric.kind === "measurement") {
			const value = resolveMetricDay(
				metric.slug,
				localDay,
				dayRows,
				metricsByKey.get(signalKey(metricSlug, localDay)) ?? [],
				consumptionEntriesByDay.get(localDay) ?? [],
			).value;
			return value === null ? null : { metricSlug, localDay, value };
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
