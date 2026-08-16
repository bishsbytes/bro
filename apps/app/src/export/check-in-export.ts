import type {
	Assessment,
	DayNote,
	Goal,
	Observation,
	TrackedMetric,
	UnitPreference,
} from "@bro/database-app";
import type { MetricDefinition } from "../content/metric-registry";

export const CHECK_IN_EXPORT_FORMAT_VERSION = 3 as const;

export type CheckInExportInput = {
	observations: readonly Observation[];
	dayNotes: readonly DayNote[];
	trackedMetrics: readonly TrackedMetric[];
	assessments: readonly Assessment[];
	goals: readonly Goal[];
	unitPreferences: readonly UnitPreference[];
	registry: readonly MetricDefinition[];
};

export type CheckInExportOptions = {
	appVersion: string;
	exportedAt: number;
	excludeSensitiveMetrics?: boolean;
};

type VersionOneTrackedMetric = Omit<TrackedMetric, "customLabel">;
/** Registry dimensions join the serialized contract with the planned v3 bump. */
type LegacyMetricDefinition = Omit<MetricDefinition, "dimension">;

type ExportMetadata<Version extends 1 | 2 | 3> = {
	formatVersion: Version;
	exportedAt: string;
	appVersion: string;
};

export type CheckInExportV1 = {
	metadata: {
		formatVersion: 1;
		exportedAt: string;
		appVersion: string;
	};
	registry: {
		metrics: LegacyMetricDefinition[];
	};
	observations: Observation[];
	dayNotes: DayNote[];
	trackedMetrics: VersionOneTrackedMetric[];
};

export type CheckInExportV2 = {
	metadata: ExportMetadata<2>;
	registry: {
		metrics: LegacyMetricDefinition[];
	};
	observations: Observation[];
	dayNotes: DayNote[];
	trackedMetrics: TrackedMetric[];
	assessments: Assessment[];
	goals: Goal[];
};

export type CheckInExport = {
	metadata: ExportMetadata<typeof CHECK_IN_EXPORT_FORMAT_VERSION>;
	registry: {
		metrics: MetricDefinition[];
	};
	observations: Observation[];
	dayNotes: DayNote[];
	trackedMetrics: TrackedMetric[];
	assessments: Assessment[];
	goals: Goal[];
	unitPreferences: UnitPreference[];
};

export type ParsedCheckInExport =
	| CheckInExportV1
	| CheckInExportV2
	| CheckInExport;

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

function copyTrackedMetric(metric: TrackedMetric): TrackedMetric {
	return {
		id: metric.id,
		metricSlug: metric.metricSlug,
		position: metric.position,
		addedAt: metric.addedAt,
		removedAt: metric.removedAt,
		customLabel: metric.customLabel,
		createdAt: metric.createdAt,
		updatedAt: metric.updatedAt,
	};
}

function copyAssessment(assessment: Assessment): Assessment {
	return {
		id: assessment.id,
		templateSlug: assessment.templateSlug,
		templateVersion: assessment.templateVersion,
		startedAt: assessment.startedAt,
		completedAt: assessment.completedAt,
		items: assessment.items.map((item) => ({ ...item })),
		focusItemSlugs: [...assessment.focusItemSlugs],
		createdAt: assessment.createdAt,
		updatedAt: assessment.updatedAt,
	};
}

function copyGoal(goal: Goal): Goal {
	return {
		id: goal.id,
		metricSlug: goal.metricSlug,
		direction: goal.direction,
		targetValue: goal.targetValue,
		targetDate: goal.targetDate,
		startedAt: goal.startedAt,
		achievedAt: goal.achievedAt,
		abandonedAt: goal.abandonedAt,
		createdAt: goal.createdAt,
		updatedAt: goal.updatedAt,
	};
}

function copyUnitPreference(preference: UnitPreference): UnitPreference {
	return {
		id: preference.id,
		dimension: preference.dimension,
		unit: preference.unit,
		createdAt: preference.createdAt,
		updatedAt: preference.updatedAt,
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
		assessments: input.assessments
			.map(copyAssessment)
			.map((assessment) => {
				const items = assessment.items.filter((item) => includeSlug(item.slug));
				const includedItems = new Set(items.map((item) => item.slug));
				return {
					...assessment,
					items,
					focusItemSlugs: assessment.focusItemSlugs.filter((slug) =>
						includedItems.has(slug),
					),
				};
			})
			.filter((assessment) => assessment.items.length > 0)
			.sort(
				(left, right) =>
					(left.completedAt ?? left.startedAt) -
						(right.completedAt ?? right.startedAt) ||
					left.createdAt - right.createdAt ||
					compareText(left.id, right.id),
			),
		goals: input.goals
			.filter((goal) => includeSlug(goal.metricSlug))
			.map(copyGoal)
			.sort(
				(left, right) =>
					left.startedAt - right.startedAt ||
					left.createdAt - right.createdAt ||
					compareText(left.id, right.id),
			),
		unitPreferences: input.unitPreferences
			.map(copyUnitPreference)
			.sort(
				(left, right) =>
					compareText(left.dimension, right.dimension) ||
					left.updatedAt - right.updatedAt ||
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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireArray(record: Record<string, unknown>, key: string): void {
	if (!Array.isArray(record[key])) {
		throw new TypeError(`Export ${key} must be an array.`);
	}
}

export function parseCheckInExport(serialized: string): ParsedCheckInExport {
	let parsed: unknown;
	try {
		parsed = JSON.parse(serialized);
	} catch {
		throw new TypeError("Export must be valid JSON.");
	}
	if (!isRecord(parsed) || !isRecord(parsed.metadata)) {
		throw new TypeError("Export metadata is required.");
	}
	if (!isRecord(parsed.registry)) {
		throw new TypeError("Export registry is required.");
	}
	requireArray(parsed.registry, "metrics");
	for (const key of ["observations", "dayNotes", "trackedMetrics"]) {
		requireArray(parsed, key);
	}

	if (parsed.metadata.formatVersion === 1) {
		return parsed as CheckInExportV1;
	}
	if (parsed.metadata.formatVersion === 2) {
		requireArray(parsed, "assessments");
		requireArray(parsed, "goals");
		return parsed as CheckInExportV2;
	}
	if (parsed.metadata.formatVersion === CHECK_IN_EXPORT_FORMAT_VERSION) {
		requireArray(parsed, "assessments");
		requireArray(parsed, "goals");
		requireArray(parsed, "unitPreferences");
		return parsed as CheckInExport;
	}
	throw new RangeError(
		`Unsupported export format version: ${String(parsed.metadata.formatVersion)}`,
	);
}
