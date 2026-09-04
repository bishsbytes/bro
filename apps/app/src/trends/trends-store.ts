import {
	DailyMetricRepository,
	getDb,
	IntakeEventRepository,
	ObservationRepository,
	TrackedMetricsRepository,
	UnitPreferenceRepository,
} from "@bro/database-app";
import { type DisplayUnit, localDayOf, shiftLocalDay } from "@bro/domain";
import {
	DEFAULT_TRACKED_METRICS,
	type MeasurementMetricDefinition,
	type ScoredMetricDefinition,
} from "@bro/domain/metric-registry";
import {
	buildTrendSeries,
	formatMetricValue,
	MEASUREMENT_BASELINE_WINDOW_DAYS,
	metricDisplayUnit,
	resolveMeasurementBaseline,
	resolveMetricObservations,
	type TrendPeriod,
	type TrendSeries,
	trendRange,
} from "@bro/logic";
import type { SQLiteDatabase } from "expo-sqlite";
import { listMeasurements, listScoredMetrics } from "../content";
import { unitWords } from "../units/unit-words";

export type MetricTrend = {
	metric: ScoredMetricDefinition | MeasurementMetricDefinition;
	label: string;
	series: TrendSeries;
	displayUnit: DisplayUnit | null;
	latestFormatted: string | null;
	usualRange: {
		min: number;
		max: number;
		minFormatted: string;
		maxFormatted: string;
	} | null;
};

export type TrendsSnapshot = {
	period: TrendPeriod;
	fromLocalDay: string;
	throughLocalDay: string;
	metrics: MetricTrend[];
};

export class TrendsStore {
	private readonly observations: ObservationRepository;
	private readonly dailyMetrics: DailyMetricRepository;
	private readonly intakeEvents: IntakeEventRepository;
	private readonly trackedMetrics: TrackedMetricsRepository;
	private readonly unitPreferences: UnitPreferenceRepository;

	constructor(
		db: SQLiteDatabase,
		private readonly now: () => Date = () => new Date(),
		private readonly locale: () => string | undefined = () => {
			try {
				return Intl.DateTimeFormat().resolvedOptions().locale;
			} catch {
				return undefined;
			}
		},
	) {
		this.observations = new ObservationRepository(db);
		this.dailyMetrics = new DailyMetricRepository(db);
		this.intakeEvents = new IntakeEventRepository(db);
		this.trackedMetrics = new TrackedMetricsRepository(db);
		this.unitPreferences = new UnitPreferenceRepository(db);
	}

	async load(period: TrendPeriod): Promise<TrendsSnapshot> {
		const locale = this.locale();
		const throughLocalDay = localDayOf(this.now());
		const range = trendRange(throughLocalDay, period);
		const baselineFromLocalDay = shiftLocalDay(
			throughLocalDay,
			-(MEASUREMENT_BASELINE_WINDOW_DAYS - 1),
		);
		const measurementSlugs = new Set<string>(
			listMeasurements().map((metric) => metric.slug),
		);
		const trackedDefaults = DEFAULT_TRACKED_METRICS.filter(
			(metric) =>
				measurementSlugs.has(metric.metricSlug) ||
				listScoredMetrics().some((scored) => scored.slug === metric.metricSlug),
		);
		const [overlays, preferences, dailyMetrics, intakeEvents] =
			await Promise.all([
				this.trackedMetrics.listResolved(trackedDefaults),
				this.unitPreferences.resolveLatestPerDimension(),
				this.dailyMetrics.listAll(),
				this.intakeEvents.listBetween(
					baselineFromLocalDay,
					range.throughLocalDay,
				),
			]);
		const overlayBySlug = new Map(
			overlays.map((overlay) => [overlay.metricSlug, overlay]),
		);
		const preferenceByDimension = new Map(
			preferences.map((preference) => [preference.dimension, preference.unit]),
		);
		const importedSlugs = new Set(dailyMetrics.map((row) => row.metricSlug));
		const metrics: Array<{
			metric: ScoredMetricDefinition | MeasurementMetricDefinition;
			label: string;
			displayUnit: DisplayUnit | null;
		}> = [
			...listScoredMetrics().flatMap((metric) =>
				overlayBySlug.get(metric.slug)?.enabled
					? [{ metric, label: metric.label, displayUnit: null }]
					: [],
			),
			...listMeasurements().flatMap((metric) => {
				const overlay = overlayBySlug.get(metric.slug);
				return overlay?.enabled || importedSlugs.has(metric.slug)
					? [
							{
								metric,
								label: overlay?.customLabel ?? metric.label,
								displayUnit: metricDisplayUnit(
									metric,
									preferenceByDimension,
									this.locale(),
								),
							},
						]
					: [];
			}),
		];
		const rows = await Promise.all(
			metrics.map(({ metric }) =>
				this.observations.listByMetricAndDayRange(
					metric.slug,
					baselineFromLocalDay,
					range.throughLocalDay,
				),
			),
		);

		return {
			period,
			...range,
			metrics: metrics.map(({ metric, label, displayUnit }, index) => {
				const metricRows = rows[index] ?? [];
				const resolvedRows =
					metric.kind === "measurement"
						? resolveMetricObservations(
								metric.slug,
								metricRows,
								dailyMetrics,
								intakeEvents,
							)
						: metricRows;
				const baseline =
					metric.kind === "measurement"
						? resolveMeasurementBaseline(resolvedRows, throughLocalDay)
						: null;
				const series = buildTrendSeries(
					resolvedRows,
					metric,
					throughLocalDay,
					period,
					baseline?.usualRange,
				);
				const latestValue = [...series.points]
					.reverse()
					.find((point) => point.value !== null)?.value;
				let latestFormatted: string | null = null;
				if (
					metric.kind === "measurement" &&
					latestValue !== null &&
					latestValue !== undefined
				) {
					latestFormatted = formatMetricValue(
						metric,
						latestValue,
						displayUnit,
						locale,
						unitWords(),
					);
				}
				const usualRange =
					metric.kind === "measurement" && baseline?.usualRange
						? {
								...baseline.usualRange,
								minFormatted: formatMetricValue(
									metric,
									baseline.usualRange.min,
									displayUnit,
									locale,
									unitWords(),
								),
								maxFormatted: formatMetricValue(
									metric,
									baseline.usualRange.max,
									displayUnit,
									locale,
									unitWords(),
								),
							}
						: null;
				return {
					metric,
					label,
					series,
					displayUnit,
					latestFormatted,
					usualRange,
				};
			}),
		};
	}
}

export function createTrendsStore(): TrendsStore {
	return new TrendsStore(getDb());
}
