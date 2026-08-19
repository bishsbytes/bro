import type {
	ConsumptionEntry,
	DailyMetric,
	Observation,
} from "@bro/database-app";
import {
	type ConsumptionDerivedMeasurementSlug,
	type MeasurementSlug,
	resolveMetric,
} from "@bro/domain/metric-registry";
import { consumptionMetricDayTotal } from "../consumption";

export type ResolvedMetricDay = {
	metricSlug: MeasurementSlug;
	localDay: string;
	value: number | null;
	selected:
		| { kind: "imported"; row: DailyMetric }
		| { kind: "user"; rows: Observation[] }
		| { kind: "consumption"; entries: ConsumptionEntry[] }
		| null;
	userRows: Observation[];
	importedRows: DailyMetric[];
	consumptionEntries: ConsumptionEntry[];
};

function compareObservations(left: Observation, right: Observation): number {
	return (
		left.observedAt - right.observedAt ||
		left.createdAt - right.createdAt ||
		left.id.localeCompare(right.id)
	);
}

function compareImports(left: DailyMetric, right: DailyMetric): number {
	return (
		left.computedAt - right.computedAt ||
		left.updatedAt - right.updatedAt ||
		left.source.localeCompare(right.source) ||
		left.id.localeCompare(right.id)
	);
}

/** Resolves the metric's declared source while retaining its row provenance. */
export function resolveMetricDay(
	metricSlug: MeasurementSlug,
	localDay: string,
	observations: readonly Observation[],
	dailyMetrics: readonly DailyMetric[],
	consumptionEntries: readonly ConsumptionEntry[] = [],
): ResolvedMetricDay {
	const resolved = resolveMetric(metricSlug);
	if (resolved.kind !== "known" || resolved.metric.kind !== "measurement") {
		throw new TypeError(`Unknown resolvable metric: ${metricSlug}`);
	}
	if (
		"measurementSource" in resolved.metric &&
		resolved.metric.measurementSource === "consumption"
	) {
		const total = consumptionMetricDayTotal(
			metricSlug as ConsumptionDerivedMeasurementSlug,
			localDay,
			consumptionEntries,
		);
		return {
			metricSlug,
			localDay,
			value: total.value,
			selected:
				total.value === null
					? null
					: { kind: "consumption", entries: total.entries },
			userRows: [],
			importedRows: [],
			consumptionEntries: total.entries,
		};
	}
	const userRows = observations
		.filter(
			(row) =>
				row.metricSlug === metricSlug &&
				row.localDay === localDay &&
				row.source === "user",
		)
		.sort(compareObservations);
	const importedRows = dailyMetrics
		.filter((row) => row.metricSlug === metricSlug && row.localDay === localDay)
		.sort(compareImports);
	const imported = importedRows.at(-1);
	if (imported) {
		return {
			metricSlug,
			localDay,
			value: imported.value,
			selected: { kind: "imported", row: imported },
			userRows,
			importedRows,
			consumptionEntries: [],
		};
	}
	if (userRows.length === 0) {
		return {
			metricSlug,
			localDay,
			value: null,
			selected: null,
			userRows,
			importedRows,
			consumptionEntries: [],
		};
	}

	let value: number;
	if (resolved.metric.aggregation === "last") {
		value = userRows.at(-1)?.value ?? 0;
	} else {
		const total = userRows.reduce((sum, row) => sum + row.value, 0);
		value =
			resolved.metric.aggregation === "sum" ? total : total / userRows.length;
	}
	return {
		metricSlug,
		localDay,
		value,
		selected: { kind: "user", rows: userRows },
		userRows,
		importedRows,
		consumptionEntries: [],
	};
}
