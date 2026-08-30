import { ETHANOL_DENSITY_G_PER_ML } from "../units/conversion";

export { ETHANOL_DENSITY_G_PER_ML } from "../units/conversion";

export type DrinkCatalogueKind = "alcoholic" | "caffeinated" | "hydration";

export type DrinkCatalogueServing = {
	id: string;
	label: string;
	volumeL: number;
	abvPercent: number;
	caffeineMg: number;
	energyKcal: number;
};

export type DrinkCatalogueEntry = {
	id: `drink:${string}`;
	label: string;
	kind: DrinkCatalogueKind;
	servings: readonly DrinkCatalogueServing[];
};

export type DrinkServingSnapshot = {
	catalogueRef: string;
	label: string;
	servingLabel: string;
	quantity: number;
	volumeL: number;
	ethanolKg: number;
	caffeineKg: number;
	energyKcal: number;
};

/** Exact imperial pint; servings own regional definitions, totals do not. */
export const UK_PINT_L = 0.568_261_25;
export const UK_HALF_PINT_L = UK_PINT_L / 2;
/** Exact US customary 12 fl oz serving. */
export const US_TWELVE_FL_OZ_L = 0.354_882_354_75;
/** Exact US customary 5 fl oz wine serving. */
export const US_FIVE_FL_OZ_L = 0.147_867_647_812_5;
/** Exact US customary 1.5 fl oz spirit serving. */
export const US_ONE_AND_A_HALF_FL_OZ_L = 0.044_360_294_343_75;
/** Exact US customary 8 fl oz cup. */
export const US_EIGHT_FL_OZ_L = 0.236_588_236_5;

/**
 * Authored, offline drink content. A log action snapshots every selected value,
 * so edits or removals here never change an existing consumption entry.
 */
export const DRINK_CATALOGUE = [
	{
		id: "drink:lager-4_5",
		label: "Lager, 4.5%",
		kind: "alcoholic",
		servings: [
			{
				id: "pint-uk",
				label: "pint",
				volumeL: UK_PINT_L,
				abvPercent: 4.5,
				caffeineMg: 0,
				energyKcal: 244,
			},
			{
				id: "half-pint-uk",
				label: "half pint",
				volumeL: UK_HALF_PINT_L,
				abvPercent: 4.5,
				caffeineMg: 0,
				energyKcal: 122,
			},
			{
				id: "can-330ml",
				label: "330 ml can",
				volumeL: 0.33,
				abvPercent: 4.5,
				caffeineMg: 0,
				energyKcal: 142,
			},
			{
				id: "can-440ml",
				label: "440 ml can",
				volumeL: 0.44,
				abvPercent: 4.5,
				caffeineMg: 0,
				energyKcal: 189,
			},
			{
				id: "bottle-12floz-us",
				label: "12 fl oz bottle",
				volumeL: US_TWELVE_FL_OZ_L,
				abvPercent: 4.5,
				caffeineMg: 0,
				energyKcal: 153,
			},
		],
	},
	{
		id: "drink:cider-4_5",
		label: "Cider, 4.5%",
		kind: "alcoholic",
		servings: [
			{
				id: "pint-uk",
				label: "pint",
				volumeL: UK_PINT_L,
				abvPercent: 4.5,
				caffeineMg: 0,
				energyKcal: 238,
			},
			{
				id: "half-pint-uk",
				label: "half pint",
				volumeL: UK_HALF_PINT_L,
				abvPercent: 4.5,
				caffeineMg: 0,
				energyKcal: 119,
			},
			{
				id: "can-440ml",
				label: "440 ml can",
				volumeL: 0.44,
				abvPercent: 4.5,
				caffeineMg: 0,
				energyKcal: 184,
			},
			{
				id: "bottle-12floz-us",
				label: "12 fl oz bottle",
				volumeL: US_TWELVE_FL_OZ_L,
				abvPercent: 4.5,
				caffeineMg: 0,
				energyKcal: 149,
			},
		],
	},
	{
		id: "drink:wine-red-13",
		label: "Red wine, 13%",
		kind: "alcoholic",
		servings: [
			{
				id: "glass-125ml",
				label: "125 ml glass",
				volumeL: 0.125,
				abvPercent: 13,
				caffeineMg: 0,
				energyKcal: 106,
			},
			{
				id: "glass-175ml",
				label: "175 ml glass",
				volumeL: 0.175,
				abvPercent: 13,
				caffeineMg: 0,
				energyKcal: 149,
			},
			{
				id: "glass-250ml",
				label: "250 ml glass",
				volumeL: 0.25,
				abvPercent: 13,
				caffeineMg: 0,
				energyKcal: 213,
			},
			{
				id: "glass-5floz-us",
				label: "5 fl oz glass",
				volumeL: US_FIVE_FL_OZ_L,
				abvPercent: 13,
				caffeineMg: 0,
				energyKcal: 126,
			},
		],
	},
	{
		id: "drink:wine-white-12",
		label: "White wine, 12%",
		kind: "alcoholic",
		servings: [
			{
				id: "glass-125ml",
				label: "125 ml glass",
				volumeL: 0.125,
				abvPercent: 12,
				caffeineMg: 0,
				energyKcal: 103,
			},
			{
				id: "glass-175ml",
				label: "175 ml glass",
				volumeL: 0.175,
				abvPercent: 12,
				caffeineMg: 0,
				energyKcal: 144,
			},
			{
				id: "glass-250ml",
				label: "250 ml glass",
				volumeL: 0.25,
				abvPercent: 12,
				caffeineMg: 0,
				energyKcal: 206,
			},
			{
				id: "glass-5floz-us",
				label: "5 fl oz glass",
				volumeL: US_FIVE_FL_OZ_L,
				abvPercent: 12,
				caffeineMg: 0,
				energyKcal: 122,
			},
		],
	},
	{
		id: "drink:spirit-40",
		label: "Spirit, 40%",
		kind: "alcoholic",
		servings: [
			{
				id: "single-25ml",
				label: "25 ml single",
				volumeL: 0.025,
				abvPercent: 40,
				caffeineMg: 0,
				energyKcal: 55,
			},
			{
				id: "double-50ml",
				label: "50 ml double",
				volumeL: 0.05,
				abvPercent: 40,
				caffeineMg: 0,
				energyKcal: 111,
			},
			{
				id: "shot-1_5floz-us",
				label: "1.5 fl oz shot",
				volumeL: US_ONE_AND_A_HALF_FL_OZ_L,
				abvPercent: 40,
				caffeineMg: 0,
				energyKcal: 98,
			},
		],
	},
	{
		id: "drink:filter-coffee",
		label: "Filter coffee",
		kind: "caffeinated",
		servings: [
			{
				id: "mug-250ml",
				label: "250 ml mug",
				volumeL: 0.25,
				abvPercent: 0,
				caffeineMg: 95,
				energyKcal: 2,
			},
			{
				id: "cup-8floz-us",
				label: "8 fl oz cup",
				volumeL: US_EIGHT_FL_OZ_L,
				abvPercent: 0,
				caffeineMg: 95,
				energyKcal: 2,
			},
		],
	},
	{
		id: "drink:tea",
		label: "Tea",
		kind: "caffeinated",
		servings: [
			{
				id: "mug-250ml",
				label: "250 ml mug",
				volumeL: 0.25,
				abvPercent: 0,
				caffeineMg: 47,
				energyKcal: 2,
			},
			{
				id: "cup-8floz-us",
				label: "8 fl oz cup",
				volumeL: US_EIGHT_FL_OZ_L,
				abvPercent: 0,
				caffeineMg: 47,
				energyKcal: 2,
			},
		],
	},
	{
		id: "drink:espresso",
		label: "Espresso",
		kind: "caffeinated",
		servings: [
			{
				id: "single-30ml",
				label: "30 ml single",
				volumeL: 0.03,
				abvPercent: 0,
				caffeineMg: 63,
				energyKcal: 2,
			},
			{
				id: "double-60ml",
				label: "60 ml double",
				volumeL: 0.06,
				abvPercent: 0,
				caffeineMg: 126,
				energyKcal: 4,
			},
		],
	},
	{
		id: "drink:energy-drink",
		label: "Energy drink",
		kind: "caffeinated",
		servings: [
			{
				id: "can-250ml",
				label: "250 ml can",
				volumeL: 0.25,
				abvPercent: 0,
				caffeineMg: 80,
				energyKcal: 110,
			},
		],
	},
	{
		id: "drink:cola",
		label: "Cola",
		kind: "caffeinated",
		servings: [
			{
				id: "can-330ml",
				label: "330 ml can",
				volumeL: 0.33,
				abvPercent: 0,
				caffeineMg: 32,
				energyKcal: 139,
			},
			{
				id: "can-12floz-us",
				label: "12 fl oz can",
				volumeL: US_TWELVE_FL_OZ_L,
				abvPercent: 0,
				caffeineMg: 34,
				energyKcal: 150,
			},
		],
	},
	{
		id: "drink:water",
		label: "Water",
		kind: "hydration",
		servings: [
			{
				id: "glass-250ml",
				label: "250 ml glass",
				volumeL: 0.25,
				abvPercent: 0,
				caffeineMg: 0,
				energyKcal: 0,
			},
			{
				id: "bottle-500ml",
				label: "500 ml bottle",
				volumeL: 0.5,
				abvPercent: 0,
				caffeineMg: 0,
				energyKcal: 0,
			},
			{
				id: "glass-8floz-us",
				label: "8 fl oz glass",
				volumeL: US_EIGHT_FL_OZ_L,
				abvPercent: 0,
				caffeineMg: 0,
				energyKcal: 0,
			},
		],
	},
] as const satisfies readonly DrinkCatalogueEntry[];

const drinksById = new Map<string, DrinkCatalogueEntry>(
	DRINK_CATALOGUE.map((drink) => [drink.id, drink]),
);

function assertNonNegative(value: number, label: string): void {
	if (!Number.isFinite(value) || value < 0) {
		throw new RangeError(`${label} must be finite and non-negative.`);
	}
}

export function ethanolKgFromVolumeAndAbv(
	volumeL: number,
	abvPercent: number,
): number {
	assertNonNegative(volumeL, "Drink volume");
	assertNonNegative(abvPercent, "Drink ABV");
	if (abvPercent > 100) {
		throw new RangeError("Drink ABV must not exceed 100%.");
	}
	return (
		(volumeL * 1_000 * (abvPercent / 100) * ETHANOL_DENSITY_G_PER_ML) / 1_000
	);
}

export function snapshotDrinkServing(
	drink: DrinkCatalogueEntry,
	serving: DrinkCatalogueServing,
	quantity: number,
): DrinkServingSnapshot {
	if (!Number.isFinite(quantity) || quantity <= 0) {
		throw new RangeError("Drink quantity must be finite and positive.");
	}
	return {
		catalogueRef: drink.id,
		label: drink.label,
		servingLabel: serving.label,
		quantity,
		volumeL: serving.volumeL * quantity,
		ethanolKg:
			ethanolKgFromVolumeAndAbv(serving.volumeL, serving.abvPercent) * quantity,
		caffeineKg: (serving.caffeineMg / 1_000_000) * quantity,
		energyKcal: serving.energyKcal * quantity,
	};
}

export function resolveDrink(id: string): DrinkCatalogueEntry | null {
	return drinksById.get(id) ?? null;
}
