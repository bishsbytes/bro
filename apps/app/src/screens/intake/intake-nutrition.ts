import type { ConsumableKind } from "@bro/domain/consumable";

/** Portion words offered per kind before the user's own portions are added. */
export const PORTION_SUGGESTIONS = {
	food: [
		"portion",
		"serving",
		"piece",
		"slice",
		"bowl",
		"plate",
		"cup",
		"tablespoon",
		"teaspoon",
		"handful",
		"bar",
		"pot",
	],
	drink: [
		"portion",
		"glass",
		"mug",
		"cup",
		"bottle",
		"can",
		"carton",
		"pint",
		"shot",
	],
	supplement: ["portion", "tablet", "capsule", "scoop", "drop"],
	medication: ["portion", "tablet", "capsule", "drop"],
	nicotine: ["portion", "cigarette", "puff"],
	other: ["portion", "serving", "piece"],
} as const satisfies Record<ConsumableKind, readonly string[]>;

export const NUTRITION_UNITS = {
	energyKcal: "kcal",
	proteinG: "g",
	carbohydrateG: "g",
	fatG: "g",
	fluidMl: "ml",
	abvPercent: "%",
	caffeineMg: "mg",
	nicotineMg: "mg",
} as const;

/** Maps a label input onto its `intake:nutrition.*` and `intake:free.*` key. */
export const NUTRITION_LABELS = {
	energyKcal: "energy",
	proteinG: "protein",
	carbohydrateG: "carbohydrate",
	fatG: "fat",
	fluidMl: "fluid",
	abvPercent: "abv",
	caffeineMg: "caffeine",
	nicotineMg: "nicotine",
} as const;

export function isPositiveNumber(value: string): boolean {
	const number = Number(value);
	return value.trim() !== "" && Number.isFinite(number) && number > 0;
}
