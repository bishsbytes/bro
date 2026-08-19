import {
	type ConsumptionDerivedMeasurementSlug,
	isConsumptionDerivedMeasurementSlug,
} from "@bro/domain/metric-registry";
import { type HealthMetricSlug, isHealthMetricSlug } from "../health/policy";

/**
 * Metrics a habit may target: device-imported health series and
 * consumption-derived intake totals. Deliberately wider than
 * `HealthMetricSlug`, which stays a HealthKit import policy.
 */
export type HabitMetricSlug =
	| HealthMetricSlug
	| ConsumptionDerivedMeasurementSlug;

export function isHabitMetricSlug(slug: string): slug is HabitMetricSlug {
	return isHealthMetricSlug(slug) || isConsumptionDerivedMeasurementSlug(slug);
}
