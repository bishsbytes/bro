import {
	COMPOUND_UNIT_PARTS,
	fromCompoundParts,
	type MeasurementEntry,
} from "./compound";
import { INCHES_PER_FOOT, POUNDS_PER_STONE, toCanonical } from "./conversion";
import {
	type CompoundDisplayUnit,
	type Dimension,
	type DisplayUnit,
	type DisplayUnitForDimension,
	isCompoundDisplayUnit,
	isDisplayUnitForDimension,
	type SimpleDisplayUnit,
} from "./dimensions";

export const INVALID_MEASUREMENT_MESSAGE = "Enter a valid measurement.";

export type ParsedMeasurement =
	| { ok: true; canonicalValue: number }
	| { ok: false; error: typeof INVALID_MEASUREMENT_MESSAGE };

const SUFFIXES: Record<SimpleDisplayUnit, string> = {
	kg: "kg",
	lb: "(?:lb|lbs)",
	cm: "cm",
	in: "in",
	"%": "%",
	g: "g",
	mg: "mg",
	uk_unit: "(?:unit|units)",
	us_standard_drink: "(?:standard\\s*drink|standard\\s*drinks)",
	ml: "ml",
	l: "l",
	fl_oz_uk: "(?:fl\\s*oz|fluid\\s*ounce|fluid\\s*ounces)",
	fl_oz_us: "(?:fl\\s*oz|fluid\\s*ounce|fluid\\s*ounces)",
	kcal: "kcal",
	kJ: "kJ",
};

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decimalSeparator(locale: string | undefined): string {
	if (!locale) return ".";
	try {
		return (
			new Intl.NumberFormat(locale)
				.formatToParts(1.1)
				.find((part) => part.type === "decimal")?.value ?? "."
		);
	} catch {
		return ".";
	}
}

function numberPattern(locale: string | undefined): string {
	const separator = decimalSeparator(locale);
	const decimal =
		separator === "." ? "\\." : `(?:\\.|${escapeRegex(separator)})`;
	return `[0-9]+(?:${decimal}[0-9]+)?`;
}

function parseNumber(value: string, locale: string | undefined): number | null {
	const trimmed = value.trim();
	if (!new RegExp(`^${numberPattern(locale)}$`).test(trimmed)) return null;
	const separator = decimalSeparator(locale);
	const normalized =
		separator === "." ? trimmed : trimmed.replace(separator, ".");
	const parsed = Number(normalized);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseStones(value: string, locale: string | undefined): number | null {
	const number = numberPattern(locale);
	const compound = new RegExp(
		`^(${number})\\s*(?:st|stone|stones)(?:\\s*(${number})\\s*(?:lb|lbs|pound|pounds)?)?$`,
		"i",
	).exec(value.trim());
	if (!compound) return parseNumber(value, locale);

	const stones = parseNumber(compound[1] ?? "", locale);
	const pounds = compound[2] ? parseNumber(compound[2], locale) : 0;
	if (
		stones === null ||
		pounds === null ||
		(compound[2] !== undefined && !Number.isInteger(stones)) ||
		pounds >= POUNDS_PER_STONE
	) {
		return null;
	}
	return fromCompoundParts(stones, pounds, "st");
}

function parseFeet(value: string, locale: string | undefined): number | null {
	const number = numberPattern(locale);
	const compound = new RegExp(
		`^(${number})\\s*(?:ft|foot|feet|')(?:\\s*(${number})\\s*(?:in|inch|inches|")?)?$`,
		"i",
	).exec(value.trim());
	if (!compound) return parseNumber(value, locale);

	const feet = parseNumber(compound[1] ?? "", locale);
	const inches = compound[2] ? parseNumber(compound[2], locale) : 0;
	if (
		feet === null ||
		inches === null ||
		(compound[2] !== undefined && !Number.isInteger(feet)) ||
		inches >= INCHES_PER_FOOT
	) {
		return null;
	}
	return fromCompoundParts(feet, inches, "ft");
}

function parseSingleUnit(
	value: string,
	unit: SimpleDisplayUnit,
	locale: string | undefined,
): number | null {
	const match = new RegExp(
		`^(${numberPattern(locale)})(?:\\s*${SUFFIXES[unit]})?$`,
		"i",
	).exec(value.trim());
	return match ? parseNumber(match[1] ?? "", locale) : null;
}

export function parseMeasurement<D extends Dimension>(
	input: string,
	dimension: D,
	unit: DisplayUnitForDimension<D>,
	locale?: string,
): ParsedMeasurement {
	if (
		!input.trim() ||
		!isDisplayUnitForDimension(dimension, unit as DisplayUnit)
	) {
		return { ok: false, error: INVALID_MEASUREMENT_MESSAGE };
	}

	const displayValue =
		unit === "st"
			? parseStones(input, locale)
			: unit === "ft"
				? parseFeet(input, locale)
				: parseSingleUnit(input, unit as SimpleDisplayUnit, locale);
	if (displayValue === null) {
		return { ok: false, error: INVALID_MEASUREMENT_MESSAGE };
	}

	const canonicalValue = toCanonical(
		displayValue,
		dimension,
		unit as DisplayUnitForDimension<D>,
	);
	if (dimension === "fraction" && canonicalValue > 1) {
		return { ok: false, error: INVALID_MEASUREMENT_MESSAGE };
	}
	return { ok: true, canonicalValue };
}

/**
 * Parses the fields a measurement is typed into. Compound units are entered as
 * two whole numbers rather than as text, so the remainder is checked against
 * its major here instead of being teased back out of a sentence.
 */
export function parseMeasurementEntry<D extends Dimension>(
	entry: MeasurementEntry,
	dimension: D,
	unit: DisplayUnitForDimension<D>,
	locale?: string,
): ParsedMeasurement {
	if (!isDisplayUnitForDimension(dimension, unit as DisplayUnit)) {
		return { ok: false, error: INVALID_MEASUREMENT_MESSAGE };
	}
	if (!isCompoundDisplayUnit(unit as DisplayUnit)) {
		return parseMeasurement(entry.major, dimension, unit, locale);
	}

	const compoundUnit = unit as CompoundDisplayUnit;
	const major = parseNumber(entry.major, locale);
	const minorInput = entry.minor.trim();
	const minor = minorInput ? parseNumber(minorInput, locale) : 0;
	if (
		major === null ||
		minor === null ||
		!Number.isInteger(major) ||
		!Number.isInteger(minor) ||
		minor >= COMPOUND_UNIT_PARTS[compoundUnit].minorsPerMajor
	) {
		return { ok: false, error: INVALID_MEASUREMENT_MESSAGE };
	}
	return {
		ok: true,
		canonicalValue: toCanonical(
			fromCompoundParts(major, minor, compoundUnit),
			dimension,
			unit,
		),
	};
}
