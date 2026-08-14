import {
	getDb,
	ObservationRepository,
} from "@bro/database-app";
import type { SQLiteDatabase } from "expo-sqlite";
import {
	listScoredMetrics,
	type ScoredMetricDefinition,
} from "../content/metric-registry";
import { localDayOf } from "../check-in/check-in-store";
import {
	buildTrendSeries,
	trendRange,
	type TrendPeriod,
	type TrendSeries,
} from "./trend-math";

export type MetricTrend = {
	metric: ScoredMetricDefinition;
	series: TrendSeries;
};

export type TrendsSnapshot = {
	period: TrendPeriod;
	fromLocalDay: string;
	throughLocalDay: string;
	metrics: MetricTrend[];
};

export class TrendsStore {
	private readonly observations: ObservationRepository;

	constructor(
		db: SQLiteDatabase,
		private readonly now: () => Date = () => new Date(),
	) {
		this.observations = new ObservationRepository(db);
	}

	async load(period: TrendPeriod): Promise<TrendsSnapshot> {
		const throughLocalDay = localDayOf(this.now());
		const range = trendRange(throughLocalDay, period);
		const metrics = listScoredMetrics();
		const rows = await Promise.all(
			metrics.map((metric) =>
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
			metrics: metrics.map((metric, index) => ({
				metric,
				series: buildTrendSeries(
					rows[index] ?? [],
					metric,
					throughLocalDay,
					period,
				),
			})),
		};
	}
}

export function createTrendsStore(): TrendsStore {
	return new TrendsStore(getDb());
}
