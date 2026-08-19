export const DIMENSIONS = ["mass", "length", "fraction"] as const;

/** Dimensions with a user-selectable display unit. */
export type Dimension = (typeof DIMENSIONS)[number];

/** Dimensions whose canonical unit is also their fixed v1 display form. */
export const INTRINSIC_DIMENSIONS = ["time", "count", "rate_bpm"] as const;
export type IntrinsicDimension = (typeof INTRINSIC_DIMENSIONS)[number];

export const METRIC_DIMENSIONS = [
	...DIMENSIONS,
	...INTRINSIC_DIMENSIONS,
] as const;
export type MetricDimension = (typeof METRIC_DIMENSIONS)[number];

export type MassDisplayUnit = "kg" | "lb" | "st";
export type LengthDisplayUnit = "cm" | "in" | "ft";
export type FractionDisplayUnit = "%";
export type DisplayUnit =
	| MassDisplayUnit
	| LengthDisplayUnit
	| FractionDisplayUnit;

type DisplayUnitByDimension = {
	mass: MassDisplayUnit;
	length: LengthDisplayUnit;
	fraction: FractionDisplayUnit;
};

export type DisplayUnitForDimension<D extends Dimension> =
	DisplayUnitByDimension[D];

export const CANONICAL_STORAGE_UNITS = {
	mass: "kg",
	length: "m",
	fraction: "fraction",
	time: "s",
	count: "count",
	rate_bpm: "bpm",
} as const satisfies Record<MetricDimension, string>;

export const DISPLAY_UNITS_BY_DIMENSION = {
	mass: ["kg", "lb", "st"],
	length: ["cm", "in", "ft"],
	fraction: ["%"],
} as const satisfies {
	[D in Dimension]: readonly DisplayUnitForDimension<D>[];
};

/**
 * Preference dimensions describe how a person thinks about a measurement,
 * rather than how its canonical value is stored. Height and circumference are
 * both lengths in storage, but deliberately have independent display choices.
 */
export const UNIT_PREFERENCE_DIMENSIONS = [
	"mass",
	"height",
	"length",
	"fraction",
] as const;
export type UnitPreferenceDimension =
	(typeof UNIT_PREFERENCE_DIMENSIONS)[number];

type DisplayUnitByPreferenceDimension = {
	mass: MassDisplayUnit;
	height: "cm" | "ft";
	length: "cm" | "in";
	fraction: FractionDisplayUnit;
};

export type DisplayUnitForPreferenceDimension<
	D extends UnitPreferenceDimension,
> = DisplayUnitByPreferenceDimension[D];

export const DISPLAY_UNITS_BY_PREFERENCE_DIMENSION = {
	mass: ["kg", "lb", "st"],
	height: ["cm", "ft"],
	length: ["cm", "in"],
	fraction: ["%"],
} as const satisfies {
	[D in UnitPreferenceDimension]: readonly DisplayUnitForPreferenceDimension<D>[];
};

export const DIMENSION_BY_UNIT_PREFERENCE = {
	mass: "mass",
	height: "length",
	length: "length",
	fraction: "fraction",
} as const satisfies Record<UnitPreferenceDimension, Dimension>;

export const FALLBACK_DISPLAY_UNITS_BY_PREFERENCE_DIMENSION = {
	mass: "kg",
	height: "cm",
	length: "cm",
	fraction: "%",
} as const satisfies {
	[D in UnitPreferenceDimension]: DisplayUnitForPreferenceDimension<D>;
};

/**
 * Units written as a major and a minor part (`12 st 4 lb`, `5 ft 11 in`). They
 * are composed on display and parsed as a pair, and their text entry needs a
 * keyboard that can type the unit names.
 */
export const COMPOUND_DISPLAY_UNITS = ["st", "ft"] as const;
export type CompoundDisplayUnit = (typeof COMPOUND_DISPLAY_UNITS)[number];
export type SimpleDisplayUnit = Exclude<DisplayUnit, CompoundDisplayUnit>;

/** Compound `st` and `ft` resolutions are expressed in pounds and inches. */
export const DISPLAY_RESOLUTIONS = {
	kg: 0.1,
	lb: 0.2,
	st: 1,
	cm: 0.5,
	in: 0.25,
	ft: 1,
	"%": 0.1,
} as const satisfies Record<DisplayUnit, number>;

export function isDisplayUnitForDimension<D extends Dimension>(
	dimension: D,
	unit: string,
): unit is DisplayUnitForDimension<D> {
	return (DISPLAY_UNITS_BY_DIMENSION[dimension] as readonly string[]).includes(
		unit,
	);
}

export function isCompoundDisplayUnit(
	unit: DisplayUnit,
): unit is CompoundDisplayUnit {
	return (COMPOUND_DISPLAY_UNITS as readonly string[]).includes(unit);
}

export function isDisplayUnitForPreferenceDimension<
	D extends UnitPreferenceDimension,
>(dimension: D, unit: string): unit is DisplayUnitForPreferenceDimension<D> {
	return (
		DISPLAY_UNITS_BY_PREFERENCE_DIMENSION[dimension] as readonly string[]
	).includes(unit);
}
