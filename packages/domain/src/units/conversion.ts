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
/** Exact imperial fluid-ounce definition. */
export const LITRES_PER_UK_FLUID_OUNCE = 0.028_413_062_5;
/** Exact US customary fluid-ounce definition. */
export const LITRES_PER_US_FLUID_OUNCE = 0.029_573_529_562_5;
/** Exact thermochemical conversion used for nutrition labels. */
export const KILOJOULES_PER_KILOCALORIE = 4.184;
/** Pure ethanol density at 20 °C, used for every drink-entry calculation. */
export const ETHANOL_DENSITY_G_PER_ML = 0.789_24;
/** One UK unit is exactly 10 ml of ethanol at the declared density. */
export const KILOGRAMS_ETHANOL_PER_UK_UNIT =
	(10 * ETHANOL_DENSITY_G_PER_ML) / 1_000;
/** The US standard-drink definition is exactly 14 g of ethanol. */
export const KILOGRAMS_ETHANOL_PER_US_STANDARD_DRINK = 0.014;

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
		if (unit === "st") {
			return value * POUNDS_PER_STONE * KILOGRAMS_PER_POUND;
		}
		if (unit === "g") return value / 1_000;
		if (unit === "mg") return value / 1_000_000;
		return (
			value *
			(unit === "uk_unit"
				? KILOGRAMS_ETHANOL_PER_UK_UNIT
				: KILOGRAMS_ETHANOL_PER_US_STANDARD_DRINK)
		);
	}
	if (dimension === "length") {
		if (unit === "cm") return value / 100;
		return value * (unit === "in" ? METRES_PER_INCH : METRES_PER_FOOT);
	}
	if (dimension === "fraction") return value / 100;
	if (dimension === "volume") {
		if (unit === "l") return value;
		if (unit === "ml") return value / 1_000;
		return (
			value *
			(unit === "fl_oz_uk"
				? LITRES_PER_UK_FLUID_OUNCE
				: LITRES_PER_US_FLUID_OUNCE)
		);
	}
	return unit === "kcal" ? value : value / KILOJOULES_PER_KILOCALORIE;
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
		if (unit === "lb" || unit === "st") {
			const pounds = canonicalValue / KILOGRAMS_PER_POUND;
			return unit === "lb" ? pounds : pounds / POUNDS_PER_STONE;
		}
		if (unit === "g") return canonicalValue * 1_000;
		if (unit === "mg") return canonicalValue * 1_000_000;
		return (
			canonicalValue /
			(unit === "uk_unit"
				? KILOGRAMS_ETHANOL_PER_UK_UNIT
				: KILOGRAMS_ETHANOL_PER_US_STANDARD_DRINK)
		);
	}
	if (dimension === "length") {
		if (unit === "cm") return canonicalValue * 100;
		return canonicalValue / (unit === "in" ? METRES_PER_INCH : METRES_PER_FOOT);
	}
	if (dimension === "fraction") return canonicalValue * 100;
	if (dimension === "volume") {
		if (unit === "l") return canonicalValue;
		if (unit === "ml") return canonicalValue * 1_000;
		return (
			canonicalValue /
			(unit === "fl_oz_uk"
				? LITRES_PER_UK_FLUID_OUNCE
				: LITRES_PER_US_FLUID_OUNCE)
		);
	}
	return unit === "kcal"
		? canonicalValue
		: canonicalValue * KILOJOULES_PER_KILOCALORIE;
}
