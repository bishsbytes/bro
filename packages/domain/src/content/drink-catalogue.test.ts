import { formatMeasurement } from "../index";
import { assertConsumableComposition } from "./consumable";
import {
	DRINK_CATALOGUE,
	drinkComposition,
	ETHANOL_DENSITY_G_PER_ML,
	ethanolKgFromVolumeAndAbv,
	resolveDrink,
	UK_PINT_L,
} from "./drink-catalogue";

describe("drink catalogue", () => {
	it("authors every drink per 100 ml with unique keys and valid portions", () => {
		expect(new Set(DRINK_CATALOGUE.map((drink) => drink.key)).size).toBe(
			DRINK_CATALOGUE.length,
		);
		for (const drink of DRINK_CATALOGUE) {
			expect(drink.key).toMatch(/^drink:[a-z0-9_]+(?:-[a-z0-9_]+)*$/);
			expect(drink.kind).toBe("drink");
			expect(drink.name.trim()).toBe(drink.name);
			expect(drink.basis).toEqual({ type: "volume", volumeL: 0.1 });
			expect(drink.constituents.fluid).toBe(0.1);
			expect(drink.portions.length).toBeGreaterThan(0);
			expect(drink.defaultPortionId).toBe(drink.portions[0]?.id);
			expect(() => assertConsumableComposition(drink)).not.toThrow();
			for (const portion of drink.portions) {
				expect(portion.volumeL).toBeGreaterThan(0);
				expect(portion.massKg).toBeNull();
				expect(portion.basisUnits).toBeNull();
			}
		}
	});

	it("pins every authored per-100-ml figure and portion volume for sign-off", () => {
		const compositions = DRINK_CATALOGUE.map((drink) =>
			[
				drink.key,
				drink.category,
				// Ethanol in grams per 100 ml, at the precision a label prints.
				((drink.constituents.ethanol ?? 0) * 1_000).toFixed(4),
				(drink.constituents.caffeine ?? 0) * 1_000_000,
				drink.constituents.energy,
			].join("|"),
		);
		expect(compositions).toEqual([
			"drink:lager-4_5|alcoholic|3.5516|0|43",
			"drink:cider-4_5|alcoholic|3.5516|0|42",
			"drink:wine-red-13|alcoholic|10.2601|0|85",
			"drink:wine-white-12|alcoholic|9.4709|0|82",
			"drink:spirit-40|alcoholic|31.5696|0|222",
			"drink:filter-coffee|caffeinated|0.0000|40|1",
			"drink:tea|caffeinated|0.0000|19|1",
			"drink:espresso|caffeinated|0.0000|210|7",
			"drink:energy-drink|caffeinated|0.0000|32|44",
			"drink:cola|caffeinated|0.0000|10|42",
			"drink:water|hydration|0.0000|0|0",
		]);
		const portions = DRINK_CATALOGUE.flatMap((drink) =>
			drink.portions.map((portion) =>
				[drink.key, portion.id, portion.volumeL].join("|"),
			),
		);
		expect(portions).toEqual([
			"drink:lager-4_5|pint-uk|0.56826125",
			"drink:lager-4_5|half-pint-uk|0.284130625",
			"drink:lager-4_5|can-330ml|0.33",
			"drink:lager-4_5|can-440ml|0.44",
			"drink:lager-4_5|bottle-12floz-us|0.35488235475",
			"drink:cider-4_5|pint-uk|0.56826125",
			"drink:cider-4_5|half-pint-uk|0.284130625",
			"drink:cider-4_5|can-440ml|0.44",
			"drink:cider-4_5|bottle-12floz-us|0.35488235475",
			"drink:wine-red-13|glass-125ml|0.125",
			"drink:wine-red-13|glass-175ml|0.175",
			"drink:wine-red-13|glass-250ml|0.25",
			"drink:wine-red-13|glass-5floz-us|0.1478676478125",
			"drink:wine-white-12|glass-125ml|0.125",
			"drink:wine-white-12|glass-175ml|0.175",
			"drink:wine-white-12|glass-250ml|0.25",
			"drink:wine-white-12|glass-5floz-us|0.1478676478125",
			"drink:spirit-40|single-25ml|0.025",
			"drink:spirit-40|double-50ml|0.05",
			"drink:spirit-40|shot-1_5floz-us|0.04436029434375",
			"drink:filter-coffee|mug-250ml|0.25",
			"drink:filter-coffee|cup-8floz-us|0.2365882365",
			"drink:tea|mug-250ml|0.25",
			"drink:tea|cup-8floz-us|0.2365882365",
			"drink:espresso|single-30ml|0.03",
			"drink:espresso|double-60ml|0.06",
			"drink:energy-drink|can-250ml|0.25",
			"drink:cola|can-330ml|0.33",
			"drink:cola|can-12floz-us|0.35488235475",
			"drink:water|glass-250ml|0.25",
			"drink:water|bottle-500ml|0.5",
			"drink:water|glass-8floz-us|0.2365882365",
		]);
	});

	it("keeps the readable label figures as the signed-off source", () => {
		expect(
			drinkComposition({
				abvPercent: 4.5,
				caffeineMgPer100ml: 0,
				kcalPer100ml: 43,
			}),
		).toEqual({
			fluid: 0.1,
			ethanol: ethanolKgFromVolumeAndAbv(0.1, 4.5),
			caffeine: 0,
			energy: 43,
		});
		// Scaling a pint of lager from its 100 ml basis reproduces the ethanol a
		// pint used to snapshot directly, without display-unit drift.
		const lager = resolveDrink("drink:lager-4_5");
		const pint = lager?.portions.find((portion) => portion.id === "pint-uk");
		if (!lager || !pint?.volumeL) throw new Error("Expected the lager pint.");
		const factor = pint.volumeL / 0.1;
		const ethanolKg = (lager.constituents.ethanol ?? 0) * factor;
		expect(ethanolKg).toBeCloseTo(
			(UK_PINT_L * 1_000 * 0.045 * ETHANOL_DENSITY_G_PER_ML) / 1_000,
			12,
		);
		expect(formatMeasurement(ethanolKg, "mass", "uk_unit")).toBe("2.6 units");
		expect(formatMeasurement(ethanolKg, "mass", "us_standard_drink")).toBe(
			"1.4 standard drinks",
		);
		expect(formatMeasurement(ethanolKg, "mass", "g")).toBe("20.2 g");
		expect((lager.constituents.fluid ?? 0) * factor).toBeCloseTo(UK_PINT_L, 12);
		expect((lager.constituents.energy ?? 0) * factor).toBeCloseTo(244.4, 1);
	});

	it("tolerates unknown catalogue keys and rejects invalid arithmetic", () => {
		expect(resolveDrink("drink:removed-one-day")).toBeNull();
		expect(ethanolKgFromVolumeAndAbv(0.5, 0)).toBe(0);
		expect(() => ethanolKgFromVolumeAndAbv(-1, 4.5)).toThrow(
			"finite and non-negative",
		);
		expect(() => ethanolKgFromVolumeAndAbv(0.5, 101)).toThrow(
			"must not exceed 100%",
		);
		expect(() =>
			drinkComposition({
				abvPercent: 0,
				caffeineMgPer100ml: -1,
				kcalPer100ml: 0,
			}),
		).toThrow("finite and non-negative");
	});
});
