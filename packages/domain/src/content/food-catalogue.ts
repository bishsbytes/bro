import {
	type ConstituentAmounts,
	gramsToKg,
	milligramsToKg,
} from "./constituent-catalogue";
import type { Portion, SystemConsumable } from "./consumable";

export type FoodCatalogueEntry = SystemConsumable & {
	key: `food:${string}`;
	kind: "food";
};

function serving(): Portion {
	return {
		id: "serving",
		label: "serving",
		massKg: null,
		volumeL: null,
		basisUnits: 1,
	};
}

function food(
	key: `food:${string}`,
	name: string,
	constituents: ConstituentAmounts,
): FoodCatalogueEntry {
	const portion = serving();
	return {
		key,
		kind: "food",
		name,
		basis: { type: "portion", portionId: portion.id },
		constituents,
		portions: [portion],
		defaultPortionId: portion.id,
	};
}

/**
 * A small offline starter catalogue for foods people commonly log. These are
 * generic serving estimates rather than claims about a particular recipe or
 * product. Logging snapshots the values, and anyone who needs their own recipe
 * can fork an entry into the library and edit it there.
 *
 * The figures are authored in the units people read. They follow the per-
 * serving nutrition published for the NHS Healthier Families eggs paprika and
 * creamy banana porridge recipes, with absent nutrients left absent rather
 * than invented as zero.
 */
export const FOOD_CATALOGUE = [
	food("food:eggs-on-toast", "Eggs on toast", {
		energy: 209,
		protein: gramsToKg(11),
		carbohydrate: gramsToKg(24),
		fat: gramsToKg(8.5),
		saturated_fat: gramsToKg(2),
		sugar: gramsToKg(8),
		fibre: gramsToKg(4),
	}),
	food("food:porridge", "Porridge", {
		energy: 214,
		protein: gramsToKg(8.8),
		carbohydrate: gramsToKg(35.6),
		fat: gramsToKg(3.1),
		saturated_fat: gramsToKg(0.6),
		sugar: gramsToKg(12.4),
		fibre: gramsToKg(4.3),
		sodium: milligramsToKg(57),
	}),
] as const satisfies readonly FoodCatalogueEntry[];

const foodsByKey = new Map<string, FoodCatalogueEntry>(
	FOOD_CATALOGUE.map((entry) => [entry.key, entry]),
);

/** Unknown keys resolve to null forever, so removed content never throws. */
export function resolveFood(key: string): FoodCatalogueEntry | null {
	return foodsByKey.get(key) ?? null;
}
