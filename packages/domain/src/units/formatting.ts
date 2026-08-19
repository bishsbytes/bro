import { fromCanonical, INCHES_PER_FOOT, POUNDS_PER_STONE } from "./conversion";
import {
	DISPLAY_RESOLUTIONS,
	type Dimension,
	type DisplayUnit,
	type DisplayUnitForDimension,
	type IntrinsicDimension,
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
	if (unit === "st") {
		const totalPounds = Math.round(fromCanonical(canonicalValue, "mass", "lb"));
		const stones = Math.floor(totalPounds / POUNDS_PER_STONE);
		const pounds = totalPounds % POUNDS_PER_STONE;
		return `${stones} st ${pounds} lb`;
	}
	if (unit === "ft") {
		const totalInches = Math.round(
			fromCanonical(canonicalValue, "length", "in"),
		);
		const feet = Math.floor(totalInches / INCHES_PER_FOOT);
		const inches = totalInches % INCHES_PER_FOOT;
		return `${feet} ft ${inches} in`;
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
