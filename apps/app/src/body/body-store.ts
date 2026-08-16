import {
	type Goal,
	GoalRepository,
	getDb,
	type Observation,
	ObservationRepository,
	TrackedMetricsRepository,
	UnitPreferenceRepository,
} from "@bro/database-app";
import type { SQLiteDatabase } from "expo-sqlite";
import { localDayOf } from "../check-in/check-in-store";
import {
	listUserEnterableMeasurements,
	resolveMetric,
	type UserEnterableMeasurementMetricDefinition,
	type UserEnterableMeasurementSlug,
} from "../content/metric-registry";
import {
	type GoalStatus,
	goalProgressPercent,
	goalStatus,
} from "../goals/goal-progress";
import { buildTrendSeries, type TrendSeries } from "../trends/trend-math";
import {
	type DisplayUnit,
	formatMeasurement,
	isDisplayUnitForDimension,
	resolveDisplayUnit,
} from "../units";

type MeasurementPresentationBase = {
	metricSlug: UserEnterableMeasurementSlug;
	label: string;
};

export type MeasurementPresentation =
	| (MeasurementPresentationBase & {
			dimension: "mass";
			displayUnit: "kg" | "lb" | "st";
	  })
	| (MeasurementPresentationBase & {
			dimension: "length";
			displayUnit: "cm" | "in";
	  })
	| (MeasurementPresentationBase & {
			dimension: "fraction";
			displayUnit: "%";
	  });

export type BodyGoalProgress = {
	goal: Goal;
	status: GoalStatus;
	startValue: number | null;
	currentValue: number | null;
	progressPercent: number | null;
	targetFormatted: string;
	startFormatted: string | null;
	currentFormatted: string | null;
};

export type BodyMetricSummary = MeasurementPresentation & {
	tracked: boolean;
	position: number;
	latest: Observation | null;
	latestFormatted: string | null;
	series: TrendSeries;
	activeGoal: BodyGoalProgress | null;
};

export type BodyOverview = {
	metrics: BodyMetricSummary[];
};

export type BodyHistoryEntry = {
	observation: Observation;
	formattedValue: string;
};

export type BodyMetricDetail = BodyMetricSummary & {
	history: BodyHistoryEntry[];
	goals: BodyGoalProgress[];
	inputLocale: string | undefined;
};

const BODY_TREND_PERIOD = 30;

function systemLocale(): string | undefined {
	try {
		return Intl.DateTimeFormat().resolvedOptions().locale;
	} catch {
		return undefined;
	}
}

function measurementDefaults() {
	return listUserEnterableMeasurements().map((metric) => ({
		metricSlug: metric.slug,
		position: metric.defaultPosition,
		enabled: false,
	}));
}

function toPresentation(
	metric: UserEnterableMeasurementMetricDefinition,
	label: string,
	displayUnit: DisplayUnit,
): MeasurementPresentation {
	if (
		metric.dimension === "mass" &&
		isDisplayUnitForDimension(metric.dimension, displayUnit)
	) {
		return {
			metricSlug: metric.slug,
			label,
			dimension: metric.dimension,
			displayUnit,
		};
	}
	if (
		metric.dimension === "length" &&
		isDisplayUnitForDimension(metric.dimension, displayUnit)
	) {
		return {
			metricSlug: metric.slug,
			label,
			dimension: metric.dimension,
			displayUnit,
		};
	}
	if (
		metric.dimension === "fraction" &&
		isDisplayUnitForDimension(metric.dimension, displayUnit)
	) {
		return {
			metricSlug: metric.slug,
			label,
			dimension: metric.dimension,
			displayUnit,
		};
	}
	throw new TypeError(
		`Unit ${displayUnit} does not measure ${metric.dimension}.`,
	);
}

export function formatPresentedMeasurement(
	value: number,
	presentation: MeasurementPresentation,
): string {
	return formatMeasurement(
		value,
		presentation.dimension,
		presentation.displayUnit,
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
	presentation: MeasurementPresentation,
): BodyGoalProgress {
	const ordered = ascendingObservations(rows);
	const startValue =
		ordered
			.filter((observation) => observation.observedAt <= goal.startedAt)
			.at(-1)?.value ?? null;
	const currentValue = ordered.at(-1)?.value ?? null;
	return {
		goal,
		status: goalStatus(goal),
		startValue,
		currentValue,
		progressPercent: goalProgressPercent(goal, startValue, currentValue),
		targetFormatted: formatPresentedMeasurement(goal.targetValue, presentation),
		startFormatted:
			startValue === null
				? null
				: formatPresentedMeasurement(startValue, presentation),
		currentFormatted:
			currentValue === null
				? null
				: formatPresentedMeasurement(currentValue, presentation),
	};
}

function assertCanonicalValue(
	metric: UserEnterableMeasurementMetricDefinition,
	value: number,
): void {
	if (!Number.isFinite(value) || value < 0) {
		throw new RangeError("Measurement values must be finite and non-negative.");
	}
	if (metric.dimension === "fraction" && value > 1) {
		throw new RangeError("Fraction measurements must be between zero and one.");
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
	private readonly observations: ObservationRepository;
	private readonly trackedMetrics: TrackedMetricsRepository;
	private readonly unitPreferences: UnitPreferenceRepository;

	constructor(
		db: SQLiteDatabase,
		private readonly now: () => Date = () => new Date(),
		private readonly locale: () => string | undefined = systemLocale,
	) {
		this.goals = new GoalRepository(db);
		this.observations = new ObservationRepository(db);
		this.trackedMetrics = new TrackedMetricsRepository(db);
		this.unitPreferences = new UnitPreferenceRepository(db);
	}

	async loadOverview(): Promise<BodyOverview> {
		return { metrics: await this.loadSummaries() };
	}

	async loadMetric(metricSlug: string): Promise<BodyMetricDetail | null> {
		const metric = resolveMetric(metricSlug);
		if (
			metric.kind !== "known" ||
			metric.metric.kind !== "measurement" ||
			!metric.metric.userEnterable
		) {
			return null;
		}
		const summaries = await this.loadSummaries();
		const summary = summaries.find(
			(candidate) => candidate.metricSlug === metricSlug,
		);
		if (!summary) {
			return null;
		}
		const [observations, goals] = await Promise.all([
			this.observations.listAll(),
			this.goals.listAll(),
		]);
		const metricRows = observations.filter(
			(row) => row.metricSlug === metricSlug,
		);
		return {
			...summary,
			history: ascendingObservations(metricRows)
				.reverse()
				.map((observation) => ({
					observation,
					formattedValue: formatPresentedMeasurement(
						observation.value,
						summary,
					),
				})),
			goals: goals
				.filter((goal) => goal.metricSlug === metricSlug)
				.map((goal) => progressFor(goal, metricRows, summary)),
			inputLocale: this.locale(),
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

	async updateMeasurement(
		id: string,
		canonicalValue: number,
	): Promise<BodyMetricDetail | null> {
		const observation = await this.observations.findById(id);
		if (!observation) {
			throw new TypeError("Measurement observation not found.");
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
			throw new TypeError("Measurement observation not found.");
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
		const [observations, goals] = await Promise.all([
			this.observations.listAll(),
			this.goals.listAll(),
		]);
		const latest = latestObservation(
			observations.filter((row) => row.metricSlug === metric.slug),
		);
		if (!latest) {
			throw new TypeError("Log a measurement before setting a goal.");
		}
		if (targetValue === latest.value) {
			throw new RangeError(
				"Choose a target different from your latest measurement.",
			);
		}
		if (
			goals.some(
				(goal) =>
					goal.metricSlug === metric.slug && goalStatus(goal) === "active",
			)
		) {
			throw new TypeError("Finish the active goal before creating another.");
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
		const [overlays, preferences, observations, goals] = await Promise.all([
			this.trackedMetrics.listResolved(measurementDefaults()),
			this.unitPreferences.resolveLatestPerDimension(),
			this.observations.listAll(),
			this.goals.listAll(),
		]);
		const preferenceByDimension = new Map(
			preferences.map((preference) => [preference.dimension, preference.unit]),
		);
		const overlayBySlug = new Map(
			overlays.map((overlay) => [overlay.metricSlug, overlay]),
		);
		const throughLocalDay = localDayOf(this.now());

		return listUserEnterableMeasurements()
			.map((metric) => {
				const overlay = overlayBySlug.get(metric.slug);
				const presentation = toPresentation(
					metric,
					overlay?.customLabel ?? metric.label,
					resolveDisplayUnit(
						metric.dimension,
						preferenceByDimension.get(metric.dimension),
						inputLocale,
					),
				);
				const metricRows = observations.filter(
					(row) => row.metricSlug === metric.slug,
				);
				const latest = latestObservation(metricRows);
				const metricGoals = goals
					.filter((goal) => goal.metricSlug === metric.slug)
					.map((goal) => progressFor(goal, metricRows, presentation));
				return {
					...presentation,
					tracked: overlay?.enabled ?? false,
					position: overlay?.position ?? metric.defaultPosition,
					latest,
					latestFormatted: latest
						? formatPresentedMeasurement(latest.value, presentation)
						: null,
					series: buildTrendSeries(
						metricRows,
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
