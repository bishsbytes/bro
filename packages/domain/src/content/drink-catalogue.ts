import { ETHANOL_DENSITY_G_PER_ML } from "../units/conversion";
import {
	type ConstituentAmounts,
	milligramsToKg,
} from "./constituent-catalogue";
import type { ConsumableKind, Portion, SystemConsumable } from "./consumable";
import { PER_100_ML } from "./consumable";

export { ETHANOL_DENSITY_G_PER_ML } from "../units/conversion";

/** Groups the browse list; not a consumable kind — every drink is `drink`. */
export type DrinkCategory = "alcoholic" | "caffeinated" | "hydration";

export type DrinkCatalogueEntry = SystemConsumable & {
	key: `drink:${string}`;
	kind: "drink";
	category: DrinkCategory;
};

/** Exact imperial pint; portions own regional definitions, totals do not. */
export const UK_PINT_L = 0.568_261_25;
export const UK_HALF_PINT_L = UK_PINT_L / 2;
/** Exact US customary 12 fl oz serving. */
export const US_TWELVE_FL_OZ_L = 0.354_882_354_75;
/** Exact US customary 5 fl oz wine serving. */
export const US_FIVE_FL_OZ_L = 0.147_867_647_812_5;
/** Exact US customary 1.5 fl oz spirit serving. */
export const US_ONE_AND_A_HALF_FL_OZ_L = 0.044_360_294_343_75;
/** Exact US customary 8 fl oz cup. */
export const US_EIGHT_FL_OZ_L = 0.236_588_236_5;

function assertNonNegative(value: number, label: string): void {
	if (!Number.isFinite(value) || value < 0) {
		throw new RangeError(`${label} must be finite and non-negative.`);
	}
}

export function ethanolKgFromVolumeAndAbv(
	volumeL: number,
	abvPercent: number,
): number {
	assertNonNegative(volumeL, "Drink volume");
	assertNonNegative(abvPercent, "Drink ABV");
	if (abvPercent > 100) {
		throw new RangeError("Drink ABV must not exceed 100%.");
	}
	return (
		(volumeL * 1_000 * (abvPercent / 100) * ETHANOL_DENSITY_G_PER_ML) / 1_000
	);
}

/**
 * A drink's composition per 100 ml, authored in the figures a label prints —
 * ABV, caffeine in milligrams, kilocalories — so what is signed off is what is
 * read. Fluid is `0.1 l` by construction; ethanol and caffeine are present as
 * zero on a drink that has none, because "measured as none" is a fact about a
 * drink and lets a water-only day read as an alcohol-free day rather than an
 * unlogged one.
 */
export function drinkComposition({
	abvPercent,
	caffeineMgPer100ml,
	kcalPer100ml,
}: {
	abvPercent: number;
	caffeineMgPer100ml: number;
	kcalPer100ml: number;
}): ConstituentAmounts {
	assertNonNegative(kcalPer100ml, "Drink energy");
	return {
		fluid: PER_100_ML.volumeL,
		ethanol: ethanolKgFromVolumeAndAbv(PER_100_ML.volumeL, abvPercent),
		caffeine: milligramsToKg(caffeineMgPer100ml),
		energy: kcalPer100ml,
	};
}

function volume(id: string, label: string, volumeL: number): Portion {
	return { id, label, massKg: null, volumeL, basisUnits: null };
}

function drink(
	key: `drink:${string}`,
	name: string,
	category: DrinkCategory,
	composition: Parameters<typeof drinkComposition>[0],
	portions: readonly Portion[],
): DrinkCatalogueEntry {
	const defaultPortion = portions[0];
	if (!defaultPortion) {
		throw new RangeError(`${key} must offer at least one portion.`);
	}
	return {
		key,
		kind: "drink" satisfies ConsumableKind,
		name,
		category,
		basis: PER_100_ML,
		constituents: drinkComposition(composition),
		portions,
		defaultPortionId: defaultPortion.id,
	};
}

/**
 * Authored, offline drink content, per 100 ml with regional portions. A log
 * action snapshots the scaled composition, so edits or removals here never
 * change an existing intake event.
 *
 * **Every figure is a sign-off item.** The per-100-ml values round the
 * per-serving figures the earlier catalogue carried; the pinned test is what
 * fixes them.
 */
export const DRINK_CATALOGUE = [
	drink(
		"drink:lager-4_5",
		"Lager, 4.5%",
		"alcoholic",
		{ abvPercent: 4.5, caffeineMgPer100ml: 0, kcalPer100ml: 43 },
		[
			volume("pint-uk", "pint", UK_PINT_L),
			volume("half-pint-uk", "half pint", UK_HALF_PINT_L),
			volume("can-330ml", "330 ml can", 0.33),
			volume("can-440ml", "440 ml can", 0.44),
			volume("bottle-12floz-us", "12 fl oz bottle", US_TWELVE_FL_OZ_L),
		],
	),
	drink(
		"drink:cider-4_5",
		"Cider, 4.5%",
		"alcoholic",
		{ abvPercent: 4.5, caffeineMgPer100ml: 0, kcalPer100ml: 42 },
		[
			volume("pint-uk", "pint", UK_PINT_L),
			volume("half-pint-uk", "half pint", UK_HALF_PINT_L),
			volume("can-440ml", "440 ml can", 0.44),
			volume("bottle-12floz-us", "12 fl oz bottle", US_TWELVE_FL_OZ_L),
		],
	),
	drink(
		"drink:wine-red-13",
		"Red wine, 13%",
		"alcoholic",
		{ abvPercent: 13, caffeineMgPer100ml: 0, kcalPer100ml: 85 },
		[
			volume("glass-125ml", "125 ml glass", 0.125),
			volume("glass-175ml", "175 ml glass", 0.175),
			volume("glass-250ml", "250 ml glass", 0.25),
			volume("glass-5floz-us", "5 fl oz glass", US_FIVE_FL_OZ_L),
		],
	),
	drink(
		"drink:wine-white-12",
		"White wine, 12%",
		"alcoholic",
		{ abvPercent: 12, caffeineMgPer100ml: 0, kcalPer100ml: 82 },
		[
			volume("glass-125ml", "125 ml glass", 0.125),
			volume("glass-175ml", "175 ml glass", 0.175),
			volume("glass-250ml", "250 ml glass", 0.25),
			volume("glass-5floz-us", "5 fl oz glass", US_FIVE_FL_OZ_L),
		],
	),
	drink(
		"drink:spirit-40",
		"Spirit, 40%",
		"alcoholic",
		{ abvPercent: 40, caffeineMgPer100ml: 0, kcalPer100ml: 222 },
		[
			volume("single-25ml", "25 ml single", 0.025),
			volume("double-50ml", "50 ml double", 0.05),
			volume("shot-1_5floz-us", "1.5 fl oz shot", US_ONE_AND_A_HALF_FL_OZ_L),
		],
	),
	drink(
		"drink:filter-coffee",
		"Filter coffee",
		"caffeinated",
		{ abvPercent: 0, caffeineMgPer100ml: 40, kcalPer100ml: 1 },
		[
			volume("mug-250ml", "250 ml mug", 0.25),
			volume("cup-8floz-us", "8 fl oz cup", US_EIGHT_FL_OZ_L),
		],
	),
	drink(
		"drink:tea",
		"Tea",
		"caffeinated",
		{ abvPercent: 0, caffeineMgPer100ml: 19, kcalPer100ml: 1 },
		[
			volume("mug-250ml", "250 ml mug", 0.25),
			volume("cup-8floz-us", "8 fl oz cup", US_EIGHT_FL_OZ_L),
		],
	),
	drink(
		"drink:espresso",
		"Espresso",
		"caffeinated",
		{ abvPercent: 0, caffeineMgPer100ml: 210, kcalPer100ml: 7 },
		[
			volume("single-30ml", "30 ml single", 0.03),
			volume("double-60ml", "60 ml double", 0.06),
		],
	),
	drink(
		"drink:energy-drink",
		"Energy drink",
		"caffeinated",
		{ abvPercent: 0, caffeineMgPer100ml: 32, kcalPer100ml: 44 },
		[volume("can-250ml", "250 ml can", 0.25)],
	),
	drink(
		"drink:cola",
		"Cola",
		"caffeinated",
		{ abvPercent: 0, caffeineMgPer100ml: 10, kcalPer100ml: 42 },
		[
			volume("can-330ml", "330 ml can", 0.33),
			volume("can-12floz-us", "12 fl oz can", US_TWELVE_FL_OZ_L),
		],
	),
	drink(
		"drink:water",
		"Water",
		"hydration",
		{ abvPercent: 0, caffeineMgPer100ml: 0, kcalPer100ml: 0 },
		[
			volume("glass-250ml", "250 ml glass", 0.25),
			volume("bottle-500ml", "500 ml bottle", 0.5),
			volume("glass-8floz-us", "8 fl oz glass", US_EIGHT_FL_OZ_L),
		],
	),
] as const satisfies readonly DrinkCatalogueEntry[];

const drinksByKey = new Map<string, DrinkCatalogueEntry>(
	DRINK_CATALOGUE.map((entry) => [entry.key, entry]),
);

/** Unknown keys resolve to null forever, so removed content never throws. */
export function resolveDrink(key: string): DrinkCatalogueEntry | null {
	return drinksByKey.get(key) ?? null;
}
