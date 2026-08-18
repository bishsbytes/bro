import type { DailyMetric, Observation } from "@bro/database-app";
import { resolveMetric } from "@bro/domain/metric-registry";
import type { HealthMetricSlug } from "./policy";
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
	if (!selected || selected.kind !== "user") {
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

/**
 * Produces one selected value per local day. Imported objective rollups win,
 * while every original row remains attached to `resolvedDay` for provenance.
 */
export function resolveMetricObservations(
	metricSlug: HealthMetricSlug,
	observations: readonly Observation[],
	dailyMetrics: readonly DailyMetric[],
): ResolvedMetricObservation[] {
	const localDays = new Set([
		...observations
			.filter((row) => row.metricSlug === metricSlug)
			.map((row) => row.localDay),
		...dailyMetrics
			.filter((row) => row.metricSlug === metricSlug)
			.map((row) => row.localDay),
	]);

	return [...localDays]
		.sort((left, right) => left.localeCompare(right))
		.flatMap((localDay) => {
			const day = resolveMetricDay(
				metricSlug,
				localDay,
				observations,
				dailyMetrics,
			);
			if (!day.selected) return [];
			return [
				day.selected.kind === "imported"
					? importedObservation(day, day.selected.row)
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
