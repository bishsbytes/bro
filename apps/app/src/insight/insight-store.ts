import {
	DailyMetricRepository,
	getDb,
	ObservationRepository,
	TrackedMetricsRepository,
} from "@bro/database-app";
import {
	INSIGHT_CATALOGUE,
	resolveInsight,
} from "@bro/domain/insight-catalogue";
import { DEFAULT_TRACKED_METRICS } from "@bro/domain/metric-registry";
import type { SQLiteDatabase } from "expo-sqlite";
import { shiftLocalDay } from "../habits/cadence";
import { localDayAt } from "../health/mapping";
import {
	createDailySignalReader,
	type DailySignalReader,
} from "./daily-signal";
import {
	aggregateInsightTeaser,
	evaluateInsight,
	INSIGHT_WINDOW_DAYS,
	type InsightEvaluation,
	type InsightTeaser,
	type ShownInsight,
} from "./engine";

export type InsightSnapshot = {
	state: "empty" | "not-yet" | "shown";
	throughLocalDay: string;
	evaluations: InsightEvaluation[];
	shown: ShownInsight[];
	teaser: InsightTeaser;
};

const MAX_LAG_DAYS = Math.max(
	0,
	...INSIGHT_CATALOGUE.map((pair) => pair.lagDays),
);

function systemTimeZone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export class InsightStore {
	private readonly observations: ObservationRepository;
	private readonly dailyMetrics: DailyMetricRepository;
	private readonly trackedMetrics: TrackedMetricsRepository;

	constructor(
		db: SQLiteDatabase,
		private readonly now: () => Date = () => new Date(),
		private readonly timeZone: () => string = systemTimeZone,
	) {
		this.observations = new ObservationRepository(db);
		this.dailyMetrics = new DailyMetricRepository(db);
		this.trackedMetrics = new TrackedMetricsRepository(db);
	}

	private async createReader(
		throughLocalDay: string,
	): Promise<DailySignalReader> {
		const earliestLocalDay = shiftLocalDay(
			throughLocalDay,
			-(INSIGHT_WINDOW_DAYS - 1 + MAX_LAG_DAYS),
		);
		const inWindow = (row: { localDay: string }) =>
			row.localDay >= earliestLocalDay && row.localDay <= throughLocalDay;
		const [observations, dailyMetrics, trackedMetrics] = await Promise.all([
			this.observations.listAll(),
			this.dailyMetrics.listAll(),
			this.trackedMetrics.listAll(),
		]);
		const factorWindows = new Map<
			string,
			{ addedOn: string | null; removedOn: string | null }
		>();
		for (const tracked of trackedMetrics) {
			if (factorWindows.has(tracked.metricSlug)) continue;
			// Materialising an overlay for a default-on factor (for example by
			// reordering it) stamps addedAt === createdAt; that is not evidence the
			// factor was absent before then. A later re-enable has a newer addedAt.
			const effectiveAddedAt =
				tracked.addedAt === tracked.createdAt ? null : tracked.addedAt;
			factorWindows.set(tracked.metricSlug, {
				addedOn:
					effectiveAddedAt === null
						? null
						: localDayAt(effectiveAddedAt, this.timeZone()),
				removedOn:
					tracked.removedAt === null
						? null
						: localDayAt(tracked.removedAt, this.timeZone()),
			});
		}
		const enabledByDefault = new Set(
			DEFAULT_TRACKED_METRICS.filter((metric) => metric.enabled !== false).map(
				(metric) => metric.metricSlug,
			),
		);
		const factorActive = (metricSlug: string, localDay: string) => {
			const window = factorWindows.get(metricSlug);
			if (!window) return enabledByDefault.has(metricSlug);
			if (window.addedOn !== null && localDay < window.addedOn) return false;
			if (window.removedOn !== null && localDay > window.removedOn)
				return false;
			return true;
		};
		return createDailySignalReader({
			observations: observations.filter(inWindow),
			dailyMetrics: dailyMetrics.filter(inWindow),
			factorActive,
		});
	}

	async load(): Promise<InsightSnapshot> {
		const throughLocalDay = localDayAt(this.now().getTime(), this.timeZone());
		const read = await this.createReader(throughLocalDay);
		const evaluations = INSIGHT_CATALOGUE.map((pair) =>
			evaluateInsight(pair, throughLocalDay, read),
		);
		const shown = evaluations.filter(
			(evaluation): evaluation is ShownInsight => evaluation.kind === "shown",
		);
		const hasOutputData = evaluations.some(
			(evaluation) =>
				evaluation.kind === "shown" || evaluation.outputDayCount > 0,
		);
		return {
			state: shown.length > 0 ? "shown" : hasOutputData ? "not-yet" : "empty",
			throughLocalDay,
			evaluations,
			shown,
			teaser: aggregateInsightTeaser(evaluations),
		};
	}

	async loadDetail(id: string): Promise<ShownInsight | null> {
		const pair = resolveInsight(id);
		if (!pair) return null;
		const throughLocalDay = localDayAt(this.now().getTime(), this.timeZone());
		const read = await this.createReader(throughLocalDay);
		const evaluation = evaluateInsight(pair, throughLocalDay, read);
		return evaluation.kind === "shown" ? evaluation : null;
	}
}

export function createInsightStore(): InsightStore {
	return new InsightStore(getDb());
}
