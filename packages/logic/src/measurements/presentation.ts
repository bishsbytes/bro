import {
	type Dimension,
	type DisplayUnit,
	type FractionDisplayUnit,
	isDisplayUnitForDimension,
	type LengthDisplayUnit,
	type MassDisplayUnit,
} from "@bro/domain";
import type { UserEnterableMeasurementSlug } from "@bro/domain/metric-registry";

type MeasurementPresentationBase = {
	metricSlug: UserEnterableMeasurementSlug;
	label: string;
};

/**
 * A measurement the user can type a value into, paired with the unit it is
 * currently shown in.
 *
 * The dimension and its unit are correlated deliberately: a length field can
 * only offer length units, so a screen rendering one of these cannot pair
 * centimetres with a weight. Narrowing on `dimension` gives callers the
 * matching unit type for free.
 */
export type MeasurementPresentation =
	| (MeasurementPresentationBase & {
			dimension: "mass";
			displayUnit: MassDisplayUnit;
	  })
	| (MeasurementPresentationBase & {
			dimension: "length";
			displayUnit: LengthDisplayUnit;
	  })
	| (MeasurementPresentationBase & {
			dimension: "fraction";
			displayUnit: FractionDisplayUnit;
	  });

/**
 * Pairs a measurement with the unit it will be shown in, rejecting a unit that
 * does not measure the metric's dimension. The repetition is what proves the
 * correlation to the type checker — each branch narrows both sides together.
 */
export function toMeasurementPresentation(
	metricSlug: UserEnterableMeasurementSlug,
	label: string,
	dimension: Dimension,
	displayUnit: DisplayUnit,
): MeasurementPresentation {
	if (
		dimension === "mass" &&
		isDisplayUnitForDimension(dimension, displayUnit)
	) {
		return { metricSlug, label, dimension, displayUnit };
	}
	if (
		dimension === "length" &&
		isDisplayUnitForDimension(dimension, displayUnit)
	) {
		return { metricSlug, label, dimension, displayUnit };
	}
	if (
		dimension === "fraction" &&
		isDisplayUnitForDimension(dimension, displayUnit)
	) {
		return { metricSlug, label, dimension, displayUnit };
	}
	throw new TypeError(`Unit ${displayUnit} does not measure ${dimension}.`);
}
