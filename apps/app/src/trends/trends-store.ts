import {
	DailyMetricRepository,
	getDb,
	ObservationRepository,
	TrackedMetricsRepository,
	UnitPreferenceRepository,
} from "@bro/database-app";
import type { SQLiteDatabase } from "expo-sqlite";
import { localDayOf } from "../check-in/check-in-store";
import {
	listScoredMetrics,
	listMeasurements,
	listUserEnterableMeasurements,
	type MeasurementMetricDefinition,
	type ScoredMetricDefinition,
} from "../content/metric-registry";
import {
	formatMetricValue,
	metricDisplayUnit,
} from "../health/metric-presentation";
import { isHealthMetricSlug } from "../health/policy";
import { resolveMetricObservations } from "../health/resolved-series";
import type { DisplayUnit } from "../units";
import {
	buildTrendSeries,
	type TrendPeriod,
	type TrendSeries,
	trendRange,
} from "./trend-math";

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
		this.trackedMetrics = new TrackedMetricsRepository(db);
		this.unitPreferences = new UnitPreferenceRepository(db);
	}

	async load(period: TrendPeriod): Promise<TrendsSnapshot> {
		const throughLocalDay = localDayOf(this.now());
		const range = trendRange(throughLocalDay, period);
		const measurementDefaults = listUserEnterableMeasurements().map(
			(metric) => ({
				metricSlug: metric.slug,
				position: metric.defaultPosition,
				enabled: false,
			}),
		);
		const [overlays, preferences, dailyMetrics] = await Promise.all([
			this.trackedMetrics.listResolved(measurementDefaults),
			this.unitPreferences.resolveLatestPerDimension(),
			this.dailyMetrics.listAll(),
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
			...listScoredMetrics().map((metric) => ({
				metric,
				label: metric.label,
				displayUnit: null,
			})),
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
					metric.kind === "measurement" && isHealthMetricSlug(metric.slug)
						? resolveMetricObservations(metric.slug, metricRows, dailyMetrics)
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
					latestFormatted = formatMetricValue(metric, latestValue, displayUnit);
				}
				return { metric, label, series, displayUnit, latestFormatted };
			}),
		};
	}
}

export function createTrendsStore(): TrendsStore {
	return new TrendsStore(getDb());
}
