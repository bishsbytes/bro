/**
 * The authored shape every substance catalogue shares — nicotine today, and
 * the next substance stream without a second shape to design. Drinks and food
 * keep their own catalogues: their journeys differ (regional servings, provider
 * search), while substances all log the same way.
 *
 * A serving carries a **map** of canonical amounts rather than named fields, so
 * a substance delivering more than one quantity — an edible carrying both its
 * active compound and its calories — needs no new serving type. The keys are
 * the consumption entry's canonical quantity columns, which is what makes a
 * snapshot writable to an entry without a per-substance translation step.
 */
export type SubstanceCanonicalAmountKey =
	| "volumeL"
	| "ethanolKg"
	| "caffeineKg"
	| "nicotineKg"
	| "energyKcal"
	| "proteinG"
	| "carbsG"
	| "fatG";

/** Amounts one serving delivers. An absent key means "not applicable". */
export type SubstanceCanonicalAmounts = Partial<
	Record<SubstanceCanonicalAmountKey, number>
>;

export type SubstanceCatalogueServing = {
	id: string;
	label: string;
	amounts: SubstanceCanonicalAmounts;
};

export type SubstanceCatalogueEntry = {
	/** Namespaced by substance, as `nicotine:cigarette`. Permanent once authored. */
	id: string;
	label: string;
	servings: readonly SubstanceCatalogueServing[];
};

export type SubstanceServingSnapshot = {
	catalogueRef: string;
	label: string;
	servingLabel: string;
	quantity: number;
	amounts: SubstanceCanonicalAmounts;
};

/**
 * Copies everything displayed onto the entry at log time, per the standing
 * catalogue/overlay/snapshot discipline: a later catalogue edit, deprecation,
 * or removal never changes what a logged day says.
 */
export function snapshotSubstanceServing(
	entry: SubstanceCatalogueEntry,
	serving: SubstanceCatalogueServing,
	quantity: number,
): SubstanceServingSnapshot {
	if (!Number.isFinite(quantity) || quantity <= 0) {
		throw new RangeError("Substance quantity must be finite and positive.");
	}
	const amounts: SubstanceCanonicalAmounts = {};
	for (const [key, amount] of Object.entries(serving.amounts) as [
		SubstanceCanonicalAmountKey,
		number,
	][]) {
		if (!Number.isFinite(amount) || amount < 0) {
			throw new RangeError(`Substance ${key} must be finite and non-negative.`);
		}
		amounts[key] = amount * quantity;
	}
	return {
		catalogueRef: entry.id,
		label: entry.label,
		servingLabel: serving.label,
		quantity,
		amounts,
	};
}

/** Unknown ids resolve to null forever, so removed content never throws. */
export function resolveSubstanceEntry(
	catalogue: readonly SubstanceCatalogueEntry[],
	id: string,
): SubstanceCatalogueEntry | null {
	return catalogue.find((entry) => entry.id === id) ?? null;
}
