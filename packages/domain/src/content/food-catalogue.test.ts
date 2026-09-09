import { scaleComposition } from "./composition";
import { assertConsumableComposition } from "./consumable";
import { FOOD_CATALOGUE, resolveFood } from "./food-catalogue";
import { listSystemConsumables } from "./system-consumables";

describe("food catalogue", () => {
	it("authors a small, valid food starter set with permanent keys", () => {
		expect(FOOD_CATALOGUE.map((food) => food.key)).toEqual([
			"food:eggs-on-toast",
			"food:porridge",
		]);
		for (const food of FOOD_CATALOGUE) {
			expect(food.kind).toBe("food");
			expect(food.name.trim()).toBe(food.name);
			expect(food.basis).toEqual({
				type: "portion",
				portionId: "serving",
			});
			expect(food.defaultPortionId).toBe("serving");
			expect(() => assertConsumableComposition(food)).not.toThrow();
		}
		expect(listSystemConsumables("food")).toEqual(FOOD_CATALOGUE);
	});

	it("pins the generic per-serving estimates and scales fractional servings", () => {
		expect(
			FOOD_CATALOGUE.map(({ key, constituents }) => [key, constituents]),
		).toEqual([
			[
				"food:eggs-on-toast",
				{
					energy: 209,
					protein: 0.011,
					carbohydrate: 0.024,
					fat: 0.0085,
					saturated_fat: 0.002,
					sugar: 0.008,
					fibre: 0.004,
				},
			],
			[
				"food:porridge",
				{
					energy: 214,
					protein: 0.0088,
					carbohydrate: 0.0356,
					fat: 0.0031,
					saturated_fat: 0.0006,
					sugar: 0.0124,
					fibre: 0.0043,
					sodium: 0.000057,
				},
			],
		]);

		const porridge = resolveFood("food:porridge");
		if (!porridge) throw new Error("Expected porridge.");
		expect(
			scaleComposition(porridge, {
				type: "portion",
				portionId: "serving",
				quantity: 0.5,
			}),
		).toMatchObject({
			quantity: 0.5,
			portionLabel: "serving",
			constituents: { energy: 107, protein: 0.0044 },
		});
	});

	it("tolerates unknown catalogue keys", () => {
		expect(resolveFood("food:removed-one-day")).toBeNull();
	});
});
