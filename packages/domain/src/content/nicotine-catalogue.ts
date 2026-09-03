import { milligramsToKg } from "./constituent-catalogue";
import type { Portion, SystemConsumable } from "./consumable";

export const NICOTINE_MG_PER_KG = 1_000_000;

export function nicotineKgFromMg(milligrams: number): number {
	if (!Number.isFinite(milligrams) || milligrams < 0) {
		throw new RangeError("Nicotine must be finite and non-negative.");
	}
	return milligramsToKg(milligrams);
}

export type NicotineCatalogueEntry = SystemConsumable & {
	key: `nicotine:${string}`;
	kind: "nicotine";
};

function unit(id: string, label: string, basisUnits: number): Portion {
	return { id, label, massKg: null, volumeL: null, basisUnits };
}

/**
 * A nicotine item is authored per one portion — the cigarette, the ten puffs —
 * and its other portions are multiples of it: half a cigarette is 0.5, a
 * session on a vape is what ten puffs deliver times the session's share.
 */
function nicotineItem(
	key: `nicotine:${string}`,
	name: string,
	deliveredMgPerBasisPortion: number,
	portions: readonly Portion[],
): NicotineCatalogueEntry {
	const basisPortion = portions[0];
	if (!basisPortion) {
		throw new RangeError(`${key} must offer at least one portion.`);
	}
	return {
		key,
		kind: "nicotine",
		name,
		basis: { type: "portion", portionId: basisPortion.id },
		constituents: { nicotine: nicotineKgFromMg(deliveredMgPerBasisPortion) },
		portions,
		defaultPortionId: basisPortion.id,
	};
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
	nicotineItem("nicotine:cigarette", "Cigarette", 1.2, [
		unit("one", "cigarette", 1),
		unit("half", "half", 0.5),
	]),
	nicotineItem("nicotine:roll-up", "Roll-up", 1.2, [
		unit("one", "roll-up", 1),
		unit("half", "half", 0.5),
	]),
	nicotineItem("nicotine:cigar", "Cigar", 3, [unit("one", "cigar", 1)]),
	// A session is authored as 1.5 mg against 0.8 mg for ten puffs: 1.875 of
	// the basis portion, exactly.
	nicotineItem("nicotine:vape-20", "Vape, ~20 mg/ml", 0.8, [
		unit("puffs-10", "10 puffs", 1),
		unit("session", "session", 1.875),
	]),
	nicotineItem("nicotine:vape-10", "Vape, ~10 mg/ml", 0.4, [
		unit("puffs-10", "10 puffs", 1),
		unit("session", "session", 1.875),
	]),
] as const satisfies readonly NicotineCatalogueEntry[];

const entriesByKey = new Map<string, NicotineCatalogueEntry>(
	NICOTINE_CATALOGUE.map((entry) => [entry.key, entry]),
);

/** Unknown keys resolve to null forever, so removed content never throws. */
export function resolveNicotineEntry(
	key: string,
): NicotineCatalogueEntry | null {
	return entriesByKey.get(key) ?? null;
}
