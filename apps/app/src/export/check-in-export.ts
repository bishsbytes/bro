import type {
	DayNote,
	Observation,
	TrackedMetric,
} from "@bro/database-app";
import type { MetricDefinition } from "../content/metric-registry";

export const CHECK_IN_EXPORT_FORMAT_VERSION = 1 as const;

export type CheckInExportInput = {
	observations: readonly Observation[];
	dayNotes: readonly DayNote[];
	trackedMetrics: readonly TrackedMetric[];
	registry: readonly MetricDefinition[];
};

export type CheckInExportOptions = {
	appVersion: string;
	exportedAt: number;
	excludeSensitiveMetrics?: boolean;
};

type VersionOneTrackedMetric = Omit<TrackedMetric, "customLabel">;

export type CheckInExport = {
	metadata: {
		formatVersion: typeof CHECK_IN_EXPORT_FORMAT_VERSION;
		exportedAt: string;
		appVersion: string;
	};
	registry: {
		metrics: MetricDefinition[];
	};
	observations: Observation[];
	dayNotes: DayNote[];
	trackedMetrics: VersionOneTrackedMetric[];
};

function compareText(left: string, right: string): number {
	if (left === right) {
		return 0;
	}
	return left < right ? -1 : 1;
}

function copyMetric(metric: MetricDefinition): MetricDefinition {
	return { ...metric };
}

function copyObservation(row: Observation): Observation {
	return {
		id: row.id,
		metricSlug: row.metricSlug,
		value: row.value,
		scaleMin: row.scaleMin,
		scaleMax: row.scaleMax,
		observedAt: row.observedAt,
		localDay: row.localDay,
		tzOffsetMinutes: row.tzOffsetMinutes,
		source: row.source,
		sourceRecordId: row.sourceRecordId,
		assessmentId: row.assessmentId,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

function copyDayNote(note: DayNote): DayNote {
	return {
		id: note.id,
		localDay: note.localDay,
		body: note.body,
		createdAt: note.createdAt,
		updatedAt: note.updatedAt,
	};
}

function copyTrackedMetric(metric: TrackedMetric): VersionOneTrackedMetric {
	return {
		id: metric.id,
		metricSlug: metric.metricSlug,
		position: metric.position,
		addedAt: metric.addedAt,
		removedAt: metric.removedAt,
		createdAt: metric.createdAt,
		updatedAt: metric.updatedAt,
	};
}

export function buildCheckInExport(
	input: CheckInExportInput,
	options: CheckInExportOptions,
): CheckInExport {
	if (options.appVersion.trim().length === 0) {
		throw new TypeError("Export appVersion must not be empty.");
	}
	const exportedAt = new Date(options.exportedAt);
	if (Number.isNaN(exportedAt.getTime())) {
		throw new TypeError("Export exportedAt must be valid epoch milliseconds.");
	}

	const registryBySlug = new Map(
		input.registry.map((metric) => [metric.slug, metric]),
	);
	const includeSlug = (slug: string): boolean =>
		!options.excludeSensitiveMetrics ||
		registryBySlug.get(slug)?.sensitive !== true;

	return {
		metadata: {
			formatVersion: CHECK_IN_EXPORT_FORMAT_VERSION,
			exportedAt: exportedAt.toISOString(),
			appVersion: options.appVersion,
		},
		registry: {
			metrics: input.registry
				.filter((metric) => includeSlug(metric.slug))
				.map(copyMetric)
				.sort(
					(left, right) =>
						left.defaultPosition - right.defaultPosition ||
						compareText(left.slug, right.slug),
				),
		},
		observations: input.observations
			.filter((row) => includeSlug(row.metricSlug))
			.map(copyObservation)
			.sort(
				(left, right) =>
					compareText(left.localDay, right.localDay) ||
					left.observedAt - right.observedAt ||
					left.createdAt - right.createdAt ||
					compareText(left.id, right.id),
			),
		dayNotes: input.dayNotes
			.map(copyDayNote)
			.sort(
				(left, right) =>
					compareText(left.localDay, right.localDay) ||
					left.createdAt - right.createdAt ||
					compareText(left.id, right.id),
			),
		trackedMetrics: input.trackedMetrics
			.filter((row) => includeSlug(row.metricSlug))
			.map(copyTrackedMetric)
			.sort(
				(left, right) =>
					left.position - right.position ||
					left.createdAt - right.createdAt ||
					compareText(left.id, right.id),
			),
	};
}

export function serializeCheckInExport(
	input: CheckInExportInput,
	options: CheckInExportOptions,
): string {
	return `${JSON.stringify(buildCheckInExport(input, options), null, 2)}\n`;
}
