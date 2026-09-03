import type { DisplayUnit, UnitPreferenceDimension } from "../units";
import type { ConstituentAmounts } from "./food-search";

export { type ConstituentAmounts, isConstituentAmounts } from "./food-search";

/**
 * What a consumable can contain, as authored content.
 *
 * A constituent is a single quantity a thing you take in can deliver — energy,
 * a macronutrient, a stimulant, a vitamin. It is the observations-not-a-wide-row
 * argument applied to what a consumable contains: an intake event stores one
 * map of `code → canonical amount`, and adding a constituent is a new entry
 * here, never a migration. Codes are permanent once authored; unknown codes are
 * preserved by every reader and summed by none, the same posture as an unknown
 * metric slug.
 *
 * The registry's intake metrics are generated from this list, one per
 * constituent with slug `<code>_intake`. Nothing here names that slug.
 *
 * **Every code, unit, and display choice below is a sign-off item.**
 */
export type ConstituentCategory =
	| "energy"
	| "macronutrient"
	| "micronutrient"
	| "hydration"
	| "stimulant"
	| "alcohol"
	| "supplement"
	| "medication"
	| "other";

export const CONSTITUENT_CATEGORIES = [
	"energy",
	"macronutrient",
	"micronutrient",
	"hydration",
	"stimulant",
	"alcohol",
	"supplement",
	"medication",
	"other",
] as const satisfies readonly ConstituentCategory[];

/** Canonical storage follows the dimension: kilograms, litres, kilocalories. */
export type ConstituentDimension = "mass" | "volume" | "energy";

export type ConstituentDisplay =
	| { fixedDisplayUnit: DisplayUnit }
	| { unitPreferenceDimension: UnitPreferenceDimension };

export type ConstituentDefinition = {
	/** Permanent: "protein", "caffeine", "vitamin_d". */
	code: string;
	/** The constituent's own name, as a composition editor shows it. */
	label: string;
	/**
	 * The name its generated metric takes where the bare label would collide
	 * with another metric ("Energy" is already the scored check-in prompt).
	 */
	metricLabel?: string;
	category: ConstituentCategory;
	dimension: ConstituentDimension;
	display: ConstituentDisplay;
	/** Excluded from export with sensitive data off, with its metric's rows. */
	sensitive: boolean;
	/** Whether community content may carry it (Phase 9); enforced by content. */
	publishable: boolean;
	defaultPosition: number;
};

export const MILLIGRAMS_PER_KILOGRAM = 1_000_000;
export const MICROGRAMS_PER_KILOGRAM = 1_000_000_000;
export const GRAMS_PER_KILOGRAM = 1_000;

function assertAuthoredAmount(value: number, label: string): void {
	if (!Number.isFinite(value) || value < 0) {
		throw new RangeError(`${label} must be finite and non-negative.`);
	}
}

/**
 * Authoring helpers. Content is written in the unit a label prints and divided
 * into canonical kilograms rather than written as kilogram literals: `0.8e-6`
 * is not the nearest double to 0.8 mg and does not survive the round trip back,
 * which would put noise into the very numbers a sign-off pins.
 */
export function gramsToKg(grams: number): number {
	assertAuthoredAmount(grams, "Mass");
	return grams / GRAMS_PER_KILOGRAM;
}

export function milligramsToKg(milligrams: number): number {
	assertAuthoredAmount(milligrams, "Mass");
	return milligrams / MILLIGRAMS_PER_KILOGRAM;
}

export function microgramsToKg(micrograms: number): number {
	assertAuthoredAmount(micrograms, "Mass");
	return micrograms / MICROGRAMS_PER_KILOGRAM;
}

const define = <Code extends string>(
	code: Code,
	label: string,
	category: ConstituentCategory,
	dimension: ConstituentDimension,
	display: ConstituentDisplay,
	defaultPosition: number,
	options: {
		metricLabel?: string;
		sensitive?: boolean;
		publishable?: boolean;
	} = {},
): ConstituentDefinition & { code: Code } => ({
	code,
	label,
	...(options.metricLabel === undefined
		? {}
		: { metricLabel: options.metricLabel }),
	category,
	dimension,
	display,
	sensitive: options.sensitive ?? false,
	publishable: options.publishable ?? true,
	defaultPosition,
});

/**
 * Provisional v1 content. Energy and the macros lead because a quick custom
 * food stays quick; the micronutrients sit behind "More nutrients" in the
 * editor but are first-class here so a provider result can carry them from the
 * first event written on this model.
 */
export const CONSTITUENT_CATALOGUE = [
	define(
		"energy",
		"Energy",
		"energy",
		"energy",
		{ fixedDisplayUnit: "kcal" },
		0,
		{
			metricLabel: "Energy intake",
		},
	),
	define(
		"protein",
		"Protein",
		"macronutrient",
		"mass",
		{ fixedDisplayUnit: "g" },
		1,
	),
	define(
		"carbohydrate",
		"Carbohydrate",
		"macronutrient",
		"mass",
		{ fixedDisplayUnit: "g" },
		2,
	),
	define("fat", "Fat", "macronutrient", "mass", { fixedDisplayUnit: "g" }, 3),
	define(
		"saturated_fat",
		"Saturated fat",
		"macronutrient",
		"mass",
		{ fixedDisplayUnit: "g" },
		4,
	),
	define(
		"sugar",
		"Sugar",
		"macronutrient",
		"mass",
		{ fixedDisplayUnit: "g" },
		5,
	),
	define(
		"fibre",
		"Fibre",
		"macronutrient",
		"mass",
		{ fixedDisplayUnit: "g" },
		6,
	),
	// Sodium is stored as sodium mass; the preference decides whether it reads
	// as milligrams of sodium or grams of salt, the way a UK label does.
	define(
		"sodium",
		"Sodium",
		"micronutrient",
		"mass",
		{ unitPreferenceDimension: "sodium" },
		7,
	),
	// Fluid is a constituent like any other: a drink authored per 100 ml carries
	// `fluid: 0.1 l` by construction, so a smoothie's fluid adds up from its
	// milk and juice and the totals engine has no special case for volume.
	define(
		"fluid",
		"Fluid",
		"hydration",
		"volume",
		{ unitPreferenceDimension: "volume" },
		8,
		{
			metricLabel: "Fluid intake",
		},
	),
	define(
		"caffeine",
		"Caffeine",
		"stimulant",
		"mass",
		{ fixedDisplayUnit: "mg" },
		9,
	),
	define(
		"nicotine",
		"Nicotine",
		"stimulant",
		"mass",
		{ fixedDisplayUnit: "mg" },
		10,
		{
			sensitive: true,
			publishable: false,
		},
	),
	define(
		"ethanol",
		"Alcohol",
		"alcohol",
		"mass",
		{ unitPreferenceDimension: "alcohol" },
		11,
		{ sensitive: true },
	),
	define(
		"creatine",
		"Creatine",
		"supplement",
		"mass",
		{ fixedDisplayUnit: "g" },
		12,
	),
	define(
		"vitamin_a",
		"Vitamin A",
		"micronutrient",
		"mass",
		{ fixedDisplayUnit: "µg" },
		13,
	),
	define(
		"vitamin_d",
		"Vitamin D",
		"micronutrient",
		"mass",
		{ fixedDisplayUnit: "µg" },
		14,
	),
	define(
		"vitamin_b12",
		"Vitamin B12",
		"micronutrient",
		"mass",
		{ fixedDisplayUnit: "µg" },
		15,
	),
	define(
		"folate",
		"Folate",
		"micronutrient",
		"mass",
		{ fixedDisplayUnit: "µg" },
		16,
	),
	define(
		"vitamin_c",
		"Vitamin C",
		"micronutrient",
		"mass",
		{ fixedDisplayUnit: "mg" },
		17,
	),
	define(
		"calcium",
		"Calcium",
		"micronutrient",
		"mass",
		{ fixedDisplayUnit: "mg" },
		18,
	),
	define(
		"iron",
		"Iron",
		"micronutrient",
		"mass",
		{ fixedDisplayUnit: "mg" },
		19,
	),
	define(
		"magnesium",
		"Magnesium",
		"micronutrient",
		"mass",
		{ fixedDisplayUnit: "mg" },
		20,
	),
	define(
		"potassium",
		"Potassium",
		"micronutrient",
		"mass",
		{ fixedDisplayUnit: "mg" },
		21,
	),
	define(
		"zinc",
		"Zinc",
		"micronutrient",
		"mass",
		{ fixedDisplayUnit: "mg" },
		22,
	),
] as const satisfies readonly ConstituentDefinition[];

export type ConstituentCode = (typeof CONSTITUENT_CATALOGUE)[number]["code"];

export const CONSTITUENT_CODES = CONSTITUENT_CATALOGUE.map(
	(constituent) => constituent.code,
) as readonly ConstituentCode[];

const constituentsByCode = new Map<string, ConstituentDefinition>(
	CONSTITUENT_CATALOGUE.map((constituent) => [constituent.code, constituent]),
);

/** Unknown codes resolve to null forever, so a future build's data never throws. */
export function resolveConstituent(code: string): ConstituentDefinition | null {
	return constituentsByCode.get(code) ?? null;
}

export function isConstituentCode(code: string): code is ConstituentCode {
	return constituentsByCode.has(code);
}

export function listConstituents(
	category?: ConstituentCategory,
): ConstituentDefinition[] {
	return CONSTITUENT_CATALOGUE.filter(
		(constituent) =>
			category === undefined || constituent.category === category,
	);
}

export const SENSITIVE_CONSTITUENT_CODES = CONSTITUENT_CATALOGUE.filter(
	(constituent) => constituent.sensitive,
).map((constituent) => constituent.code) as readonly ConstituentCode[];

/**
 * Whether a composition delivers any sensitive substance. Keyed on content
 * rather than on kind, so a sensitive constituent reaching an event through
 * any journey is caught, and the next sensitive substance adds a definition
 * here rather than a clause anywhere else.
 */
export function carriesSensitiveConstituent(
	amounts: ConstituentAmounts,
): boolean {
	return SENSITIVE_CONSTITUENT_CODES.some((code) => (amounts[code] ?? 0) > 0);
}

/** Rejects a map a repository must never store: non-finite or negative amounts. */
export function assertConstituentAmounts(
	amounts: ConstituentAmounts,
	label = "Constituent amount",
): void {
	for (const [code, amount] of Object.entries(amounts)) {
		if (!code.trim()) {
			throw new TypeError("Constituent codes must not be empty.");
		}
		if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
			throw new RangeError(`${label} ${code} must be finite and non-negative.`);
		}
	}
}
