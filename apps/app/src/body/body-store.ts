import {
	DailyMetricRepository,
	type Goal,
	GoalRepository,
	getDb,
	type Observation,
	ObservationRepository,
	TrackedMetricsRepository,
	UnitPreferenceRepository,
} from "@bro/database-app";
import { type DisplayUnit, localDayOf, systemLocale } from "@bro/domain";
import {
	type BodyMetricGroup,
	type ImportedOnlyMeasurementMetricDefinition,
	listImportedOnlyMeasurements,
	listUserEnterableMeasurements,
	type ManualMeasurementCapture,
	type MeasurementMetricDefinition,
	type MeasurementSlug,
	type UserEnterableMeasurementMetricDefinition,
} from "@bro/domain/metric-registry";
import {
	buildTrendSeries,
	formatMetricDelta,
	formatMetricValue,
	goalStatus,
	importedDailyMetricAsObservation,
	isHealthMetricSlug,
	type MeasurementBaseline,
	type MeasurementPresentation,
	type MeasurementRange,
	type MeasurementReading,
	metricDisplayUnit,
	type ResolvedGoalProgress,
	resolveGoalProgress,
	resolveMeasurementBaseline,
	resolveMetricObservations,
	type TrendSeries,
	toMeasurementPresentation,
} from "@bro/logic";
import type { SQLiteDatabase } from "expo-sqlite";
import { resolveMetric } from "../content";
import { i18n } from "../i18n";
import { unitWords } from "../units/unit-words";

export type { MeasurementPresentation };

export type BodyMetricPresentation = {
	metricSlug: MeasurementSlug;
	label: string;
	dimension: MeasurementMetricDefinition["dimension"];
	displayUnit: DisplayUnit | null;
	bodyGroup: BodyMetricGroup;
	manualCapture: ManualMeasurementCapture | null;
	healthImport: boolean;
};

export type BodyGoalProgress = ResolvedGoalProgress;

export type BodyMetricReading = {
	value: number;
	formatted: string;
	observedAt: number;
	localDay: string;
};

export type BodyMetricRange = {
	min: number;
	max: number;
	minFormatted: string;
	maxFormatted: string;
};

/**
 * One measurement read against itself: where it sits now, where it sat last
 * time, and the range it usually occupies. Direction is carried separately from
 * magnitude so no caller has to parse a sign out of formatted copy — and so
 * nothing here can be mistaken for a verdict on which way is better.
 */
export type BodyMetricBaseline = {
	current: BodyMetricReading | null;
	previous: BodyMetricReading | null;
	direction: "up" | "down" | "none";
	/** Null when the change is too small to render at the unit's resolution. */
	changeFormatted: string | null;
	usualRange: BodyMetricRange | null;
	rail: BodyMetricRange | null;
	readingCount: number;
};

export type BodyMetricSummary = BodyMetricPresentation & {
	userEnterable: boolean;
	editablePresentation: MeasurementPresentation | null;
	tracked: boolean;
	visible: boolean;
	hasImportedData: boolean;
	position: number;
	latest: Observation | null;
	latestFormatted: string | null;
	series: TrendSeries;
	baseline: BodyMetricBaseline;
	activeGoal: BodyGoalProgress | null;
};

export type BodyOverview = {
	metrics: BodyMetricSummary[];
	inputLocale: string | undefined;
};

export type BodyMeasurementDraft = {
	metricSlug: string;
	canonicalValue: number;
};

export type BodyHistoryEntry = {
	observation: Observation;
	formattedValue: string;
	selected: boolean;
	editable: boolean;
};

export type BodyMetricDetail = BodyMetricSummary & {
	history: BodyHistoryEntry[];
	goals: BodyGoalProgress[];
	inputLocale: string | undefined;
};

const BODY_TREND_PERIOD = 30;

function measurementDefaults() {
	return [
		...listUserEnterableMeasurements().map((metric) => ({
			metricSlug: metric.slug,
			position: metric.defaultPosition,
			enabled: false,
		})),
		...listImportedOnlyMeasurements().map((metric) => ({
			metricSlug: metric.slug,
			position: metric.defaultPosition,
			enabled: true,
		})),
	];
}

function formatPresentedMeasurement(
	value: number,
	presentation: BodyMetricPresentation,
	locale: string | undefined,
): string {
	const resolved = resolveMetric(presentation.metricSlug);
	if (resolved.kind !== "known" || resolved.metric.kind !== "measurement") {
		throw new TypeError(`Unknown measurement slug: ${presentation.metricSlug}`);
	}
	return formatMetricValue(
		resolved.metric,
		value,
		presentation.displayUnit,
		locale,
		unitWords(),
	);
}

/**
 * Dresses a computed baseline in the user's own units. Formatting happens here
 * rather than in the screen because every number on this screen — reading, band
 * edge, rail end, change — has to agree about locale and display unit.
 */
function presentBaseline(
	baseline: MeasurementBaseline,
	presentation: BodyMetricPresentation,
	locale: string | undefined,
): BodyMetricBaseline {
	const format = (value: number) =>
		formatPresentedMeasurement(value, presentation, locale);
	const asReading = (reading: MeasurementReading | null) =>
		reading ? { ...reading, formatted: format(reading.value) } : null;
	const asRange = (range: MeasurementRange | null) =>
		range
			? {
					...range,
					minFormatted: format(range.min),
					maxFormatted: format(range.max),
				}
			: null;
	const resolved = resolveMetric(presentation.metricSlug);
	if (resolved.kind !== "known" || resolved.metric.kind !== "measurement") {
		throw new TypeError(`Unknown measurement slug: ${presentation.metricSlug}`);
	}
	const changeFormatted =
		baseline.delta === null || baseline.delta === 0
			? null
			: formatMetricDelta(
					resolved.metric,
					Math.abs(baseline.delta),
					presentation.displayUnit,
					locale,
					unitWords(),
				);

	return {
		current: asReading(baseline.current),
		previous: asReading(baseline.previous),
		// A change too small to show at the unit's resolution reads as no change,
		// which is what the user would see on the tape.
		direction:
			baseline.delta === null || baseline.delta === 0 || !changeFormatted
				? "none"
				: baseline.delta > 0
					? "up"
					: "down",
		changeFormatted,
		usualRange: asRange(baseline.usualRange),
		rail: asRange(baseline.rail),
		readingCount: baseline.readingCount,
	};
}

function ascendingObservations(rows: readonly Observation[]): Observation[] {
	return [...rows].sort(
		(left, right) =>
			left.observedAt - right.observedAt ||
			left.createdAt - right.createdAt ||
			left.id.localeCompare(right.id),
	);
}

function latestObservation(rows: readonly Observation[]): Observation | null {
	return ascendingObservations(rows).at(-1) ?? null;
}

function progressFor(
	goal: Goal,
	rows: readonly Observation[],
	presentation: BodyMetricPresentation,
	locale: string | undefined,
): BodyGoalProgress {
	return resolveGoalProgress({
		goal,
		series: ascendingObservations(rows),
		format: (value) => formatPresentedMeasurement(value, presentation, locale),
	});
}

function assertCanonicalValue(
	metric: UserEnterableMeasurementMetricDefinition,
	value: number,
): void {
	if (!Number.isFinite(value) || value < 0) {
		throw new RangeError(i18n.t("validation:body.valueRange"));
	}
	if (metric.dimension === "fraction" && value > 1) {
		throw new RangeError(i18n.t("validation:body.fractionRange"));
	}
}

function resolveMeasurement(
	metricSlug: string,
): UserEnterableMeasurementMetricDefinition {
	const resolved = resolveMetric(metricSlug);
	if (
		resolved.kind !== "known" ||
		resolved.metric.kind !== "measurement" ||
		!resolved.metric.userEnterable
	) {
		throw new TypeError(`Unknown measurement slug: ${metricSlug}`);
	}
	return resolved.metric;
}

function resolveBodyMetric(
	metricSlug: string,
):
	| UserEnterableMeasurementMetricDefinition
	| ImportedOnlyMeasurementMetricDefinition {
	const resolved = resolveMetric(metricSlug);
	if (
		resolved.kind !== "known" ||
		resolved.metric.kind !== "measurement" ||
		!("bodyGroup" in resolved.metric)
	) {
		throw new TypeError(`Unknown body metric slug: ${metricSlug}`);
	}
	return resolved.metric;
}

export class BodyStore {
	private readonly goals: GoalRepository;
	private readonly dailyMetrics: DailyMetricRepository;
	private readonly observations: ObservationRepository;
	private readonly trackedMetrics: TrackedMetricsRepository;
	private readonly unitPreferences: UnitPreferenceRepository;

	constructor(
		private readonly db: SQLiteDatabase,
		private readonly now: () => Date = () => new Date(),
		private readonly locale: () => string | undefined = systemLocale,
	) {
		this.goals = new GoalRepository(db);
		this.dailyMetrics = new DailyMetricRepository(db);
		this.observations = new ObservationRepository(db);
		this.trackedMetrics = new TrackedMetricsRepository(db);
		this.unitPreferences = new UnitPreferenceRepository(db);
	}

	async loadOverview(): Promise<BodyOverview> {
		return { metrics: await this.loadSummaries(), inputLocale: this.locale() };
	}

	async loadMetric(metricSlug: string): Promise<BodyMetricDetail | null> {
		const locale = this.locale();
		const metric = resolveMetric(metricSlug);
		if (metric.kind !== "known" || metric.metric.kind !== "measurement") {
			return null;
		}
		const summaries = await this.loadSummaries();
		const summary = summaries.find(
			(candidate) => candidate.metricSlug === metricSlug,
		);
		if (!summary) {
			return null;
		}
		const [observations, dailyMetrics, goals] = await Promise.all([
			this.observations.listAll(),
			this.dailyMetrics.listAll(),
			this.goals.listAll(),
		]);
		const metricRows = observations.filter(
			(row) => row.metricSlug === metricSlug,
		);
		const importedRows = dailyMetrics.filter(
			(row) => row.metricSlug === metricSlug,
		);
		const resolvedRows = isHealthMetricSlug(metricSlug)
			? resolveMetricObservations(metricSlug, metricRows, importedRows)
			: metricRows;
		const selectedIds = new Set(resolvedRows.map((row) => row.id));
		return {
			...summary,
			history: ascendingObservations([
				...metricRows,
				...importedRows.map(importedDailyMetricAsObservation),
			])
				.reverse()
				.map((observation) => ({
					observation,
					selected: selectedIds.has(observation.id),
					editable: observation.source === "user",
					formattedValue: formatPresentedMeasurement(
						observation.value,
						summary,
						locale,
					),
				})),
			goals: goals
				.filter((goal) => goal.metricSlug === metricSlug)
				.map((goal) => progressFor(goal, resolvedRows, summary, locale)),
			inputLocale: locale,
		};
	}

	async setTracked(
		metricSlug: string,
		enabled: boolean,
	): Promise<BodyOverview> {
		const metric = resolveBodyMetric(metricSlug);
		const overlays = await this.trackedMetrics.listResolved(
			measurementDefaults(),
		);
		const current = overlays.find((row) => row.metricSlug === metric.slug);
		await this.trackedMetrics.configureMany([
			{
				metricSlug: metric.slug,
				position: current?.position ?? metric.defaultPosition,
				enabled,
			},
		]);
		return await this.loadOverview();
	}

	/**
	 * Records a value the user typed for today. Only a tracked measurement can
	 * be logged: an untracked one has no entry field, so a write for it means
	 * the caller is working from a stale overview.
	 */
	async recordMeasurement(
		metricSlug: string,
		canonicalValue: number,
	): Promise<BodyOverview> {
		return await this.recordMeasurements([{ metricSlug, canonicalValue }]);
	}

	/** Saves every non-blank field from one measuring session atomically. */
	async recordMeasurements(
		drafts: readonly BodyMeasurementDraft[],
	): Promise<BodyOverview> {
		if (drafts.length === 0) return await this.loadOverview();
		const seen = new Set<string>();
		const resolved = drafts.map((draft) => {
			if (seen.has(draft.metricSlug)) {
				throw new TypeError(
					`Measurement repeated in session: ${draft.metricSlug}`,
				);
			}
			seen.add(draft.metricSlug);
			const metric = resolveMeasurement(draft.metricSlug);
			assertCanonicalValue(metric, draft.canonicalValue);
			return { ...draft, metric };
		});
		const overlays = await this.trackedMetrics.listResolved(
			measurementDefaults(),
		);
		const enabled = new Set(
			overlays.filter((row) => row.enabled).map((row) => row.metricSlug),
		);
		for (const { metric } of resolved) {
			if (!enabled.has(metric.slug)) {
				throw new TypeError(`Measurement is not tracked: ${metric.slug}`);
			}
		}
		const capturedAt = this.now();
		const observedAt = capturedAt.getTime();
		const localDay = localDayOf(capturedAt);
		const tzOffsetMinutes = capturedAt.getTimezoneOffset();
		await this.db.withTransactionAsync(async () => {
			for (const { metric, canonicalValue } of resolved) {
				await this.observations.create({
					metricSlug: metric.slug,
					value: canonicalValue,
					scaleMin: null,
					scaleMax: null,
					observedAt,
					localDay,
					tzOffsetMinutes,
					source: "user",
					sourceRecordId: null,
					assessmentId: null,
				});
			}
		});
		return await this.loadOverview();
	}

	async updateMeasurement(
		id: string,
		canonicalValue: number,
	): Promise<BodyMetricDetail | null> {
		const observation = await this.observations.findById(id);
		if (!observation) {
			throw new TypeError(i18n.t("validation:body.observationNotFound"));
		}
		const metric = resolveMeasurement(observation.metricSlug);
		assertCanonicalValue(metric, canonicalValue);
		await this.observations.update(observation.id, {
			value: canonicalValue,
			scaleMin: observation.scaleMin,
			scaleMax: observation.scaleMax,
			observedAt: observation.observedAt,
			localDay: observation.localDay,
			tzOffsetMinutes: observation.tzOffsetMinutes,
		});
		return await this.loadMetric(metric.slug);
	}

	async deleteMeasurement(id: string): Promise<BodyMetricDetail | null> {
		const observation = await this.observations.findById(id);
		if (!observation) {
			throw new TypeError(i18n.t("validation:body.observationNotFound"));
		}
		const metric = resolveMeasurement(observation.metricSlug);
		await this.observations.delete(observation.id);
		return await this.loadMetric(metric.slug);
	}

	async createGoal(
		metricSlug: string,
		targetValue: number,
		targetDate: string | null,
	): Promise<Goal> {
		const metric = resolveMeasurement(metricSlug);
		assertCanonicalValue(metric, targetValue);
		const [observations, dailyMetrics, goals] = await Promise.all([
			this.observations.listAll(),
			this.dailyMetrics.listAll(),
			this.goals.listAll(),
		]);
		const metricRows = observations.filter(
			(row) => row.metricSlug === metric.slug,
		);
		const latest = latestObservation(
			isHealthMetricSlug(metric.slug)
				? resolveMetricObservations(
						metric.slug,
						metricRows,
						dailyMetrics.filter((row) => row.metricSlug === metric.slug),
					)
				: metricRows,
		);
		if (!latest) {
			throw new TypeError(i18n.t("validation:body.logBeforeGoal"));
		}
		if (targetValue === latest.value) {
			throw new RangeError(i18n.t("validation:body.targetSameAsLatest"));
		}
		if (
			goals.some(
				(goal) =>
					goal.metricSlug === metric.slug && goalStatus(goal) === "active",
			)
		) {
			throw new TypeError(i18n.t("validation:body.activeGoalExists"));
		}
		return await this.goals.create({
			metricSlug: metric.slug,
			direction: targetValue > latest.value ? "increase" : "decrease",
			targetValue,
			targetDate,
			startedAt: this.now().getTime(),
		});
	}

	async achieveGoal(id: string): Promise<Goal | null> {
		return await this.goals.achieve(id);
	}

	async abandonGoal(id: string): Promise<Goal | null> {
		return await this.goals.abandon(id);
	}

	private async loadSummaries(): Promise<BodyMetricSummary[]> {
		const inputLocale = this.locale();
		const [overlays, preferences, observations, dailyMetrics, goals] =
			await Promise.all([
				this.trackedMetrics.listResolved(measurementDefaults()),
				this.unitPreferences.resolveLatestPerDimension(),
				this.observations.listAll(),
				this.dailyMetrics.listAll(),
				this.goals.listAll(),
			]);
		const preferenceByDimension = new Map(
			preferences.map((preference) => [preference.dimension, preference.unit]),
		);
		const overlayBySlug = new Map(
			overlays.map((overlay) => [overlay.metricSlug, overlay]),
		);
		const throughLocalDay = localDayOf(this.now());

		const metrics = [
			...listUserEnterableMeasurements(),
			...listImportedOnlyMeasurements(),
		];

		return metrics
			.map((metric) => {
				const overlay = overlayBySlug.get(metric.slug);
				const displayUnit = metricDisplayUnit(
					metric,
					preferenceByDimension,
					inputLocale,
				);
				const editablePresentation = metric.userEnterable
					? toMeasurementPresentation(
							metric.slug,
							overlay?.customLabel ?? metric.label,
							metric.dimension,
							displayUnit,
						)
					: null;
				const presentation: BodyMetricPresentation = {
					metricSlug: metric.slug,
					label: overlay?.customLabel ?? metric.label,
					dimension: metric.dimension,
					displayUnit,
					bodyGroup: metric.bodyGroup,
					manualCapture:
						"manualCapture" in metric ? metric.manualCapture : null,
					healthImport: metric.healthImport,
				};
				const metricRows = observations.filter(
					(row) => row.metricSlug === metric.slug,
				);
				const importedRows = dailyMetrics.filter(
					(row) => row.metricSlug === metric.slug,
				);
				const resolvedRows = isHealthMetricSlug(metric.slug)
					? resolveMetricObservations(metric.slug, metricRows, importedRows)
					: metricRows;
				const latest = latestObservation(resolvedRows);
				const metricGoals = goals
					.filter((goal) => goal.metricSlug === metric.slug)
					.map((goal) =>
						progressFor(goal, resolvedRows, presentation, inputLocale),
					);
				const activeGoal =
					metricGoals.find((progress) => progress.status === "active") ?? null;
				const tracked = overlay?.enabled ?? false;
				const hasImportedData = importedRows.length > 0;
				const resolvedBaseline = resolveMeasurementBaseline(
					resolvedRows,
					throughLocalDay,
				);
				return {
					...presentation,
					userEnterable: metric.userEnterable,
					editablePresentation,
					tracked,
					visible: metric.userEnterable ? tracked || hasImportedData : tracked,
					hasImportedData,
					position: overlay?.position ?? metric.defaultPosition,
					latest,
					latestFormatted: latest
						? formatPresentedMeasurement(
								latest.value,
								presentation,
								inputLocale,
							)
						: null,
					series: buildTrendSeries(
						resolvedRows,
						metric,
						throughLocalDay,
						BODY_TREND_PERIOD,
						{
							usualRange: resolvedBaseline.usualRange,
							heading: activeGoal?.goal.targetValue,
						},
					),
					baseline: presentBaseline(
						resolvedBaseline,
						presentation,
						inputLocale,
					),
					activeGoal,
				};
			})
			.sort(
				(left, right) =>
					left.position - right.position ||
					left.metricSlug.localeCompare(right.metricSlug),
			);
	}
}

export function createBodyStore(): BodyStore {
	return new BodyStore(getDb());
}
