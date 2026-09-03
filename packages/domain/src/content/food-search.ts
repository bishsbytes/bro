/**
 * The external consumable contract, and the base consumable shapes it is built
 * from.
 *
 * This module is what `apps/api` imports, and the API type-checks under Node's
 * ESM resolution, which refuses extensionless relative imports in the
 * declaration output. So this file imports nothing relative: the shapes a
 * provider result shares with the library — kinds, basis, portions, the
 * constituent map — are defined here and re-exported by `./consumable` and
 * `./constituent-catalogue`, which the app reads through its bundler.
 */

/**
 * Six kinds, and they drive UI, not behaviour. An event snapshots its
 * consumable's kind so the stream views can partition it; nothing in the
 * calculation layer branches on it. `nicotine` is a kind rather than a flavour
 * of `other` because its gating, sensitivity, and habit rules are keyed on it.
 */
export const CONSUMABLE_KINDS = [
	"food",
	"drink",
	"supplement",
	"medication",
	"nicotine",
	"other",
] as const;
export type ConsumableKind = (typeof CONSUMABLE_KINDS)[number];

export function isConsumableKind(value: unknown): value is ConsumableKind {
	return (CONSUMABLE_KINDS as readonly unknown[]).includes(value);
}

/**
 * code → canonical amount. A present zero means "measured as none"; an absent
 * code means "not applicable or unknown". Unknown codes are preserved, not
 * summed.
 */
export type ConstituentAmounts = Readonly<Record<string, number>>;

export function isConstituentAmounts(
	value: unknown,
): value is ConstituentAmounts {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	return Object.entries(value).every(
		([code, amount]) =>
			code.trim().length > 0 &&
			typeof amount === "number" &&
			Number.isFinite(amount) &&
			amount >= 0,
	);
}

/**
 * What the constituent amounts are per. A portion basis names the portion the
 * numbers describe; the other portions relate to it by `basisUnits`.
 */
export type CompositionBasis =
	| { type: "mass"; massKg: number }
	| { type: "volume"; volumeL: number }
	| { type: "portion"; portionId: string };

/** Nutrition labels and provider data are per 100 g or per 100 ml. */
export const PER_100_G = { type: "mass", massKg: 0.1 } as const;
export const PER_100_ML = { type: "volume", volumeL: 0.1 } as const;

/**
 * A way of expressing quantity. A portion carries a mass, a volume, or a
 * multiple of the basis portion — half a cigarette is 0.5, a pack of two
 * tablets is 2 — and may carry more than one so the amount consumed is known
 * even when only one relates it to the basis.
 */
export type Portion = {
	id: string;
	/** "pint", "1 medium", "tablet". */
	label: string;
	massKg: number | null;
	volumeL: number | null;
	basisUnits: number | null;
};

/** The composition half of a consumable, shared by catalogue and library. */
export type ConsumableComposition = {
	basis: CompositionBasis;
	/** Per basis. */
	constituents: ConstituentAmounts;
	portions: readonly Portion[];
	defaultPortionId: string | null;
};

function finitePositive(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function nullableFinitePositive(value: unknown): value is number | null {
	return value === null || finitePositive(value);
}

export function isCompositionBasis(value: unknown): value is CompositionBasis {
	if (!value || typeof value !== "object") return false;
	const candidate = value as { type?: unknown } & Record<string, unknown>;
	if (candidate.type === "mass") return finitePositive(candidate.massKg);
	if (candidate.type === "volume") return finitePositive(candidate.volumeL);
	if (candidate.type === "portion") {
		return (
			typeof candidate.portionId === "string" &&
			candidate.portionId.trim().length > 0
		);
	}
	return false;
}

export function isPortion(value: unknown): value is Portion {
	if (!value || typeof value !== "object") return false;
	const candidate = value as Partial<Portion>;
	return (
		typeof candidate.id === "string" &&
		candidate.id.trim().length > 0 &&
		typeof candidate.label === "string" &&
		candidate.label.trim().length > 0 &&
		nullableFinitePositive(candidate.massKg) &&
		nullableFinitePositive(candidate.volumeL) &&
		nullableFinitePositive(candidate.basisUnits) &&
		(candidate.massKg !== null ||
			candidate.volumeL !== null ||
			candidate.basisUnits !== null)
	);
}

export function isConsumableComposition(
	value: unknown,
): value is ConsumableComposition {
	if (!value || typeof value !== "object") return false;
	const candidate = value as Partial<ConsumableComposition>;
	return (
		isCompositionBasis(candidate.basis) &&
		isConstituentAmounts(candidate.constituents) &&
		Array.isArray(candidate.portions) &&
		candidate.portions.every(isPortion) &&
		(candidate.defaultPortionId === null ||
			typeof candidate.defaultPortionId === "string")
	);
}

export const FOOD_DATA_SOURCE = "Open Food Facts" as const;
export const FOOD_DATA_LICENCE = "ODbL-1.0" as const;

/**
 * Provider-neutral consumable data returned by bro's public lookup endpoint:
 * the consumable shape with the full constituent map the provider knows, so a
 * logged snapshot carries everything from the first event written. `ref` is
 * namespaced by provider (`off:<barcode>`) and is what the library row's
 * provider source and the event's `sourceRef` record.
 */
export type ExternalConsumable = ConsumableComposition & {
	ref: string;
	name: string;
	brand: string | null;
	barcode: string | null;
	kind: ConsumableKind;
	/** The provider's display name, for attribution. */
	source: string;
	/** The licence its data is published under. */
	licence: string;
};

export type ExternalConsumableResponse = {
	results: ExternalConsumable[];
};

export function isExternalConsumable(
	value: unknown,
): value is ExternalConsumable {
	if (!value || typeof value !== "object") return false;
	const candidate = value as Partial<ExternalConsumable>;
	return (
		typeof candidate.ref === "string" &&
		/^[^:\s]+:.+$/.test(candidate.ref) &&
		typeof candidate.name === "string" &&
		candidate.name.trim().length > 0 &&
		(candidate.brand === null || typeof candidate.brand === "string") &&
		(candidate.barcode === null || typeof candidate.barcode === "string") &&
		isConsumableKind(candidate.kind) &&
		typeof candidate.source === "string" &&
		typeof candidate.licence === "string" &&
		isConsumableComposition(candidate)
	);
}

export function isExternalConsumableResponse(
	value: unknown,
): value is ExternalConsumableResponse {
	return (
		value !== null &&
		typeof value === "object" &&
		Array.isArray((value as Partial<ExternalConsumableResponse>).results) &&
		(value as ExternalConsumableResponse).results.every(isExternalConsumable)
	);
}
