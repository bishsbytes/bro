import {
	type Dimension,
	type DisplayUnit,
	type DisplayUnitForDimension,
	isDisplayUnitForDimension,
} from "./dimensions";

/** Exact international avoirdupois definition. */
export const KILOGRAMS_PER_POUND = 0.45359237;
export const POUNDS_PER_STONE = 14;
/** Exact international-inch definition. */
export const METRES_PER_INCH = 0.0254;
export const INCHES_PER_FOOT = 12;
export const METRES_PER_FOOT = METRES_PER_INCH * INCHES_PER_FOOT;

function assertValue(value: number): void {
	if (!Number.isFinite(value) || value < 0) {
		throw new RangeError("Measurement values must be finite and non-negative.");
	}
}

function assertUnit(dimension: Dimension, unit: DisplayUnit): void {
	if (!isDisplayUnitForDimension(dimension, unit)) {
		throw new TypeError(`Unit ${unit} does not measure ${dimension}.`);
	}
}

export function toCanonical<D extends Dimension>(
	value: number,
	dimension: D,
	unit: DisplayUnitForDimension<D>,
): number;
export function toCanonical(
	value: number,
	dimension: Dimension,
	unit: DisplayUnit,
): number {
	assertValue(value);
	assertUnit(dimension, unit);

	if (dimension === "mass") {
		if (unit === "kg") return value;
		if (unit === "lb") return value * KILOGRAMS_PER_POUND;
		return value * POUNDS_PER_STONE * KILOGRAMS_PER_POUND;
	}
	if (dimension === "length") {
		if (unit === "cm") return value / 100;
		return value * (unit === "in" ? METRES_PER_INCH : METRES_PER_FOOT);
	}
	return value / 100;
}

export function fromCanonical<D extends Dimension>(
	canonicalValue: number,
	dimension: D,
	unit: DisplayUnitForDimension<D>,
): number;
export function fromCanonical(
	canonicalValue: number,
	dimension: Dimension,
	unit: DisplayUnit,
): number {
	assertValue(canonicalValue);
	assertUnit(dimension, unit);

	if (dimension === "mass") {
		if (unit === "kg") return canonicalValue;
		const pounds = canonicalValue / KILOGRAMS_PER_POUND;
		return unit === "lb" ? pounds : pounds / POUNDS_PER_STONE;
	}
	if (dimension === "length") {
		if (unit === "cm") return canonicalValue * 100;
		return canonicalValue / (unit === "in" ? METRES_PER_INCH : METRES_PER_FOOT);
	}
	return canonicalValue * 100;
}
