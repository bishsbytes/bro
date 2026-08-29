import {
	type Dimension,
	type DisplayUnit,
	formatIntrinsicDelta,
	formatIntrinsicMeasurement,
	formatMeasurement,
	formatMeasurementDelta,
	INTRINSIC_DIMENSIONS,
	resolveUnitPreference,
	type UnitWordOverrides,
} from "@bro/domain";
import type { MeasurementMetricDefinition } from "@bro/domain/metric-registry";

function isIntrinsicDimension(
	dimension: MeasurementMetricDefinition["dimension"],
): dimension is "time" | "count" | "rate_bpm" {
	return INTRINSIC_DIMENSIONS.includes(
		dimension as (typeof INTRINSIC_DIMENSIONS)[number],
	);
}

export function metricDisplayUnit(
	metric: MeasurementMetricDefinition,
	preferenceByDimension: ReadonlyMap<string, string>,
	locale: string | undefined,
): DisplayUnit | null {
	if (isIntrinsicDimension(metric.dimension)) return null;
	if (metric.fixedDisplayUnit) return metric.fixedDisplayUnit;
	const preferenceDimension =
		metric.unitPreferenceDimension ?? metric.dimension;
	return resolveUnitPreference(
		preferenceDimension as Parameters<typeof resolveUnitPreference>[0],
		preferenceByDimension.get(preferenceDimension),
		locale,
	);
}

export function formatMetricValue(
	metric: MeasurementMetricDefinition,
	value: number,
	displayUnit: DisplayUnit | null,
	locale?: string,
	unitWords?: UnitWordOverrides,
): string {
	if (isIntrinsicDimension(metric.dimension)) {
		return formatIntrinsicMeasurement(value, metric.dimension, locale);
	}
	if (!displayUnit) {
		throw new TypeError(`A ${metric.dimension} metric needs a display unit.`);
	}
	return formatMeasurement(
		value,
		metric.dimension as Dimension,
		displayUnit as never,
		locale,
		unitWords,
	);
}

/**
 * Formats how much a metric moved. Takes the magnitude of the change, not a
 * reading, and returns null when it is too small to render at the unit's
 * display resolution.
 */
export function formatMetricDelta(
	metric: MeasurementMetricDefinition,
	magnitude: number,
	displayUnit: DisplayUnit | null,
	locale?: string,
	unitWords?: UnitWordOverrides,
): string | null {
	if (isIntrinsicDimension(metric.dimension)) {
		return formatIntrinsicDelta(magnitude, metric.dimension, locale);
	}
	if (!displayUnit) {
		throw new TypeError(`A ${metric.dimension} metric needs a display unit.`);
	}
	return formatMeasurementDelta(
		magnitude,
		metric.dimension as Dimension,
		displayUnit as never,
		locale,
		unitWords,
	);
}
