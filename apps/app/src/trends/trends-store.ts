import {
	ConsumptionEntryRepository,
	DailyMetricRepository,
	getDb,
	ObservationRepository,
	TrackedMetricsRepository,
	UnitPreferenceRepository,
} from "@bro/database-app";
import { type DisplayUnit, localDayOf } from "@bro/domain";
import {
	DEFAULT_TRACKED_METRICS,
	type MeasurementMetricDefinition,
	type ScoredMetricDefinition,
} from "@bro/domain/metric-registry";
import {
	buildTrendSeries,
	formatMetricValue,
	metricDisplayUnit,
	resolveMetricObservations,
	type TrendPeriod,
	type TrendSeries,
	trendRange,
} from "@bro/logic";
import type { SQLiteDatabase } from "expo-sqlite";
import { listMeasurements, listScoredMetrics } from "../content";

export type MetricTrend = {
	metric: ScoredMetricDefinition | MeasurementMetricDefinition;
	label: string;
	series: TrendSeries;
	displayUnit: DisplayUnit | null;
	latestFormatted: string | null;
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
	private readonly consumptionEntries: ConsumptionEntryRepository;
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
		this.consumptionEntries = new ConsumptionEntryRepository(db);
		this.trackedMetrics = new TrackedMetricsRepository(db);
		this.unitPreferences = new UnitPreferenceRepository(db);
	}

	async load(period: TrendPeriod): Promise<TrendsSnapshot> {
		const locale = this.locale();
		const throughLocalDay = localDayOf(this.now());
		const range = trendRange(throughLocalDay, period);
		const measurementSlugs = new Set<string>(
			listMeasurements().map((metric) => metric.slug),
		);
		const trackedDefaults = DEFAULT_TRACKED_METRICS.filter(
			(metric) =>
				measurementSlugs.has(metric.metricSlug) ||
				listScoredMetrics().some((scored) => scored.slug === metric.metricSlug),
		);
		const [overlays, preferences, dailyMetrics, consumptionEntries] =
			await Promise.all([
				this.trackedMetrics.listResolved(trackedDefaults),
				this.unitPreferences.resolveLatestPerDimension(),
				this.dailyMetrics.listAll(),
				this.consumptionEntries.listAll(),
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
					range.fromLocalDay,
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
								consumptionEntries,
							)
						: metricRows;
				const series = buildTrendSeries(
					resolvedRows,
					metric,
					throughLocalDay,
					period,
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
					);
				}
				return { metric, label, series, displayUnit, latestFormatted };
			}),
		};
	}
}

export function createTrendsStore(): TrendsStore {
	return new TrendsStore(getDb());
}
