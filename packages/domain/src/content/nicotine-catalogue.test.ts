import { formatMeasurement } from "../index";
import {
	NICOTINE_CATALOGUE,
	nicotineKgFromMg,
	resolveNicotineEntry,
	snapshotNicotineServing,
} from "./nicotine-catalogue";

describe("nicotine catalogue", () => {
	it("uses stable unique ids and valid authored quantities", () => {
		expect(new Set(NICOTINE_CATALOGUE.map((entry) => entry.id)).size).toBe(
			NICOTINE_CATALOGUE.length,
		);
		for (const entry of NICOTINE_CATALOGUE) {
			expect(entry.id).toMatch(/^nicotine:[a-z0-9_]+(?:-[a-z0-9_]+)*$/);
			expect(entry.label.trim()).toBe(entry.label);
			expect(entry.servings.length).toBeGreaterThan(0);
			expect(new Set(entry.servings.map((serving) => serving.id)).size).toBe(
				entry.servings.length,
			);
			for (const serving of entry.servings) {
				// Nicotine is the only quantity smoked or vaped content carries.
				expect(Object.keys(serving.amounts)).toEqual(["nicotineKg"]);
				expect(serving.amounts.nicotineKg).toBeGreaterThan(0);
			}
		}
	});

	it("pins every authored delivered-nicotine estimate for sign-off", () => {
		const numbers = NICOTINE_CATALOGUE.flatMap((entry) =>
			entry.servings.map((serving) =>
				[
					entry.id,
					serving.id,
					(serving.amounts.nicotineKg ?? 0) * 1_000_000,
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
		const labels = NICOTINE_CATALOGUE.map((entry) => entry.label.toLowerCase());
		for (const aid of ["gum", "patch", "pouch", "lozenge", "spray"]) {
			expect(labels.some((label) => label.includes(aid))).toBe(false);
		}
	});

	it("snapshots a serving scaled by quantity, in canonical mass", () => {
		const cigarette = resolveNicotineEntry("nicotine:cigarette");
		const one = cigarette?.servings.find((serving) => serving.id === "one");
		if (!cigarette || !one) throw new Error("Expected the cigarette serving.");

		const snapshot = snapshotNicotineServing(cigarette, one, 3);
		expect(snapshot).toEqual({
			catalogueRef: "nicotine:cigarette",
			label: "Cigarette",
			servingLabel: "cigarette",
			quantity: 3,
			amounts: { nicotineKg: nicotineKgFromMg(1.2) * 3 },
		});
		expect((snapshot.amounts.nicotineKg ?? 0) * 1_000_000).toBeCloseTo(3.6, 9);
		// Whole milligrams, the caffeine display precedent, and deliberate: these
		// are delivery estimates, and a decimal would claim a precision they do
		// not have. The entry row names the thing logged; mg is the day's trend.
		expect(
			formatMeasurement(snapshot.amounts.nicotineKg ?? 0, "mass", "mg"),
		).toBe("4 mg");
		expect(formatMeasurement(nicotineKgFromMg(12), "mass", "mg")).toBe("12 mg");
	});

	it("tolerates unknown ids and rejects invalid arithmetic", () => {
		expect(resolveNicotineEntry("nicotine:removed-one-day")).toBeNull();
		expect(nicotineKgFromMg(1.2)).toBeCloseTo(1.2e-6, 12);
		expect(nicotineKgFromMg(0)).toBe(0);
		expect(() => nicotineKgFromMg(-1)).toThrow("finite and non-negative");
		const cigar = resolveNicotineEntry("nicotine:cigar");
		const serving = cigar?.servings[0];
		if (!cigar || !serving) throw new Error("Expected the cigar serving.");
		expect(() => snapshotNicotineServing(cigar, serving, 0)).toThrow(
			"finite and positive",
		);
	});
});
