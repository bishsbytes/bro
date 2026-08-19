import {
	type CompoundDisplayUnit,
	type DisplayUnit,
	isCompoundDisplayUnit,
} from "@bro/domain";
import type { KeyboardTypeOptions } from "react-native";

/** Entry examples for the units typed as two parts rather than one number. */
const COMPOUND_EXAMPLES: Record<CompoundDisplayUnit, string> = {
	st: "e.g. 12 st 4 lb",
	ft: "e.g. 5 ft 11 in",
};

/**
 * Compound units are typed with their unit names, so a digits-only keyboard
 * cannot enter them. Every measurement field routes its keyboard through here
 * so a new compound unit reaches all of them at once.
 */
export function measurementKeyboardType(
	unit: DisplayUnit | null,
): KeyboardTypeOptions {
	return unit !== null && isCompoundDisplayUnit(unit)
		? "default"
		: "decimal-pad";
}

export function compoundUnitExample(
	unit: DisplayUnit | null,
): string | undefined {
	return unit !== null && isCompoundDisplayUnit(unit)
		? COMPOUND_EXAMPLES[unit]
		: undefined;
}
