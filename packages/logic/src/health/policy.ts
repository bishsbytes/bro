import type { MeasurementSlug } from "@bro/domain/metric-registry";

export const HEALTH_BACKFILL_DAYS = 365;
export const RAW_SAMPLE_RETENTION_DAYS = 90;

export const V1_HEALTH_METRIC_SLUGS = [
	"sleep_duration",
	"steps",
	"resting_heart_rate",
	"weight",
	"body_fat",
] as const satisfies readonly MeasurementSlug[];

export type HealthMetricSlug = (typeof V1_HEALTH_METRIC_SLUGS)[number];

export function isHealthMetricSlug(slug: string): slug is HealthMetricSlug {
	return (V1_HEALTH_METRIC_SLUGS as readonly string[]).includes(slug);
}
