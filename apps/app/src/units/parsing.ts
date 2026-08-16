import { POUNDS_PER_STONE, toCanonical } from "./conversion";
import {
	type Dimension,
	type DisplayUnit,
	type DisplayUnitForDimension,
	isDisplayUnitForDimension,
} from "./dimensions";

export const INVALID_MEASUREMENT_MESSAGE = "Enter a valid measurement.";

export type ParsedMeasurement =
	| { ok: true; canonicalValue: number }
	| { ok: false; error: typeof INVALID_MEASUREMENT_MESSAGE };

const SUFFIXES: Record<Exclude<DisplayUnit, "st">, string> = {
	kg: "kg",
	lb: "(?:lb|lbs)",
	cm: "cm",
	in: "in",
	"%": "%",
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
	return stones + pounds / POUNDS_PER_STONE;
}

function parseSingleUnit(
	value: string,
	unit: Exclude<DisplayUnit, "st">,
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
			: parseSingleUnit(input, unit as Exclude<DisplayUnit, "st">, locale);
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
