import { getDb, TrackedMetricsRepository } from "@bro/database-app";
import {
	CONFIGURABLE_CHECK_IN_METRIC_SLUGS,
	DEFAULT_TRACKED_METRICS,
	resolveMetric,
	type TagCategory,
} from "@bro/domain/metric-registry";
import type { SQLiteDatabase } from "expo-sqlite";

export type CheckInScoreSetting = {
	metricSlug: string;
	label: string;
	enabled: boolean;
	sensitive: boolean;
};

export type CheckInTagSetting = CheckInScoreSetting & {
	category: TagCategory;
};

export type CheckInSettingsSnapshot = {
	metrics: CheckInScoreSetting[];
	tags: CheckInTagSetting[];
};

const scoreDefaults = DEFAULT_TRACKED_METRICS.filter((metric) =>
	CONFIGURABLE_CHECK_IN_METRIC_SLUGS.some((slug) => slug === metric.metricSlug),
);

const tagDefaults = DEFAULT_TRACKED_METRICS.filter((metric) => {
	const resolved = resolveMetric(metric.metricSlug);
	return resolved.kind === "known" && resolved.metric.kind === "tag";
});

/**
 * Everything this screen may toggle. Both lists resolve in one read so the
 * scores and the panel tags cannot disagree about the overlay they came from.
 */
const configurableDefaults = [...scoreDefaults, ...tagDefaults];

export class CheckInSettingsStore {
	private readonly trackedMetrics: TrackedMetricsRepository;

	constructor(db: SQLiteDatabase) {
		this.trackedMetrics = new TrackedMetricsRepository(db);
	}

	async load(): Promise<CheckInSettingsSnapshot> {
		const overlays =
			await this.trackedMetrics.listResolved(configurableDefaults);
		const metrics: CheckInScoreSetting[] = [];
		const tags: CheckInTagSetting[] = [];

		for (const overlay of overlays) {
			const resolved = resolveMetric(overlay.metricSlug);
			if (resolved.kind !== "known") continue;
			const metric = resolved.metric;
			const setting = {
				metricSlug: metric.slug,
				label: metric.label,
				enabled: overlay.enabled,
				sensitive: metric.sensitive,
			};
			if (metric.kind === "scored") {
				metrics.push(setting);
			} else if (metric.kind === "tag") {
				tags.push({ ...setting, category: metric.category });
			}
		}

		return { metrics, tags };
	}

	async setEnabled(
		metricSlug: string,
		enabled: boolean,
	): Promise<CheckInSettingsSnapshot> {
		const fallback = configurableDefaults.find(
			(metric) => metric.metricSlug === metricSlug,
		);
		if (!fallback) {
			throw new TypeError(`Unknown check-in setting: ${metricSlug}`);
		}
		await this.trackedMetrics.configure(metricSlug, fallback.position, enabled);
		return await this.load();
	}
}

export function createCheckInSettingsStore(): CheckInSettingsStore {
	return new CheckInSettingsStore(getDb());
}
