import {
	resolveSubstanceEntry,
	type SubstanceCatalogueEntry,
	snapshotSubstanceServing,
} from "./substance-catalogue";

const CATALOGUE = [
	{
		id: "example:single",
		label: "Single quantity",
		servings: [{ id: "one", label: "one", amounts: { nicotineKg: 2e-6 } }],
	},
	{
		// The shape a later substance needs: one serving, several quantities.
		id: "example:edible",
		label: "Edible",
		servings: [
			{
				id: "one",
				label: "piece",
				amounts: { nicotineKg: 1e-6, energyKcal: 90 },
			},
		],
	},
] as const satisfies readonly SubstanceCatalogueEntry[];

describe("substance catalogue", () => {
	it("scales every canonical amount a serving carries by quantity", () => {
		const edible = resolveSubstanceEntry(CATALOGUE, "example:edible");
		const serving = edible?.servings[0];
		if (!edible || !serving) throw new Error("Expected the edible serving.");

		expect(snapshotSubstanceServing(edible, serving, 2)).toEqual({
			catalogueRef: "example:edible",
			label: "Edible",
			servingLabel: "piece",
			quantity: 2,
			amounts: { nicotineKg: 2e-6, energyKcal: 180 },
		});
	});

	it("snapshots a fractional quantity without dropping keys", () => {
		const single = resolveSubstanceEntry(CATALOGUE, "example:single");
		const serving = single?.servings[0];
		if (!single || !serving) throw new Error("Expected the single serving.");

		expect(snapshotSubstanceServing(single, serving, 0.5).amounts).toEqual({
			nicotineKg: 1e-6,
		});
	});

	it("tolerates unknown ids and rejects invalid quantities", () => {
		expect(resolveSubstanceEntry(CATALOGUE, "example:gone")).toBeNull();
		const single = resolveSubstanceEntry(CATALOGUE, "example:single");
		const serving = single?.servings[0];
		if (!single || !serving) throw new Error("Expected the single serving.");

		for (const quantity of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
			expect(() => snapshotSubstanceServing(single, serving, quantity)).toThrow(
				"finite and positive",
			);
		}
		expect(() =>
			snapshotSubstanceServing(
				{
					id: "example:bad",
					label: "Bad",
					servings: [{ id: "one", label: "one", amounts: { nicotineKg: -1 } }],
				},
				{ id: "one", label: "one", amounts: { nicotineKg: -1 } },
				1,
			),
		).toThrow("finite and non-negative");
	});
});
