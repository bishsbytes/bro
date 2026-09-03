import {
	DIMENSION_BY_UNIT_PREFERENCE,
	DISPLAY_UNITS_BY_DIMENSION,
	formatMeasurement,
} from "../index";
import {
	assertConstituentAmounts,
	CONSTITUENT_CATALOGUE,
	CONSTITUENT_CATEGORIES,
	carriesSensitiveConstituent,
	isConstituentAmounts,
	isConstituentCode,
	listConstituents,
	microgramsToKg,
	milligramsToKg,
	resolveConstituent,
	SENSITIVE_CONSTITUENT_CODES,
} from "./constituent-catalogue";

describe("constituent catalogue", () => {
	it("uses permanent unique codes, positions, and known categories", () => {
		const codes = CONSTITUENT_CATALOGUE.map((constituent) => constituent.code);
		const positions = CONSTITUENT_CATALOGUE.map((c) => c.defaultPosition);
		expect(new Set(codes).size).toBe(codes.length);
		expect(new Set(positions).size).toBe(positions.length);
		for (const constituent of CONSTITUENT_CATALOGUE) {
			expect(constituent.code).toMatch(/^[a-z][a-z0-9_]*$/);
			expect(constituent.label.trim()).toBe(constituent.label);
			expect(CONSTITUENT_CATEGORIES).toContain(constituent.category);
			expect(resolveConstituent(constituent.code)).toBe(constituent);
			expect(isConstituentCode(constituent.code)).toBe(true);
		}
		expect(resolveConstituent("thc")).toBeNull();
		expect(isConstituentCode("thc")).toBe(false);
	});

	it("pins the v1 list, units, and display choices for sign-off", () => {
		expect(
			CONSTITUENT_CATALOGUE.map((c) =>
				[
					c.code,
					c.category,
					c.dimension,
					"fixedDisplayUnit" in c.display
						? c.display.fixedDisplayUnit
						: `pref:${c.display.unitPreferenceDimension}`,
					c.sensitive ? "sensitive" : "",
					c.publishable ? "" : "unpublishable",
				].join("|"),
			),
		).toEqual([
			"energy|energy|energy|kcal||",
			"protein|macronutrient|mass|g||",
			"carbohydrate|macronutrient|mass|g||",
			"fat|macronutrient|mass|g||",
			"saturated_fat|macronutrient|mass|g||",
			"sugar|macronutrient|mass|g||",
			"fibre|macronutrient|mass|g||",
			"sodium|micronutrient|mass|pref:sodium||",
			"fluid|hydration|volume|pref:volume||",
			"caffeine|stimulant|mass|mg||",
			"nicotine|stimulant|mass|mg|sensitive|unpublishable",
			"ethanol|alcohol|mass|pref:alcohol|sensitive|",
			"creatine|supplement|mass|g||",
			"vitamin_a|micronutrient|mass|µg||",
			"vitamin_d|micronutrient|mass|µg||",
			"vitamin_b12|micronutrient|mass|µg||",
			"folate|micronutrient|mass|µg||",
			"vitamin_c|micronutrient|mass|mg||",
			"calcium|micronutrient|mass|mg||",
			"iron|micronutrient|mass|mg||",
			"magnesium|micronutrient|mass|mg||",
			"potassium|micronutrient|mass|mg||",
			"zinc|micronutrient|mass|mg||",
		]);
		expect(SENSITIVE_CONSTITUENT_CODES).toEqual(["nicotine", "ethanol"]);
	});

	it("keeps every display choice usable at the constituent's dimension", () => {
		for (const constituent of CONSTITUENT_CATALOGUE) {
			if ("fixedDisplayUnit" in constituent.display) {
				expect(
					DISPLAY_UNITS_BY_DIMENSION[
						constituent.dimension
					] as readonly string[],
				).toContain(constituent.display.fixedDisplayUnit);
			} else {
				expect(
					DIMENSION_BY_UNIT_PREFERENCE[
						constituent.display.unitPreferenceDimension
					],
				).toBe(constituent.dimension);
			}
		}
	});

	it("lists by category and formats authored amounts back to their label unit", () => {
		expect(listConstituents("macronutrient").map((c) => c.code)).toEqual([
			"protein",
			"carbohydrate",
			"fat",
			"saturated_fat",
			"sugar",
			"fibre",
		]);
		expect(listConstituents()).toHaveLength(CONSTITUENT_CATALOGUE.length);
		expect(formatMeasurement(microgramsToKg(25), "mass", "µg")).toBe("25.0 µg");
		expect(formatMeasurement(milligramsToKg(95), "mass", "mg")).toBe("95 mg");
		expect(formatMeasurement(milligramsToKg(600), "mass", "salt_g")).toBe(
			"1.5 g salt",
		);
	});

	it("judges sensitivity by content and rejects amounts a repository must not store", () => {
		expect(carriesSensitiveConstituent({ energy: 200, protein: 0.02 })).toBe(
			false,
		);
		expect(carriesSensitiveConstituent({ ethanol: 0, caffeine: 0.0001 })).toBe(
			false,
		);
		expect(carriesSensitiveConstituent({ ethanol: 0.02 })).toBe(true);
		expect(carriesSensitiveConstituent({ nicotine: 1.2e-6, energy: 0 })).toBe(
			true,
		);
		expect(isConstituentAmounts({ energy: 1, future_code: 2 })).toBe(true);
		expect(isConstituentAmounts({ energy: -1 })).toBe(false);
		expect(isConstituentAmounts({ energy: "1" })).toBe(false);
		expect(isConstituentAmounts([])).toBe(false);
		expect(() => assertConstituentAmounts({ energy: 1 })).not.toThrow();
		expect(() => assertConstituentAmounts({ energy: Number.NaN })).toThrow(
			"energy must be finite and non-negative",
		);
		expect(() => microgramsToKg(-1)).toThrow("finite and non-negative");
	});
});
