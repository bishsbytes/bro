import { fromCanonical, POUNDS_PER_STONE } from "./conversion";
import {
	DISPLAY_RESOLUTIONS,
	type Dimension,
	type DisplayUnit,
	type DisplayUnitForDimension,
	isDisplayUnitForDimension,
} from "./dimensions";

function roundToResolution(value: number, resolution: number): number {
	return Math.round((value + Number.EPSILON) / resolution) * resolution;
}

function decimalPlaces(resolution: number): number {
	const text = resolution.toString();
	return text.includes(".") ? (text.split(".")[1]?.length ?? 0) : 0;
}

function formatRounded(
	value: number,
	unit: Exclude<DisplayUnit, "st">,
): string {
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

	return formatRounded(
		fromCanonical(
			canonicalValue,
			dimension,
			unit as DisplayUnitForDimension<D>,
		),
		unit as Exclude<DisplayUnit, "st">,
	);
}
