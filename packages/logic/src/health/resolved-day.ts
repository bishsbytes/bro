import {
	type MeasurementSlug,
	resolveMetric,
} from "@bro/domain/metric-registry";
import type { DailyMetric, IntakeEvent, Observation } from "@bro/mobile-model";
import { intakeDayTotal } from "../intake/totals";

export type ResolvedMetricDay = {
	metricSlug: MeasurementSlug;
	localDay: string;
	value: number | null;
	selected:
		| { kind: "imported"; row: DailyMetric }
		| { kind: "user"; rows: Observation[] }
		| { kind: "intake"; events: IntakeEvent[] }
		| null;
	userRows: Observation[];
	importedRows: DailyMetric[];
	intakeEvents: IntakeEvent[];
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
	intakeEvents: readonly IntakeEvent[] = [],
): ResolvedMetricDay {
	const resolved = resolveMetric(metricSlug);
	if (resolved.kind !== "known" || resolved.metric.kind !== "measurement") {
		throw new TypeError(`Unknown resolvable metric: ${metricSlug}`);
	}
	if (
		"measurementSource" in resolved.metric &&
		resolved.metric.measurementSource === "consumption"
	) {
		// An intake metric is arithmetic over the day's events: the sum of its
		// constituent code, with no per-stream storage and nothing branching on
		// the event's kind.
		const total = intakeDayTotal(
			resolved.metric.constituentCode,
			localDay,
			intakeEvents,
		);
		return {
			metricSlug,
			localDay,
			value: total.value,
			selected:
				total.value === null ? null : { kind: "intake", events: total.events },
			userRows: [],
			importedRows: [],
			intakeEvents: total.events,
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
	// A deliberate manual reading wins for its day. Imports remain attached as
	// provenance, but a later sync must not make the person's correction appear
	// to have been ignored.
	if (userRows.length > 0) {
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
			intakeEvents: [],
		};
	}
	if (imported) {
		return {
			metricSlug,
			localDay,
			value: imported.value,
			selected: { kind: "imported", row: imported },
			userRows,
			importedRows,
			intakeEvents: [],
		};
	}
	return {
		metricSlug,
		localDay,
		value: null,
		selected: null,
		userRows,
		importedRows,
		intakeEvents: [],
	};
}
