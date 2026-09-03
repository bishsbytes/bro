import { formatMeasurement } from "../index";
import { assertConsumableComposition } from "./consumable";
import {
	NICOTINE_CATALOGUE,
	nicotineKgFromMg,
	resolveNicotineEntry,
} from "./nicotine-catalogue";

describe("nicotine catalogue", () => {
	it("authors every item per one portion with unique keys and basis multiples", () => {
		expect(new Set(NICOTINE_CATALOGUE.map((entry) => entry.key)).size).toBe(
			NICOTINE_CATALOGUE.length,
		);
		for (const entry of NICOTINE_CATALOGUE) {
			expect(entry.key).toMatch(/^nicotine:[a-z0-9_]+(?:-[a-z0-9_]+)*$/);
			expect(entry.kind).toBe("nicotine");
			expect(entry.name.trim()).toBe(entry.name);
			// Nicotine is the only quantity smoked or vaped content carries.
			expect(Object.keys(entry.constituents)).toEqual(["nicotine"]);
			expect(entry.constituents.nicotine).toBeGreaterThan(0);
			expect(entry.basis).toEqual({
				type: "portion",
				portionId: entry.portions[0]?.id,
			});
			expect(entry.defaultPortionId).toBe(entry.portions[0]?.id);
			expect(() => assertConsumableComposition(entry)).not.toThrow();
			for (const portion of entry.portions) {
				expect(portion.basisUnits).toBeGreaterThan(0);
				expect(portion.massKg).toBeNull();
				expect(portion.volumeL).toBeNull();
			}
		}
	});

	it("pins every authored delivered-nicotine estimate for sign-off", () => {
		const numbers = NICOTINE_CATALOGUE.flatMap((entry) =>
			entry.portions.map((portion) =>
				[
					entry.key,
					portion.id,
					(entry.constituents.nicotine ?? 0) *
						(portion.basisUnits ?? 0) *
						1_000_000,
				].join("|"),
			),
		);
		expect(numbers).toEqual([
			"nicotine:cigarette|one|1.2",
			"nicotine:cigarette|half|0.6",
			"nicotine:roll-up|one|1.2",
			"nicotine:roll-up|half|0.6",
			"nicotine:cigar|one|3",
			"nicotine:vape-20|puffs-10|0.8",
			"nicotine:vape-20|session|1.5",
			"nicotine:vape-10|puffs-10|0.4",
			"nicotine:vape-10|session|0.75",
		]);
	});

	it("carries no cessation aid, so an assisted quit never reads as a lapse", () => {
		const names = NICOTINE_CATALOGUE.map((entry) => entry.name.toLowerCase());
		for (const aid of ["gum", "patch", "pouch", "lozenge", "spray"]) {
			expect(names.some((name) => name.includes(aid))).toBe(false);
		}
	});

	it("renders delivered estimates in whole milligrams", () => {
		const cigarette = resolveNicotineEntry("nicotine:cigarette");
		if (!cigarette) throw new Error("Expected the cigarette.");
		// Whole milligrams, the caffeine display precedent, and deliberate: these
		// are delivery estimates, and a decimal would claim a precision they do
		// not have.
		expect(
			formatMeasurement(
				(cigarette.constituents.nicotine ?? 0) * 3,
				"mass",
				"mg",
			),
		).toBe("4 mg");
		expect(formatMeasurement(nicotineKgFromMg(12), "mass", "mg")).toBe("12 mg");
	});

	it("tolerates unknown keys and rejects invalid arithmetic", () => {
		expect(resolveNicotineEntry("nicotine:removed-one-day")).toBeNull();
		expect(nicotineKgFromMg(1.2)).toBeCloseTo(1.2e-6, 12);
		expect(nicotineKgFromMg(0)).toBe(0);
		expect(() => nicotineKgFromMg(-1)).toThrow("finite and non-negative");
	});
});
