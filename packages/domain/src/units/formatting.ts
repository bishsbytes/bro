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

/**
 * Renders the numeric part of a measurement in the reader's locale, so the
 * decimal separator matches what `parseMeasurementInput` accepts back.
 *
 * `grouping` is off for the values that seed an editable field: a thousands
 * separator is not typeable on a numeric keyboard and the parser rejects it.
 */
function formatNumber(
	value: number,
	fractionDigits: number,
	locale: string | undefined,
	grouping: boolean,
): string {
	try {
		return new Intl.NumberFormat(locale, {
			minimumFractionDigits: fractionDigits,
			maximumFractionDigits: fractionDigits,
			useGrouping: grouping,
		}).format(value);
	} catch {
		// An unusable locale must not stop a reading from rendering.
		return value.toFixed(fractionDigits);
	}
}

/**
 * Selects the wording for a unit after display rounding. A callback rather
 * than a `{ one, other }` pair lets the app use the active language's complete
 * plural rules (`zero`, `few`, `many`, and so on), while the dependency-free
 * domain package supplies the English fallback below.
 */
export type UnitWordFormatter = (count: number) => string;

export const DEFAULT_UNIT_WORDS = {
	uk_unit: (count: number) => (count === 1 ? "unit" : "units"),
	us_standard_drink: (count: number) =>
		count === 1 ? "standard drink" : "standard drinks",
	fl_oz_uk: () => "fl oz",
	fl_oz_us: () => "fl oz",
	salt_g: () => "g salt",
} as const satisfies Partial<Record<SimpleDisplayUnit, UnitWordFormatter>>;

export type UnitWordOverrides = Partial<
	Record<SimpleDisplayUnit, UnitWordFormatter>
>;

function formatRounded(
	value: number,
	unit: SimpleDisplayUnit,
	locale: string | undefined,
	unitWords: UnitWordOverrides | undefined,
): string {
	const resolution = DISPLAY_RESOLUTIONS[unit];
	const rounded = roundToResolution(value, resolution);
	const formatted = formatNumber(
		rounded,
		decimalPlaces(resolution),
		locale,
		true,
	);
	if (unit === "%") {
		return `${formatted}%`;
	}
	const wordFor =
		unitWords?.[unit] ??
		DEFAULT_UNIT_WORDS[unit as keyof typeof DEFAULT_UNIT_WORDS];
	if (!wordFor) {
		return `${formatted} ${unit}`;
	}
	return `${formatted} ${wordFor(rounded)}`;
}

export function formatMeasurement<D extends Dimension>(
	canonicalValue: number,
	dimension: D,
	unit: DisplayUnitForDimension<D>,
	locale?: string,
	unitWords?: UnitWordOverrides,
): string {
	if (!isDisplayUnitForDimension(dimension, unit as DisplayUnit)) {
		throw new TypeError(`Unit ${unit} does not measure ${dimension}.`);
	}
	if (isCompoundDisplayUnit(unit)) {
		const { major, minor } = toCompoundParts(canonicalValue, dimension, unit);
		return `${formatNumber(major, 0, locale, true)} ${unit} ${formatNumber(
			minor,
			0,
			locale,
			true,
		)} ${COMPOUND_UNIT_PARTS[unit].minor}`;
	}

	return formatRounded(
		fromCanonical(
			canonicalValue,
			dimension,
			unit as DisplayUnitForDimension<D>,
		),
		unit as SimpleDisplayUnit,
		locale,
		unitWords,
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
	locale?: string,
	unitWords?: UnitWordOverrides,
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
		return minors === 0
			? null
			: `${formatNumber(minors, 0, locale, true)} ${minor}`;
	}

	const simple = unit as SimpleDisplayUnit;
	const converted = fromCanonical(magnitude, dimension, unit);
	if (roundToResolution(converted, DISPLAY_RESOLUTIONS[simple]) === 0) {
		return null;
	}
	return formatRounded(converted, simple, locale, unitWords);
}

/**
 * Splits a stored value into the fields a person edits, without unit suffixes.
 * Compound units seed both fields; simple units seed `major` alone.
 */
export function measurementEntryOf<D extends Dimension>(
	canonicalValue: number,
	dimension: D,
	unit: DisplayUnitForDimension<D>,
	locale?: string,
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
		major: formatNumber(rounded, decimalPlaces(resolution), locale, false),
		minor: "",
	};
}

/** Formats dimensions that deliberately have no user preference in v1. */
export function formatIntrinsicMeasurement(
	canonicalValue: number,
	dimension: IntrinsicDimension,
	locale?: string,
): string {
	assertCanonicalValue(canonicalValue);

	if (dimension === "time") {
		const totalMinutes = Math.round(canonicalValue / 60);
		const hours = Math.floor(totalMinutes / 60);
		const minutes = totalMinutes % 60;
		const shownMinutes = formatNumber(minutes, 0, locale, true);
		return hours > 0
			? `${formatNumber(hours, 0, locale, true)} h ${shownMinutes} m`
			: `${shownMinutes} m`;
	}
	if (dimension === "count") {
		return formatNumber(Math.round(canonicalValue), 0, locale, true);
	}

	const rounded = Math.round((canonicalValue + Number.EPSILON) * 10) / 10;
	return `${formatNumber(
		rounded,
		Number.isInteger(rounded) ? 0 : 1,
		locale,
		true,
	)} bpm`;
}

/**
 * The change counterpart of `formatIntrinsicMeasurement`. Sub-minute durations
 * are reported in seconds, since whole-minute rounding renders them as `0 m`.
 * Returns null when the change rounds away entirely.
 */
export function formatIntrinsicDelta(
	magnitude: number,
	dimension: IntrinsicDimension,
	locale?: string,
): string | null {
	assertCanonicalValue(magnitude);

	if (dimension === "time") {
		if (magnitude < 60) {
			const seconds = Math.round(magnitude);
			return seconds === 0
				? null
				: `${formatNumber(seconds, 0, locale, true)} s`;
		}
		return formatIntrinsicMeasurement(magnitude, dimension, locale);
	}
	if (dimension === "count") {
		return Math.round(magnitude) === 0
			? null
			: formatIntrinsicMeasurement(magnitude, dimension, locale);
	}
	return Math.round((magnitude + Number.EPSILON) * 10) === 0
		? null
		: formatIntrinsicMeasurement(magnitude, dimension, locale);
}
