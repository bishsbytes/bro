import {
	addConstituents,
	calculateRecipeComposition,
	PortionSelectionError,
	portionFactor,
	type RecipeIngredientSnapshot,
	scaleComposition,
	scaleConstituents,
} from "./composition";
import type { ConsumableComposition } from "./consumable";
import { PER_100_G, PER_100_ML } from "./consumable";
import { resolveDrink } from "./drink-catalogue";
import { resolveNicotineEntry } from "./nicotine-catalogue";

const banana: ConsumableComposition = {
	basis: PER_100_G,
	constituents: { energy: 89, carbohydrate: 0.0228, potassium: 0.000_358 },
	portions: [
		{
			id: "medium",
			label: "1 medium",
			massKg: 0.118,
			volumeL: null,
			basisUnits: null,
		},
		{
			id: "cup",
			label: "1 cup, sliced",
			massKg: null,
			volumeL: 0.24,
			basisUnits: null,
		},
	],
	defaultPortionId: "medium",
};

const vitaminD: ConsumableComposition = {
	basis: { type: "portion", portionId: "tablet" },
	constituents: { vitamin_d: 2.5e-8 },
	portions: [
		{
			id: "tablet",
			label: "tablet",
			massKg: null,
			volumeL: null,
			basisUnits: 1,
		},
		{
			id: "pack",
			label: "pack of two",
			massKg: null,
			volumeL: null,
			basisUnits: 2,
		},
	],
	defaultPortionId: "tablet",
};

describe("composition scaling", () => {
	it("scales a per-100-g food by its portion's weight", () => {
		const scaled = scaleComposition(banana, {
			type: "portion",
			portionId: "medium",
			quantity: 1,
		});
		expect(scaled.factor).toBeCloseTo(1.18, 12);
		expect(scaled.constituents.energy).toBeCloseTo(105.02, 9);
		expect(scaled.constituents.carbohydrate).toBeCloseTo(0.026_904, 12);
		expect(scaled).toMatchObject({
			massKg: 0.118,
			volumeL: null,
			portionLabel: "1 medium",
			quantity: 1,
		});
		// Direct weight, where the basis is mass.
		expect(portionFactor(banana, { type: "mass", massKg: 0.05 })).toBeCloseTo(
			0.5,
			12,
		);
		expect(
			scaleComposition(banana, { type: "mass", massKg: 0.2 }),
		).toMatchObject({
			massKg: 0.2,
			volumeL: null,
			portionLabel: null,
			quantity: 1,
		});
	});

	it("scales a per-portion supplement by basis multiples", () => {
		expect(
			portionFactor(vitaminD, {
				type: "portion",
				portionId: "tablet",
				quantity: 2,
			}),
		).toBe(2);
		expect(
			portionFactor(vitaminD, {
				type: "portion",
				portionId: "pack",
				quantity: 1,
			}),
		).toBe(2);
		expect(
			scaleComposition(vitaminD, {
				type: "portion",
				portionId: "tablet",
				quantity: 2,
			}).constituents.vitamin_d,
		).toBeCloseTo(5e-8, 15);
	});

	it("scales the system catalogues through the same function", () => {
		const lager = resolveDrink("drink:lager-4_5");
		if (!lager) throw new Error("Expected lager.");
		const pint = scaleComposition(lager, {
			type: "portion",
			portionId: "pint-uk",
			quantity: 2,
		});
		expect(pint.volumeL).toBeCloseTo(1.136_522_5, 12);
		expect(pint.constituents.fluid).toBeCloseTo(1.136_522_5, 12);
		expect(pint.constituents.energy).toBeCloseTo(488.7, 1);
		expect(
			scaleComposition(lager, { type: "volume", volumeL: 0.5 }).factor,
		).toBe(5);

		const cigarette = resolveNicotineEntry("nicotine:cigarette");
		if (!cigarette) throw new Error("Expected cigarette.");
		expect(
			scaleComposition(cigarette, {
				type: "portion",
				portionId: "half",
				quantity: 3,
			}).constituents.nicotine,
		).toBeCloseTo(1.8e-6, 15);
	});

	it("rejects a selection it cannot relate to the basis, naming the field", () => {
		const cup = () =>
			portionFactor(banana, { type: "portion", portionId: "cup", quantity: 1 });
		expect(cup).toThrow(PortionSelectionError);
		expect(cup).toThrow("1 cup, sliced has no weight");
		try {
			cup();
		} catch (error) {
			expect((error as PortionSelectionError).field).toBe("portion");
		}
		expect(() =>
			portionFactor(vitaminD, { type: "mass", massKg: 0.001 }),
		).toThrow("measured per portion, so it cannot be logged by weight");
		expect(() =>
			portionFactor(banana, { type: "volume", volumeL: 0.1 }),
		).toThrow("measured per weight, so it cannot be logged by volume");
		expect(() =>
			portionFactor(banana, {
				type: "portion",
				portionId: "large",
				quantity: 1,
			}),
		).toThrow("not one of this item's portions");
		expect(() =>
			portionFactor(banana, {
				type: "portion",
				portionId: "medium",
				quantity: 0,
			}),
		).toThrow("Quantity must be a positive number.");
		expect(() => portionFactor(banana, { type: "mass", massKg: -1 })).toThrow(
			"Weight must be a positive number.",
		);
	});

	it("adds and scales maps while preserving unknown codes", () => {
		expect(
			addConstituents(
				{ energy: 10, future: 1 },
				{ energy: 5, protein: 0.001 },
				{},
			),
		).toEqual({ energy: 15, future: 1, protein: 0.001 });
		expect(scaleConstituents({ energy: 10, future: 2 }, 0.5)).toEqual({
			energy: 5,
			future: 1,
		});
		expect(() => scaleConstituents({ energy: 1 }, -1)).toThrow(
			"finite and non-negative",
		);
	});

	it("calculates a recipe per yield unit for counted and measured yields", () => {
		const ingredients: RecipeIngredientSnapshot[] = [
			{
				constituents: { energy: 120, protein: 0.008, calcium: 0.000_24 },
				massKg: 0.2,
				volumeL: 0.2,
			},
			{
				constituents: { energy: 105, carbohydrate: 0.027 },
				massKg: 0.118,
				volumeL: null,
			},
			{
				constituents: { energy: 120, protein: 0.024, creatine: 0.005 },
				massKg: 0.03,
				volumeL: null,
			},
		];
		const servings = calculateRecipeComposition(ingredients, {
			quantity: 2,
			unit: "serving",
		});
		expect(servings.basis).toEqual({ type: "portion", portionId: "serving" });
		expect(servings.constituents).toEqual({
			energy: 172.5,
			protein: 0.016,
			calcium: 0.000_12,
			carbohydrate: 0.0135,
			creatine: 0.0025,
		});
		expect(servings.portions).toEqual([
			{
				id: "serving",
				label: "serving",
				massKg: 0.174,
				volumeL: null,
				basisUnits: 1,
			},
		]);
		expect(servings.defaultPortionId).toBe("serving");
		expect(servings.batch).toEqual({
			constituents: {
				energy: 345,
				protein: 0.032,
				calcium: 0.000_24,
				carbohydrate: 0.027,
				creatine: 0.005,
			},
			massKg: 0.348,
			volumeL: null,
		});

		const grams = calculateRecipeComposition(ingredients, {
			quantity: 348,
			unit: "g",
		});
		expect(grams.basis).toEqual(PER_100_G);
		expect(grams.constituents.energy).toBeCloseTo(345 * (100 / 348), 9);
		expect(grams.portions).toEqual([]);
		expect(grams.defaultPortionId).toBeNull();

		const millilitres = calculateRecipeComposition(ingredients, {
			quantity: 500,
			unit: "ml",
		});
		expect(millilitres.basis).toEqual(PER_100_ML);
		expect(millilitres.constituents.energy).toBeCloseTo(69, 9);

		expect(() =>
			calculateRecipeComposition(ingredients, { quantity: 0, unit: "serving" }),
		).toThrow("positive quantity of a known unit");
		expect(
			calculateRecipeComposition([], { quantity: 1, unit: "glass" }),
		).toMatchObject({
			constituents: {},
			batch: { constituents: {}, massKg: null, volumeL: null },
		});
	});
});
