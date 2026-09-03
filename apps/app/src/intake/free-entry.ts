import type { ConstituentAmounts } from "@bro/domain/constituent-catalogue";
import { ethanolKgFromVolumeAndAbv } from "@bro/domain/drink-catalogue";
import { i18n } from "../i18n";

/**
 * The numbers a person types for "something else" or a quick library item,
 * in the units a label prints. Empty strings mean "not known" and produce no
 * code; a typed zero is "measured as none" and does.
 */
export type LabelInputs = {
	energyKcal?: string;
	proteinG?: string;
	carbohydrateG?: string;
	fatG?: string;
	fluidMl?: string;
	abvPercent?: string;
	caffeineMg?: string;
	nicotineMg?: string;
};

export type LabelComposition = {
	/** Per portion, canonical units. */
	constituents: ConstituentAmounts;
	/** The portion's volume where a fluid amount was typed. */
	volumeL: number | null;
};

const GRAMS_PER_KILOGRAM = 1_000;
const MILLIGRAMS_PER_KILOGRAM = 1_000_000;
const MILLILITRES_PER_LITRE = 1_000;

function optionalNumber(
	value: string | undefined,
	field: string,
): number | null {
	const trimmed = value?.trim() ?? "";
	if (!trimmed) return null;
	const parsed = Number(trimmed);
	if (!Number.isFinite(parsed) || parsed < 0) {
		throw new RangeError(
			i18n.t("validation:nonNegativeNumber", {
				field: i18n.t(`intake:free.${field}` as "intake:free.energy"),
			}),
		);
	}
	return parsed;
}

/** Whether every typed field is empty or a non-negative number. */
export function labelInputsValid(inputs: LabelInputs): boolean {
	return Object.values(inputs).every((value) => {
		const trimmed = value?.trim() ?? "";
		if (!trimmed) return true;
		const parsed = Number(trimmed);
		return Number.isFinite(parsed) && parsed >= 0;
	});
}

/** Whether at least one field carries a value, so an entry has something to say. */
export function labelInputsHaveValue(inputs: LabelInputs): boolean {
	return Object.entries(inputs).some(
		([field, value]) => field !== "abvPercent" && (value?.trim() ?? "") !== "",
	);
}

export function compositionFromLabelInputs(
	inputs: LabelInputs,
): LabelComposition {
	const constituents: Record<string, number> = {};
	const energy = optionalNumber(inputs.energyKcal, "energy");
	if (energy !== null) constituents.energy = energy;
	for (const [field, code] of [
		["proteinG", "protein"],
		["carbohydrateG", "carbohydrate"],
		["fatG", "fat"],
	] as const) {
		const grams = optionalNumber(inputs[field], code);
		if (grams !== null) constituents[code] = grams / GRAMS_PER_KILOGRAM;
	}
	const caffeineMg = optionalNumber(inputs.caffeineMg, "caffeine");
	if (caffeineMg !== null) {
		constituents.caffeine = caffeineMg / MILLIGRAMS_PER_KILOGRAM;
	}
	const nicotineMg = optionalNumber(inputs.nicotineMg, "nicotine");
	if (nicotineMg !== null) {
		constituents.nicotine = nicotineMg / MILLIGRAMS_PER_KILOGRAM;
	}
	const fluidMl = optionalNumber(inputs.fluidMl, "fluid");
	const volumeL = fluidMl === null ? null : fluidMl / MILLILITRES_PER_LITRE;
	if (volumeL !== null) constituents.fluid = volumeL;
	const abvPercent = optionalNumber(inputs.abvPercent, "abv");
	if (abvPercent !== null) {
		if (abvPercent > 100) {
			throw new RangeError(i18n.t("validation:intake.abvMaximum"));
		}
		if (volumeL === null) {
			throw new RangeError(i18n.t("validation:intake.volumeWithAbv"));
		}
		constituents.ethanol = ethanolKgFromVolumeAndAbv(volumeL, abvPercent);
	}
	return { constituents, volumeL };
}
