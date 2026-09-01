import type {
	SubstanceCatalogueEntry,
	SubstanceCatalogueServing,
	SubstanceServingSnapshot,
} from "./substance-catalogue";
import {
	resolveSubstanceEntry,
	snapshotSubstanceServing,
} from "./substance-catalogue";

export const NICOTINE_MG_PER_KG = 1_000_000;

export function nicotineKgFromMg(milligrams: number): number {
	if (!Number.isFinite(milligrams) || milligrams < 0) {
		throw new RangeError("Nicotine must be finite and non-negative.");
	}
	return milligrams / NICOTINE_MG_PER_KG;
}

/**
 * Authored, offline nicotine content: smoked and vaped nicotine only.
 *
 * **Every number here is an estimate of *delivered* nicotine, not of the
 * nicotine a product contains.** A cigarette contains roughly 10-12 mg but
 * delivers on the order of 1-1.5 mg to the smoker; vape delivery varies with
 * device, liquid strength, and how a person draws on it. The figures exist so
 * a daily total trends honestly against itself, and the copy never presents
 * them as a measurement of what any individual absorbed.
 *
 * Cessation aids — gum, pouches, patches — are deliberately absent. Folding
 * them into the same total would make a gum-assisted quit read as a failure on
 * a nicotine-free day, which is the one user this content must not punish.
 *
 * Authored in milligrams and divided into canonical kilograms rather than
 * written as kilogram literals: `0.8e-6` is not the nearest double to 0.8 mg
 * and does not survive a round trip back to milligrams, which would put noise
 * into the numbers this catalogue exists to pin.
 */
export const NICOTINE_CATALOGUE = [
	{
		id: "nicotine:cigarette",
		label: "Cigarette",
		servings: [
			{
				id: "one",
				label: "cigarette",
				amounts: { nicotineKg: nicotineKgFromMg(1.2) },
			},
			{
				id: "half",
				label: "half",
				amounts: { nicotineKg: nicotineKgFromMg(0.6) },
			},
		],
	},
	{
		id: "nicotine:roll-up",
		label: "Roll-up",
		servings: [
			{
				id: "one",
				label: "roll-up",
				amounts: { nicotineKg: nicotineKgFromMg(1.2) },
			},
			{
				id: "half",
				label: "half",
				amounts: { nicotineKg: nicotineKgFromMg(0.6) },
			},
		],
	},
	{
		id: "nicotine:cigar",
		label: "Cigar",
		servings: [
			{
				id: "one",
				label: "cigar",
				amounts: { nicotineKg: nicotineKgFromMg(3) },
			},
		],
	},
	{
		id: "nicotine:vape-20",
		label: "Vape, ~20 mg/ml",
		servings: [
			{
				id: "puffs-10",
				label: "10 puffs",
				amounts: { nicotineKg: nicotineKgFromMg(0.8) },
			},
			{
				id: "session",
				label: "session",
				amounts: { nicotineKg: nicotineKgFromMg(1.5) },
			},
		],
	},
	{
		id: "nicotine:vape-10",
		label: "Vape, ~10 mg/ml",
		servings: [
			{
				id: "puffs-10",
				label: "10 puffs",
				amounts: { nicotineKg: nicotineKgFromMg(0.4) },
			},
			{
				id: "session",
				label: "session",
				amounts: { nicotineKg: nicotineKgFromMg(0.75) },
			},
		],
	},
] as const satisfies readonly SubstanceCatalogueEntry[];

export function resolveNicotineEntry(
	id: string,
): SubstanceCatalogueEntry | null {
	return resolveSubstanceEntry(NICOTINE_CATALOGUE, id);
}

export function snapshotNicotineServing(
	entry: SubstanceCatalogueEntry,
	serving: SubstanceCatalogueServing,
	quantity: number,
): SubstanceServingSnapshot {
	return snapshotSubstanceServing(entry, serving, quantity);
}
