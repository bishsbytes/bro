import {
	type MeasurementEntry,
	measurementEntryOf,
	type ParsedMeasurement,
	parseMeasurementEntry,
} from "@bro/domain";
import type { MeasurementPresentation } from "@bro/logic";
import { i18n } from "../i18n";

export const EMPTY_ENTRY: MeasurementEntry = { major: "", minor: "" };

export function isBlankEntry(entry: MeasurementEntry): boolean {
	return !entry.major.trim() && !entry.minor.trim();
}

export type ParsedMeasurementInput =
	| { ok: true; canonicalValue: number }
	| { ok: false; error: string };

function localiseParseResult(
	result: ParsedMeasurement,
): ParsedMeasurementInput {
	return result.ok
		? result
		: { ok: false, error: i18n.t("validation:measurement.invalid") };
}

/**
 * The branches look identical but are not interchangeable: each one narrows the
 * presentation's dimension and unit together, which is what lets the correlated
 * overloads of `parseMeasurementEntry` accept the pair.
 */
export function parseMeasurementInput(
	entry: MeasurementEntry,
	presentation: MeasurementPresentation,
	locale: string | undefined,
): ParsedMeasurementInput {
	if (presentation.dimension === "mass") {
		return localiseParseResult(
			parseMeasurementEntry(
				entry,
				presentation.dimension,
				presentation.displayUnit,
				locale,
			),
		);
	}
	if (presentation.dimension === "length") {
		return localiseParseResult(
			parseMeasurementEntry(
				entry,
				presentation.dimension,
				presentation.displayUnit,
				locale,
			),
		);
	}
	return localiseParseResult(
		parseMeasurementEntry(
			entry,
			presentation.dimension,
			presentation.displayUnit,
			locale,
		),
	);
}

/**
 * Splits a canonical value into the fields its display unit is typed in. Takes
 * the same locale as `parseMeasurementInput` so a value seeded into a field
 * parses back unchanged.
 */
export function measurementInputOf(
	canonicalValue: number,
	presentation: MeasurementPresentation,
	locale: string | undefined,
): MeasurementEntry {
	if (presentation.dimension === "mass") {
		return measurementEntryOf(
			canonicalValue,
			presentation.dimension,
			presentation.displayUnit,
			locale,
		);
	}
	if (presentation.dimension === "length") {
		return measurementEntryOf(
			canonicalValue,
			presentation.dimension,
			presentation.displayUnit,
			locale,
		);
	}
	return measurementEntryOf(
		canonicalValue,
		presentation.dimension,
		presentation.displayUnit,
		locale,
	);
}
