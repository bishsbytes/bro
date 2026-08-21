import { getDb, TrackedMetricsRepository } from "@bro/database-app";
import {
	DEFAULT_TRACKED_METRICS,
	OPTIONAL_CHECK_IN_METRIC_SLUGS,
	resolveMetric,
} from "@bro/domain/metric-registry";
import type { SQLiteDatabase } from "expo-sqlite";

export type OptionalCheckInSetting = {
	metricSlug: string;
	label: string;
	enabled: boolean;
	sensitive: boolean;
};

export type CheckInSettingsSnapshot = {
	metrics: OptionalCheckInSetting[];
};

const optionalDefaults = DEFAULT_TRACKED_METRICS.filter((metric) =>
	OPTIONAL_CHECK_IN_METRIC_SLUGS.some((slug) => slug === metric.metricSlug),
);

export class CheckInSettingsStore {
	private readonly trackedMetrics: TrackedMetricsRepository;

	constructor(db: SQLiteDatabase) {
		this.trackedMetrics = new TrackedMetricsRepository(db);
	}

	async load(): Promise<CheckInSettingsSnapshot> {
		const overlays = await this.trackedMetrics.listResolved(optionalDefaults);
		return {
			metrics: overlays.flatMap((overlay) => {
				const resolved = resolveMetric(overlay.metricSlug);
				return resolved.kind === "known" && resolved.metric.kind === "scored"
					? [
							{
								metricSlug: resolved.metric.slug,
								label: resolved.metric.label,
								enabled: overlay.enabled,
								sensitive: resolved.metric.sensitive,
							},
						]
					: [];
			}),
		};
	}

	async setEnabled(
		metricSlug: string,
		enabled: boolean,
	): Promise<CheckInSettingsSnapshot> {
		const fallback = optionalDefaults.find(
			(metric) => metric.metricSlug === metricSlug,
		);
		if (!fallback) {
			throw new TypeError(`Unknown optional check-in score: ${metricSlug}`);
		}
		await this.trackedMetrics.configure(metricSlug, fallback.position, enabled);
		return await this.load();
	}
}

export function createCheckInSettingsStore(): CheckInSettingsStore {
	return new CheckInSettingsStore(getDb());
}
