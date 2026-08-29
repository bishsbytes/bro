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
	listUserEnterableMeasurements,
	type MeasurementMetricDefinition,
	type MeasurementSlug,
	type UserEnterableMeasurementMetricDefinition,
} from "@bro/domain/metric-registry";
import {
	buildTrendSeries,
	formatMetricValue,
	goalStatus,
	importedDailyMetricAsObservation,
	isHealthMetricSlug,
	type MeasurementPresentation,
	metricDisplayUnit,
	type ResolvedGoalProgress,
	resolveGoalProgress,
	resolveMetricObservations,
	type TrendSeries,
	toMeasurementPresentation,
} from "@bro/logic";
import type { SQLiteDatabase } from "expo-sqlite";
import { resolveMetric } from "../content";
import { i18n } from "../i18n";

export type { MeasurementPresentation };

export type BodyMetricPresentation = {
	metricSlug: MeasurementSlug;
	label: string;
	dimension: MeasurementMetricDefinition["dimension"];
	displayUnit: DisplayUnit | null;
};

export type BodyGoalProgress = ResolvedGoalProgress;

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
	activeGoal: BodyGoalProgress | null;
};

export type BodyOverview = {
	metrics: BodyMetricSummary[];
	inputLocale: string | undefined;
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
	return listUserEnterableMeasurements().map((metric) => ({
		metricSlug: metric.slug,
		position: metric.defaultPosition,
		enabled: false,
	}));
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
	);
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

export class BodyStore {
	private readonly goals: GoalRepository;
	private readonly dailyMetrics: DailyMetricRepository;
	private readonly observations: ObservationRepository;
	private readonly trackedMetrics: TrackedMetricsRepository;
	private readonly unitPreferences: UnitPreferenceRepository;

	constructor(
		db: SQLiteDatabase,
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
		const metric = resolveMeasurement(metricSlug);
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
		const metric = resolveMeasurement(metricSlug);
		assertCanonicalValue(metric, canonicalValue);
		const overlays = await this.trackedMetrics.listResolved(
			measurementDefaults(),
		);
		const tracked = overlays.find((row) => row.metricSlug === metric.slug);
		if (!tracked?.enabled) {
			throw new TypeError(`Measurement is not tracked: ${metric.slug}`);
		}
		const capturedAt = this.now();
		await this.observations.create({
			metricSlug: metric.slug,
			value: canonicalValue,
			scaleMin: null,
			scaleMax: null,
			observedAt: capturedAt.getTime(),
			localDay: localDayOf(capturedAt),
			tzOffsetMinutes: capturedAt.getTimezoneOffset(),
			source: "user",
			sourceRecordId: null,
			assessmentId: null,
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

		const importedSlugs = new Set(dailyMetrics.map((row) => row.metricSlug));
		const restingHeartRate = resolveMetric("resting_heart_rate");
		const metrics: MeasurementMetricDefinition[] = [
			...listUserEnterableMeasurements(),
			...(restingHeartRate.kind === "known" &&
			restingHeartRate.metric.kind === "measurement" &&
			importedSlugs.has(restingHeartRate.metric.slug)
				? [restingHeartRate.metric]
				: []),
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
							displayUnit as DisplayUnit,
						)
					: null;
				const presentation: BodyMetricPresentation = {
					metricSlug: metric.slug,
					label: overlay?.customLabel ?? metric.label,
					dimension: metric.dimension,
					displayUnit,
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
				const tracked = overlay?.enabled ?? false;
				const hasImportedData = importedRows.length > 0;
				return {
					...presentation,
					userEnterable: metric.userEnterable,
					editablePresentation,
					tracked,
					visible: tracked || hasImportedData || !metric.userEnterable,
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
					),
					activeGoal:
						metricGoals.find((progress) => progress.status === "active") ??
						null,
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
