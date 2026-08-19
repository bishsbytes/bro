import { formatMeasurement } from "@bro/domain";
import {
	DRINK_CATALOGUE,
	ETHANOL_DENSITY_G_PER_ML,
	ethanolKgFromVolumeAndAbv,
	resolveDrink,
	snapshotDrinkServing,
	UK_PINT_L,
} from "@bro/domain/drink-catalogue";

describe("drink catalogue", () => {
	it("uses stable unique ids and valid authored quantities", () => {
		expect(new Set(DRINK_CATALOGUE.map((drink) => drink.id)).size).toBe(
			DRINK_CATALOGUE.length,
		);
		for (const drink of DRINK_CATALOGUE) {
			expect(drink.id).toMatch(/^drink:[a-z0-9_]+(?:-[a-z0-9_]+)*$/);
			expect(drink.label.trim()).toBe(drink.label);
			expect(drink.servings.length).toBeGreaterThan(0);
			expect(new Set(drink.servings.map((serving) => serving.id)).size).toBe(
				drink.servings.length,
			);
			for (const serving of drink.servings) {
				expect(serving.volumeL).toBeGreaterThan(0);
				expect(serving.abvPercent).toBeGreaterThanOrEqual(0);
				expect(serving.abvPercent).toBeLessThanOrEqual(100);
				expect(serving.caffeineMg).toBeGreaterThanOrEqual(0);
				expect(serving.energyKcal).toBeGreaterThanOrEqual(0);
			}
		}
	});

	it("pins every authored serving number for sign-off", () => {
		const numbers = DRINK_CATALOGUE.flatMap((drink) =>
			drink.servings.map((serving) =>
				[
					drink.id,
					serving.id,
					serving.volumeL,
					serving.abvPercent,
					serving.caffeineMg,
					serving.energyKcal,
				].join("|"),
			),
		);
		expect(numbers).toEqual([
			"drink:lager-4_5|pint-uk|0.56826125|4.5|0|244",
			"drink:lager-4_5|half-pint-uk|0.284130625|4.5|0|122",
			"drink:lager-4_5|can-330ml|0.33|4.5|0|142",
			"drink:lager-4_5|can-440ml|0.44|4.5|0|189",
			"drink:lager-4_5|bottle-12floz-us|0.35488235475|4.5|0|153",
			"drink:cider-4_5|pint-uk|0.56826125|4.5|0|238",
			"drink:cider-4_5|half-pint-uk|0.284130625|4.5|0|119",
			"drink:cider-4_5|can-440ml|0.44|4.5|0|184",
			"drink:cider-4_5|bottle-12floz-us|0.35488235475|4.5|0|149",
			"drink:wine-red-13|glass-125ml|0.125|13|0|106",
			"drink:wine-red-13|glass-175ml|0.175|13|0|149",
			"drink:wine-red-13|glass-250ml|0.25|13|0|213",
			"drink:wine-red-13|glass-5floz-us|0.1478676478125|13|0|126",
			"drink:wine-white-12|glass-125ml|0.125|12|0|103",
			"drink:wine-white-12|glass-175ml|0.175|12|0|144",
			"drink:wine-white-12|glass-250ml|0.25|12|0|206",
			"drink:wine-white-12|glass-5floz-us|0.1478676478125|12|0|122",
			"drink:spirit-40|single-25ml|0.025|40|0|55",
			"drink:spirit-40|double-50ml|0.05|40|0|111",
			"drink:spirit-40|shot-1_5floz-us|0.04436029434375|40|0|98",
			"drink:filter-coffee|mug-250ml|0.25|0|95|2",
			"drink:filter-coffee|cup-8floz-us|0.2365882365|0|95|2",
			"drink:tea|mug-250ml|0.25|0|47|2",
			"drink:tea|cup-8floz-us|0.2365882365|0|47|2",
			"drink:espresso|single-30ml|0.03|0|63|2",
			"drink:espresso|double-60ml|0.06|0|126|4",
			"drink:energy-drink|can-250ml|0.25|0|80|110",
			"drink:cola|can-330ml|0.33|0|32|139",
			"drink:cola|can-12floz-us|0.35488235475|0|34|150",
			"drink:water|glass-250ml|0.25|0|0|0",
			"drink:water|bottle-500ml|0.5|0|0|0",
			"drink:water|glass-8floz-us|0.2365882365|0|0|0",
		]);
	});

	it("derives and snapshots a pint without display-unit drift", () => {
		const lager = resolveDrink("drink:lager-4_5");
		const pint = lager?.servings.find((serving) => serving.id === "pint-uk");
		if (!lager || !pint) throw new Error("Expected the lager pint serving.");

		const snapshot = snapshotDrinkServing(lager, pint, 1);
		const expectedEthanolKg =
			(UK_PINT_L * 1_000 * 0.045 * ETHANOL_DENSITY_G_PER_ML) / 1_000;
		expect(snapshot).toEqual({
			catalogueRef: "drink:lager-4_5",
			label: "Lager, 4.5%",
			servingLabel: "pint",
			quantity: 1,
			volumeL: UK_PINT_L,
			ethanolKg: expectedEthanolKg,
			caffeineKg: 0,
			energyKcal: 244,
		});
		expect(formatMeasurement(snapshot.ethanolKg, "mass", "uk_unit")).toBe(
			"2.6 units",
		);
		expect(
			formatMeasurement(snapshot.ethanolKg, "mass", "us_standard_drink"),
		).toBe("1.4 standard drinks");
		expect(formatMeasurement(snapshot.ethanolKg, "mass", "g")).toBe("20.2 g");
		expect(snapshot.ethanolKg).toBe(expectedEthanolKg);
	});

	it("tolerates unknown catalogue ids and rejects invalid arithmetic", () => {
		expect(resolveDrink("drink:removed-one-day")).toBeNull();
		expect(ethanolKgFromVolumeAndAbv(0.5, 0)).toBe(0);
		expect(() => ethanolKgFromVolumeAndAbv(-1, 4.5)).toThrow(
			"finite and non-negative",
		);
		expect(() => ethanolKgFromVolumeAndAbv(0.5, 101)).toThrow(
			"must not exceed 100%",
		);
		const water = resolveDrink("drink:water");
		const glass = water?.servings[0];
		if (!water || !glass) throw new Error("Expected water serving.");
		expect(() => snapshotDrinkServing(water, glass, 0)).toThrow(
			"finite and positive",
		);
	});
});
