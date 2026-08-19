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
	return unit === "%" ? `${formatted}%` : `${formatted} ${unit}`;
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
