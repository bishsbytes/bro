import { ethanolKgFromVolumeAndAbv } from "@bro/domain/drink-catalogue";
import {
	labelInputsFromComposition,
	mergeLabelInputs,
} from "./intake/free-entry";

describe("quick nutrition editing", () => {
	it("round-trips visible fields and retains nutrients the compact form cannot edit", () => {
		const base = {
			energy: 142,
			protein: 0.003,
			fluid: 0.33,
			ethanol: ethanolKgFromVolumeAndAbv(0.33, 4.5),
			caffeine: 32e-6,
			sugar: 0.034,
			sodium: 0.00012,
			vitamin_c: 0.00002,
		};

		const inputs = labelInputsFromComposition(base);
		expect(inputs).toMatchObject({
			energyKcal: "142",
			proteinG: "3",
			fluidMl: "330",
			abvPercent: "4.5",
			caffeineMg: "32",
		});

		const merged = mergeLabelInputs(base, { ...inputs, energyKcal: "150" });
		expect(merged.constituents).toMatchObject({
			energy: 150,
			protein: 0.003,
			fluid: 0.33,
			caffeine: 32e-6,
			sugar: 0.034,
			sodium: 0.00012,
			vitamin_c: 0.00002,
		});
		expect(merged.constituents.ethanol).toBeCloseTo(base.ethanol, 12);
	});
});
