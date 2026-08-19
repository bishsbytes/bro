import type { MeasurementSlug } from "@bro/domain/metric-registry";
import { resolveMetric } from "@bro/domain/metric-registry";
import type {
	ConsumptionEntry,
	DailyMetric,
	Observation,
} from "@bro/mobile-model";
import { type ResolvedMetricDay, resolveMetricDay } from "./resolved-day";

export type ResolvedMetricObservation = Observation & {
	resolvedDay: ResolvedMetricDay;
};

function localDayTimestamp(localDay: string): number {
	const timestamp = Date.parse(`${localDay}T12:00:00.000Z`);
	if (!Number.isFinite(timestamp)) {
		throw new TypeError(`Invalid metric local day: ${localDay}`);
	}
	return timestamp;
}

function importedObservation(
	day: ResolvedMetricDay,
	row: DailyMetric,
): ResolvedMetricObservation {
	return {
		id: `daily-metric:${row.id}`,
		metricSlug: row.metricSlug,
		value: row.value,
		scaleMin: null,
		scaleMax: null,
		observedAt: localDayTimestamp(row.localDay),
		localDay: row.localDay,
		tzOffsetMinutes: 0,
		source: row.source,
		sourceRecordId: row.id,
		assessmentId: null,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		resolvedDay: day,
	};
}

function userObservation(day: ResolvedMetricDay): ResolvedMetricObservation {
	const selected = day.selected;
	if (selected?.kind !== "user") {
		throw new TypeError("A resolved user day must contain user observations.");
	}
	const metric = resolveMetric(day.metricSlug);
	const latest = selected.rows.at(-1);
	if (!latest || metric.kind !== "known") {
		throw new TypeError(
			"A resolved user day is missing its metric definition.",
		);
	}
	return {
		...latest,
		value: day.value ?? latest.value,
		id:
			metric.metric.aggregation === "last"
				? latest.id
				: `resolved-user:${day.metricSlug}:${day.localDay}`,
		resolvedDay: day,
	};
}

function consumptionObservation(
	day: ResolvedMetricDay,
): ResolvedMetricObservation {
	const selected = day.selected;
	if (selected?.kind !== "consumption") {
		throw new TypeError("A resolved consumption day must contain entries.");
	}
	const latest = [...selected.entries]
		.sort(
			(left, right) =>
				left.occurredAt - right.occurredAt ||
				left.createdAt - right.createdAt ||
				left.id.localeCompare(right.id),
		)
		.at(-1);
	if (!latest || day.value === null) {
		throw new TypeError("A resolved consumption day is missing its total.");
	}
	return {
		id: `resolved-consumption:${day.metricSlug}:${day.localDay}`,
		metricSlug: day.metricSlug,
		value: day.value,
		scaleMin: null,
		scaleMax: null,
		observedAt: latest.occurredAt,
		localDay: day.localDay,
		tzOffsetMinutes: latest.tzOffsetMinutes,
		source: "consumption",
		sourceRecordId: null,
		assessmentId: null,
		createdAt: latest.createdAt,
		updatedAt: Math.max(...selected.entries.map((entry) => entry.updatedAt)),
		resolvedDay: day,
	};
}

/**
 * Produces one selected value per local day. Every contributing source row
 * remains attached to `resolvedDay` for provenance.
 */
export function resolveMetricObservations(
	metricSlug: MeasurementSlug,
	observations: readonly Observation[],
	dailyMetrics: readonly DailyMetric[],
	consumptionEntries: readonly ConsumptionEntry[] = [],
): ResolvedMetricObservation[] {
	const resolved = resolveMetric(metricSlug);
	const isConsumptionDerived =
		resolved.kind === "known" &&
		resolved.metric.kind === "measurement" &&
		"measurementSource" in resolved.metric &&
		resolved.metric.measurementSource === "consumption";
	const localDays = new Set([
		...observations
			.filter((row) => row.metricSlug === metricSlug)
			.map((row) => row.localDay),
		...dailyMetrics
			.filter((row) => row.metricSlug === metricSlug)
			.map((row) => row.localDay),
		...(isConsumptionDerived
			? consumptionEntries.map((entry) => entry.localDay)
			: []),
	]);

	return [...localDays]
		.sort((left, right) => left.localeCompare(right))
		.flatMap((localDay) => {
			const day = resolveMetricDay(
				metricSlug,
				localDay,
				observations,
				dailyMetrics,
				consumptionEntries,
			);
			if (!day.selected) return [];
			return [
				day.selected.kind === "imported"
					? importedObservation(day, day.selected.row)
					: day.selected.kind === "consumption"
						? consumptionObservation(day)
						: userObservation(day),
			];
		});
}

export function importedDailyMetricAsObservation(
	row: DailyMetric,
): Observation {
	return {
		id: `daily-metric:${row.id}`,
		metricSlug: row.metricSlug,
		value: row.value,
		scaleMin: null,
		scaleMax: null,
		observedAt: localDayTimestamp(row.localDay),
		localDay: row.localDay,
		tzOffsetMinutes: 0,
		source: row.source,
		sourceRecordId: row.id,
		assessmentId: null,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}
