export const DIMENSIONS = ["mass", "length", "fraction"] as const;

export type Dimension = (typeof DIMENSIONS)[number];

export type MassDisplayUnit = "kg" | "lb" | "st";
export type LengthDisplayUnit = "cm" | "in";
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
} as const;

export const DISPLAY_UNITS_BY_DIMENSION = {
	mass: ["kg", "lb", "st"],
	length: ["cm", "in"],
	fraction: ["%"],
} as const satisfies {
	[D in Dimension]: readonly DisplayUnitForDimension<D>[];
};

/** Safe, non-locale fallback for a preference written by a future app version. */
export const FALLBACK_DISPLAY_UNITS = {
	mass: "kg",
	length: "cm",
	fraction: "%",
} as const satisfies { [D in Dimension]: DisplayUnitForDimension<D> };

/** `st` is resolved in its minor unit, so its value is whole pounds. */
export const DISPLAY_RESOLUTIONS = {
	kg: 0.1,
	lb: 0.2,
	st: 1,
	cm: 0.5,
	in: 0.25,
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
