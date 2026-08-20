import {
	COMPOUND_UNIT_PARTS,
	type MeasurementEntry,
	toCompoundParts,
} from "./compound";
import { fromCanonical } from "./conversion";
import {
	type CompoundDisplayUnit,
	DISPLAY_RESOLUTIONS,
	type Dimension,
	type DisplayUnit,
	type DisplayUnitForDimension,
	type IntrinsicDimension,
	isCompoundDisplayUnit,
	isDisplayUnitForDimension,
	type SimpleDisplayUnit,
} from "./dimensions";

function assertCanonicalValue(value: number): void {
	if (!Number.isFinite(value) || value < 0) {
		throw new RangeError("Metric values must be finite and non-negative.");
	}
}

function roundToResolution(value: number, resolution: number): number {
	return Math.round((value + Number.EPSILON) / resolution) * resolution;
}

function decimalPlaces(resolution: number): number {
	const text = resolution.toString();
	return text.includes(".") ? (text.split(".")[1]?.length ?? 0) : 0;
}

function formatRounded(value: number, unit: SimpleDisplayUnit): string {
	const resolution = DISPLAY_RESOLUTIONS[unit];
	const rounded = roundToResolution(value, resolution);
	const formatted = rounded.toFixed(decimalPlaces(resolution));
	const suffix = {
		"%": "%",
		uk_unit: rounded === 1 ? " unit" : " units",
		us_standard_drink: rounded === 1 ? " standard drink" : " standard drinks",
		fl_oz_uk: " fl oz",
		fl_oz_us: " fl oz",
	} as const;
	const resolvedSuffix = suffix[unit as keyof typeof suffix];
	return resolvedSuffix === "%"
		? `${formatted}%`
		: `${formatted}${resolvedSuffix ?? ` ${unit}`}`;
}

export function formatMeasurement<D extends Dimension>(
	canonicalValue: number,
	dimension: D,
	unit: DisplayUnitForDimension<D>,
): string {
	if (!isDisplayUnitForDimension(dimension, unit as DisplayUnit)) {
		throw new TypeError(`Unit ${unit} does not measure ${dimension}.`);
	}
	if (isCompoundDisplayUnit(unit)) {
		const { major, minor } = toCompoundParts(canonicalValue, dimension, unit);
		return `${major} ${unit} ${minor} ${COMPOUND_UNIT_PARTS[unit].minor}`;
	}

	return formatRounded(
		fromCanonical(
			canonicalValue,
			dimension,
			unit as DisplayUnitForDimension<D>,
		),
		unit as SimpleDisplayUnit,
	);
}

/**
 * Formats the size of a change rather than a reading.
 *
 * Compound units report in their minor unit alone: a day-to-day weight move
 * would otherwise read `0 st 1 lb`. Returns null when the change rounds away at
 * display resolution — both readings render identically, so there is no change
 * a person could see.
 */
export function formatMeasurementDelta<D extends Dimension>(
	magnitude: number,
	dimension: D,
	unit: DisplayUnitForDimension<D>,
): string | null {
	if (!isDisplayUnitForDimension(dimension, unit as DisplayUnit)) {
		throw new TypeError(`Unit ${unit} does not measure ${dimension}.`);
	}
	assertCanonicalValue(magnitude);

	if (isCompoundDisplayUnit(unit as DisplayUnit)) {
		const { minor } = COMPOUND_UNIT_PARTS[unit as CompoundDisplayUnit];
		// A compound reading shows whole minors (`12 st 4 lb`), so a change is
		// only visible in whole minors — not at the minor unit's own resolution.
		const minors = Math.round(
			fromCanonical(magnitude, dimension, minor as DisplayUnitForDimension<D>),
		);
		return minors === 0 ? null : `${minors} ${minor}`;
	}

	const simple = unit as SimpleDisplayUnit;
	const converted = fromCanonical(magnitude, dimension, unit);
	if (roundToResolution(converted, DISPLAY_RESOLUTIONS[simple]) === 0) {
		return null;
	}
	return formatRounded(converted, simple);
}

/**
 * Splits a stored value into the fields a person edits, without unit suffixes.
 * Compound units seed both fields; simple units seed `major` alone.
 */
export function measurementEntryOf<D extends Dimension>(
	canonicalValue: number,
	dimension: D,
	unit: DisplayUnitForDimension<D>,
): MeasurementEntry {
	if (!isDisplayUnitForDimension(dimension, unit as DisplayUnit)) {
		throw new TypeError(`Unit ${unit} does not measure ${dimension}.`);
	}
	if (isCompoundDisplayUnit(unit as DisplayUnit)) {
		const parts = toCompoundParts(
			canonicalValue,
			dimension,
			unit as CompoundDisplayUnit,
		);
		return { major: String(parts.major), minor: String(parts.minor) };
	}

	const simple = unit as SimpleDisplayUnit;
	const resolution = DISPLAY_RESOLUTIONS[simple];
	const rounded = roundToResolution(
		fromCanonical(canonicalValue, dimension, unit),
		resolution,
	);
	return {
		major: rounded.toFixed(decimalPlaces(resolution)),
		minor: "",
	};
}

/** Formats dimensions that deliberately have no user preference in v1. */
export function formatIntrinsicMeasurement(
	canonicalValue: number,
	dimension: IntrinsicDimension,
): string {
	assertCanonicalValue(canonicalValue);

	if (dimension === "time") {
		const totalMinutes = Math.round(canonicalValue / 60);
		const hours = Math.floor(totalMinutes / 60);
		const minutes = totalMinutes % 60;
		return hours > 0 ? `${hours} h ${minutes} m` : `${minutes} m`;
	}
	if (dimension === "count") {
		return String(Math.round(canonicalValue));
	}

	const rounded = Math.round((canonicalValue + Number.EPSILON) * 10) / 10;
	return `${rounded.toFixed(Number.isInteger(rounded) ? 0 : 1)} bpm`;
}

/**
 * The change counterpart of `formatIntrinsicMeasurement`. Sub-minute durations
 * are reported in seconds, since whole-minute rounding renders them as `0 m`.
 * Returns null when the change rounds away entirely.
 */
export function formatIntrinsicDelta(
	magnitude: number,
	dimension: IntrinsicDimension,
): string | null {
	assertCanonicalValue(magnitude);

	if (dimension === "time") {
		if (magnitude < 60) {
			const seconds = Math.round(magnitude);
			return seconds === 0 ? null : `${seconds} s`;
		}
		return formatIntrinsicMeasurement(magnitude, dimension);
	}
	if (dimension === "count") {
		return Math.round(magnitude) === 0
			? null
			: formatIntrinsicMeasurement(magnitude, dimension);
	}
	return Math.round((magnitude + Number.EPSILON) * 10) === 0
		? null
		: formatIntrinsicMeasurement(magnitude, dimension);
}
