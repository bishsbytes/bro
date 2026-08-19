import { fromCanonical, INCHES_PER_FOOT, POUNDS_PER_STONE } from "./conversion";
import type {
	CompoundDisplayUnit,
	Dimension,
	DisplayUnitForDimension,
	SimpleDisplayUnit,
} from "./dimensions";

/**
 * How a compound unit divides. `12 st 4 lb` is a whole part counted in the
 * compound unit itself and a remainder counted in its minor unit, so a value is
 * only ever ambiguous if the remainder is allowed to reach a whole major.
 */
export type CompoundUnitParts = {
	minor: SimpleDisplayUnit;
	minorsPerMajor: number;
};

export const COMPOUND_UNIT_PARTS = {
	st: { minor: "lb", minorsPerMajor: POUNDS_PER_STONE },
	ft: { minor: "in", minorsPerMajor: INCHES_PER_FOOT },
} as const satisfies Record<CompoundDisplayUnit, CompoundUnitParts>;

/**
 * The fields a measurement is typed into. Simple units fill `major` alone and
 * leave `minor` empty; compound units use both.
 */
export type MeasurementEntry = {
	major: string;
	minor: string;
};

/** The two whole numbers a person reads and types for a compound unit. */
export function toCompoundParts<D extends Dimension>(
	canonicalValue: number,
	dimension: D,
	unit: CompoundDisplayUnit,
): { major: number; minor: number } {
	const { minor, minorsPerMajor } = COMPOUND_UNIT_PARTS[unit];
	const totalMinor = Math.round(
		fromCanonical(
			canonicalValue,
			dimension,
			minor as DisplayUnitForDimension<D>,
		),
	);
	return {
		major: Math.floor(totalMinor / minorsPerMajor),
		minor: totalMinor % minorsPerMajor,
	};
}

/** Recombines the parts into a single value in the compound unit. */
export function fromCompoundParts(
	major: number,
	minor: number,
	unit: CompoundDisplayUnit,
): number {
	return major + minor / COMPOUND_UNIT_PARTS[unit].minorsPerMajor;
}
