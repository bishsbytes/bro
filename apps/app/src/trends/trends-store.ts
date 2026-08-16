import {
	getDb,
	ObservationRepository,
	TrackedMetricsRepository,
	UnitPreferenceRepository,
} from "@bro/database-app";
import type { SQLiteDatabase } from "expo-sqlite";
import {
	listMeasurements,
	listScoredMetrics,
	type MeasurementMetricDefinition,
	type ScoredMetricDefinition,
} from "../content/metric-registry";
import { localDayOf } from "../check-in/check-in-store";
import {
	type DisplayUnit,
	formatMeasurement,
	isDisplayUnitForDimension,
	resolveDisplayUnit,
} from "../units";
import {
	buildTrendSeries,
	trendRange,
	type TrendPeriod,
	type TrendSeries,
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
		this.trackedMetrics = new TrackedMetricsRepository(db);
		this.unitPreferences = new UnitPreferenceRepository(db);
	}

	async load(period: TrendPeriod): Promise<TrendsSnapshot> {
		const throughLocalDay = localDayOf(this.now());
		const range = trendRange(throughLocalDay, period);
		const measurementDefaults = listMeasurements().map((metric) => ({
			metricSlug: metric.slug,
			position: metric.defaultPosition,
			enabled: false,
		}));
		const [overlays, preferences] = await Promise.all([
			this.trackedMetrics.listResolved(measurementDefaults),
			this.unitPreferences.resolveLatestPerDimension(),
		]);
		const overlayBySlug = new Map(
			overlays.map((overlay) => [overlay.metricSlug, overlay]),
		);
		const preferenceByDimension = new Map(
			preferences.map((preference) => [preference.dimension, preference.unit]),
		);
		const metrics = [
			...listScoredMetrics().map((metric) => ({
				metric,
				label: metric.label,
				displayUnit: null,
			})),
			...listMeasurements().flatMap((metric) => {
				const overlay = overlayBySlug.get(metric.slug);
				return overlay?.enabled
					? [
							{
								metric,
								label: overlay.customLabel ?? metric.label,
								displayUnit: resolveDisplayUnit(
									metric.dimension,
									preferenceByDimension.get(metric.dimension),
									this.locale(),
								) as DisplayUnit,
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
				const series = buildTrendSeries(
					rows[index] ?? [],
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
					displayUnit !== null &&
					latestValue !== null &&
					latestValue !== undefined &&
					isDisplayUnitForDimension(metric.dimension, displayUnit)
				) {
					latestFormatted = formatMeasurement(
						latestValue,
						metric.dimension,
						displayUnit,
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
