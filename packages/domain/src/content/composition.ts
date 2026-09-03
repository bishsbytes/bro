import {
	assertConstituentAmounts,
	type ConstituentAmounts,
} from "./constituent-catalogue";
import {
	type ConsumableComposition,
	isRecipeYield,
	PER_100_G,
	PER_100_ML,
	type Portion,
	type RecipeYield,
} from "./consumable";

/**
 * The arithmetic between a composition and what was actually taken. Pure, and
 * in the domain package rather than `@bro/logic` because the consumable
 * repository has to recompute a recipe inside the transaction that changes
 * its ingredients, and data access may depend on domain and model only.
 */

/**
 * What a person picked: a portion so many times, or a mass or volume typed
 * directly where the basis allows it.
 */
export type PortionSelection =
	| { type: "portion"; portionId: string; quantity: number }
	| { type: "mass"; massKg: number }
	| { type: "volume"; volumeL: number };

/** Which input the log form should mark when a selection cannot be related. */
export type PortionSelectionField = "portion" | "quantity" | "mass" | "volume";

export class PortionSelectionError extends RangeError {
	constructor(
		message: string,
		readonly field: PortionSelectionField,
	) {
		super(message);
		this.name = "PortionSelectionError";
	}
}

export type ScaledComposition = {
	/** How many bases the selection is. */
	factor: number;
	/** The composition scaled to the selection — what an event snapshots. */
	constituents: ConstituentAmounts;
	/** Amount consumed, where the selection or its portion says. */
	massKg: number | null;
	volumeL: number | null;
	portionLabel: string | null;
	quantity: number;
};

function basisNoun(basis: ConsumableComposition["basis"]): string {
	return basis.type === "mass"
		? "weight"
		: basis.type === "volume"
			? "volume"
			: "portion";
}

function findPortion(
	composition: ConsumableComposition,
	portionId: string,
): Portion {
	const portion = composition.portions.find(
		(candidate) => candidate.id === portionId,
	);
	if (!portion) {
		throw new PortionSelectionError(
			`Portion ${portionId} is not one of this item's portions.`,
			"portion",
		);
	}
	return portion;
}

/**
 * How many bases a selection is. Throws, naming the field, when the selection
 * cannot be related to the basis: a weight typed for something measured per
 * portion, or a portion that carries no mass for a per-100-g item. Never
 * guesses.
 */
export function portionFactor(
	composition: ConsumableComposition,
	selection: PortionSelection,
): number {
	const { basis } = composition;
	if (selection.type === "mass") {
		if (!Number.isFinite(selection.massKg) || selection.massKg <= 0) {
			throw new PortionSelectionError(
				"Weight must be a positive number.",
				"mass",
			);
		}
		if (basis.type !== "mass") {
			throw new PortionSelectionError(
				`This item is measured per ${basisNoun(basis)}, so it cannot be logged by weight.`,
				"mass",
			);
		}
		return selection.massKg / basis.massKg;
	}
	if (selection.type === "volume") {
		if (!Number.isFinite(selection.volumeL) || selection.volumeL <= 0) {
			throw new PortionSelectionError(
				"Volume must be a positive number.",
				"volume",
			);
		}
		if (basis.type !== "volume") {
			throw new PortionSelectionError(
				`This item is measured per ${basisNoun(basis)}, so it cannot be logged by volume.`,
				"volume",
			);
		}
		return selection.volumeL / basis.volumeL;
	}
	if (!Number.isFinite(selection.quantity) || selection.quantity <= 0) {
		throw new PortionSelectionError(
			"Quantity must be a positive number.",
			"quantity",
		);
	}
	const portion = findPortion(composition, selection.portionId);
	if (basis.type === "mass") {
		if (portion.massKg === null) {
			throw new PortionSelectionError(
				`Portion ${portion.label} has no weight, and this item is measured per weight.`,
				"portion",
			);
		}
		return (selection.quantity * portion.massKg) / basis.massKg;
	}
	if (basis.type === "volume") {
		if (portion.volumeL === null) {
			throw new PortionSelectionError(
				`Portion ${portion.label} has no volume, and this item is measured per volume.`,
				"portion",
			);
		}
		return (selection.quantity * portion.volumeL) / basis.volumeL;
	}
	if (portion.basisUnits === null) {
		throw new PortionSelectionError(
			`Portion ${portion.label} is not a multiple of the portion this item is measured per.`,
			"portion",
		);
	}
	return selection.quantity * portion.basisUnits;
}

/** Scales every amount, preserving unknown codes. */
export function scaleConstituents(
	amounts: ConstituentAmounts,
	factor: number,
): ConstituentAmounts {
	if (!Number.isFinite(factor) || factor < 0) {
		throw new RangeError("Scale factor must be finite and non-negative.");
	}
	return Object.fromEntries(
		Object.entries(amounts).map(([code, amount]) => [code, amount * factor]),
	);
}

/**
 * Sums maps code-wise. A code present in any map is present in the result, so
 * an ingredient that carries fibre makes the recipe carry fibre; a code absent
 * from every map stays absent, which is the null-versus-zero distinction the
 * totals engine relies on.
 */
export function addConstituents(
	...maps: readonly ConstituentAmounts[]
): ConstituentAmounts {
	const total: Record<string, number> = {};
	for (const map of maps) {
		for (const [code, amount] of Object.entries(map)) {
			total[code] = (total[code] ?? 0) + amount;
		}
	}
	return total;
}

/** The constituent map, mass, and volume for a selection — what an event snapshots. */
export function scaleComposition(
	composition: ConsumableComposition,
	selection: PortionSelection,
): ScaledComposition {
	assertConstituentAmounts(composition.constituents);
	const factor = portionFactor(composition, selection);
	const constituents = scaleConstituents(composition.constituents, factor);
	if (selection.type === "mass") {
		return {
			factor,
			constituents,
			massKg: selection.massKg,
			volumeL: null,
			portionLabel: null,
			quantity: 1,
		};
	}
	if (selection.type === "volume") {
		return {
			factor,
			constituents,
			massKg: null,
			volumeL: selection.volumeL,
			portionLabel: null,
			quantity: 1,
		};
	}
	const portion = findPortion(composition, selection.portionId);
	const { basis } = composition;
	return {
		factor,
		constituents,
		massKg:
			portion.massKg !== null
				? portion.massKg * selection.quantity
				: basis.type === "mass"
					? factor * basis.massKg
					: null,
		volumeL:
			portion.volumeL !== null
				? portion.volumeL * selection.quantity
				: basis.type === "volume"
					? factor * basis.volumeL
					: null,
		portionLabel: portion.label,
		quantity: selection.quantity,
	};
}

/** What a recipe calculation reads from each ingredient's snapshot. */
export type RecipeIngredientSnapshot = {
	constituents: ConstituentAmounts;
	massKg: number | null;
	volumeL: number | null;
};

export type RecipeComposition = ConsumableComposition & {
	/** The whole batch, before dividing by the yield. */
	batch: RecipeIngredientSnapshot;
};

function sumKnown(values: readonly (number | null)[]): number | null {
	if (values.length === 0 || values.some((value) => value === null)) {
		return null;
	}
	return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

/**
 * A recipe's composition per yield unit, from its ingredients' snapshots. A
 * counted yield (servings, portions, glasses) gives a portion basis whose one
 * portion is the unit, so "half a serving" scales like any other portion; a
 * weighed or measured yield gives a per-100-g or per-100-ml basis, so "200 g
 * of the soup" scales through the same factor a label-derived food does.
 * Cycle detection is the repository's job at save.
 */
export function calculateRecipeComposition(
	ingredients: readonly RecipeIngredientSnapshot[],
	recipeYield: RecipeYield,
): RecipeComposition {
	if (!isRecipeYield(recipeYield)) {
		throw new RangeError(
			"Recipe yield must be a positive quantity of a known unit.",
		);
	}
	for (const ingredient of ingredients) {
		assertConstituentAmounts(ingredient.constituents, "Ingredient constituent");
	}
	const batch: RecipeIngredientSnapshot = {
		constituents: addConstituents(
			...ingredients.map((ingredient) => ingredient.constituents),
		),
		massKg: sumKnown(ingredients.map((ingredient) => ingredient.massKg)),
		volumeL: sumKnown(ingredients.map((ingredient) => ingredient.volumeL)),
	};
	if (recipeYield.unit === "g") {
		const yieldKg = recipeYield.quantity / 1_000;
		return {
			basis: PER_100_G,
			constituents: scaleConstituents(
				batch.constituents,
				PER_100_G.massKg / yieldKg,
			),
			portions: [],
			defaultPortionId: null,
			batch,
		};
	}
	if (recipeYield.unit === "ml") {
		const yieldL = recipeYield.quantity / 1_000;
		return {
			basis: PER_100_ML,
			constituents: scaleConstituents(
				batch.constituents,
				PER_100_ML.volumeL / yieldL,
			),
			portions: [],
			defaultPortionId: null,
			batch,
		};
	}
	const unit = recipeYield.unit;
	return {
		basis: { type: "portion", portionId: unit },
		constituents: scaleConstituents(
			batch.constituents,
			1 / recipeYield.quantity,
		),
		portions: [
			{
				id: unit,
				label: unit,
				massKg:
					batch.massKg === null ? null : batch.massKg / recipeYield.quantity,
				volumeL:
					batch.volumeL === null ? null : batch.volumeL / recipeYield.quantity,
				basisUnits: 1,
			},
		],
		defaultPortionId: unit,
		batch,
	};
}
