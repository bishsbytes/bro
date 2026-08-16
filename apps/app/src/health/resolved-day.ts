import type { DailyMetric, Observation } from "@bro/database-app";
import { resolveMetric } from "../content/metric-registry";
import type { HealthMetricSlug } from "./policy";

export type ResolvedMetricDay = {
	metricSlug: HealthMetricSlug;
	localDay: string;
	value: number | null;
	selected:
		| { kind: "imported"; row: DailyMetric }
		| { kind: "user"; rows: Observation[] }
		| null;
	userRows: Observation[];
	importedRows: DailyMetric[];
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

/** Imported objective data wins without discarding the user's observations. */
export function resolveMetricDay(
	metricSlug: HealthMetricSlug,
	localDay: string,
	observations: readonly Observation[],
	dailyMetrics: readonly DailyMetric[],
): ResolvedMetricDay {
	const resolved = resolveMetric(metricSlug);
	if (resolved.kind !== "known" || resolved.metric.kind !== "measurement") {
		throw new TypeError(`Unknown health metric: ${metricSlug}`);
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
	};
}
