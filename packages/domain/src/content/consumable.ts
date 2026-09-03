import { assertConstituentAmounts } from "./constituent-catalogue";
import {
	type ConsumableComposition,
	type ConsumableKind,
	isCompositionBasis,
	isPortion,
} from "./food-search";

export {
	CONSUMABLE_KINDS,
	type CompositionBasis,
	type ConsumableComposition,
	type ConsumableKind,
	isCompositionBasis,
	isConsumableComposition,
	isConsumableKind,
	isPortion,
	PER_100_G,
	PER_100_ML,
	type Portion,
} from "./food-search";

/**
 * The one shape everything taken in shares: a **consumable** is a name with a
 * composition — constituent amounts per **basis**, and **portions** that scale
 * the basis — and an intake event is a snapshot of one portion of one
 * consumable at one moment.
 *
 * System consumables (the drink and nicotine catalogues) are authored in the
 * binary and typed here; library rows (user, provider, later community) are
 * records in `@bro/mobile-model` built on the same composition shape. The
 * scaling arithmetic lives in `@bro/logic`.
 */

/** Eating and drinking are universal; these streams are on for everyone. */
export const ALWAYS_ON_CONSUMABLE_KINDS = [
	"food",
	"drink",
] as const satisfies readonly ConsumableKind[];

/**
 * Streams a person switches on. Off on a fresh install, and found rather than
 * promoted: nothing invites a non-smoker, non-supplementer in.
 */
export const OPTIONAL_STREAM_KINDS = [
	"supplement",
	"medication",
	"nicotine",
	"other",
] as const satisfies readonly ConsumableKind[];
export type OptionalStreamKind = (typeof OPTIONAL_STREAM_KINDS)[number];

export function isOptionalStreamKind(
	value: unknown,
): value is OptionalStreamKind {
	return (OPTIONAL_STREAM_KINDS as readonly unknown[]).includes(value);
}

/**
 * Kinds sensitive whole, whatever they contain. A medication or an unnamed
 * "other" is a disclosure by its label alone, so export drops every event of
 * these kinds with sensitive data off — the content-based constituent rule
 * covers alcohol and nicotine.
 */
export const SENSITIVE_CONSUMABLE_KINDS = [
	"medication",
	"other",
] as const satisfies readonly ConsumableKind[];

export function isSensitiveConsumableKind(kind: ConsumableKind): boolean {
	return (SENSITIVE_CONSUMABLE_KINDS as readonly string[]).includes(kind);
}

/**
 * Streams whose being switched on is itself a disclosure. Export drops their
 * rows with sensitive data off, alongside the events and metrics they gate.
 */
export const SENSITIVE_STREAM_KINDS = [
	"nicotine",
	"medication",
	"other",
] as const satisfies readonly OptionalStreamKind[];

export function isSensitiveStreamKind(kind: ConsumableKind): boolean {
	return (SENSITIVE_STREAM_KINDS as readonly string[]).includes(kind);
}

/**
 * Kinds community content may carry (Phase 9). Nicotine, medication, and
 * "other" cannot be published: the conservative posture, enforced by content
 * rather than copy so a client can refuse to offer "Publish" offline.
 */
export const PUBLISHABLE_CONSUMABLE_KINDS = [
	"food",
	"drink",
	"supplement",
] as const satisfies readonly ConsumableKind[];

/**
 * Where a reusable row came from. Local ids are never content ids: a
 * community item's `contentId` and `version` live here, so two devices
 * downloading the same item produce two rows that sync as two rows.
 */
export type ContentSource =
	| { type: "user" }
	| { type: "system"; key: string }
	| { type: "provider"; provider: string; externalId: string }
	| { type: "community"; contentId: string; version: number };

export type ContentSourceType = ContentSource["type"];

export const RECIPE_YIELD_UNITS = [
	"serving",
	"portion",
	"glass",
	"ml",
	"g",
] as const;
export type RecipeYieldUnit = (typeof RECIPE_YIELD_UNITS)[number];

/**
 * What a recipe makes. Its basis is one yield unit: a portion when the yield
 * is counted, mass or volume when it is weighed or measured.
 */
export type RecipeYield = { quantity: number; unit: RecipeYieldUnit };

export function isRecipeYield(value: unknown): value is RecipeYield {
	if (!value || typeof value !== "object") return false;
	const candidate = value as Partial<RecipeYield>;
	return (
		typeof candidate.quantity === "number" &&
		Number.isFinite(candidate.quantity) &&
		candidate.quantity > 0 &&
		(RECIPE_YIELD_UNITS as readonly unknown[]).includes(candidate.unit)
	);
}

/**
 * Optional, never required, suggested from the clock. A coffee at 10:30 needs
 * no meal.
 */
export const INTAKE_CONTEXTS = [
	"breakfast",
	"lunch",
	"dinner",
	"snack",
	"drink",
	"supplement",
	"medication",
	"other",
] as const;
export type IntakeContext = (typeof INTAKE_CONTEXTS)[number];

export function isIntakeContext(value: unknown): value is IntakeContext {
	return (INTAKE_CONTEXTS as readonly unknown[]).includes(value);
}

/**
 * Authored content in the binary: never in a database, versioned with the
 * release. Editing one forks it into the library with `forkedFrom` naming it.
 */
export type SystemConsumable = ConsumableComposition & {
	/** Namespaced by catalogue, as `drink:lager-4_5`. Permanent once authored. */
	key: `${string}:${string}`;
	kind: ConsumableKind;
	name: string;
};

export function isContentSource(value: unknown): value is ContentSource {
	if (!value || typeof value !== "object") return false;
	const candidate = value as Record<string, unknown>;
	switch (candidate.type) {
		case "user":
			return true;
		case "system":
			return typeof candidate.key === "string" && candidate.key.length > 0;
		case "provider":
			return (
				typeof candidate.provider === "string" &&
				candidate.provider.length > 0 &&
				typeof candidate.externalId === "string" &&
				candidate.externalId.length > 0
			);
		case "community":
			return (
				typeof candidate.contentId === "string" &&
				candidate.contentId.length > 0 &&
				typeof candidate.version === "number" &&
				Number.isInteger(candidate.version) &&
				candidate.version > 0
			);
		default:
			return false;
	}
}

/**
 * The invariants a stored composition must hold, thrown as the repositories
 * throw: portion ids unique, the default portion present, a portion basis
 * naming a portion that is exactly one of itself, and every portion able to
 * relate to the basis in at least one way that the scaling function accepts.
 */
export function assertConsumableComposition(
	composition: ConsumableComposition,
): void {
	if (!isCompositionBasis(composition.basis)) {
		throw new TypeError(
			"Consumable basis must be a mass, a volume, or a portion.",
		);
	}
	assertConstituentAmounts(composition.constituents, "Consumable constituent");
	const ids = new Set<string>();
	for (const portion of composition.portions) {
		if (!isPortion(portion)) {
			throw new TypeError(
				"Every portion must carry an id, a label, and a mass, a volume, or a basis multiple.",
			);
		}
		if (ids.has(portion.id)) {
			throw new TypeError(`Portion ids must be unique: ${portion.id}.`);
		}
		ids.add(portion.id);
	}
	if (
		composition.defaultPortionId !== null &&
		!ids.has(composition.defaultPortionId)
	) {
		throw new TypeError(
			`Default portion ${composition.defaultPortionId} is not one of the portions.`,
		);
	}
	const { basis } = composition;
	if (basis.type === "portion") {
		const basisPortion = composition.portions.find(
			(portion) => portion.id === basis.portionId,
		);
		if (!basisPortion) {
			throw new TypeError(
				`Basis portion ${basis.portionId} is not one of the portions.`,
			);
		}
		if (basisPortion.basisUnits !== 1) {
			throw new RangeError(
				`Basis portion ${basisPortion.id} must be exactly one of itself.`,
			);
		}
	}
}

/**
 * The string an event, ingredient, or item records to say what it was logged
 * or composed from: `system:drink:lager-4_5`, `off:5000112637922`,
 * `community:<id>@<version>`, or `library:<id>` for a user row.
 */
export function sourceRefOf(
	source: ContentSource,
	libraryId: string | null = null,
): string | null {
	switch (source.type) {
		case "system":
			return `system:${source.key}`;
		case "provider":
			return `${source.provider}:${source.externalId}`;
		case "community":
			return `community:${source.contentId}@${source.version}`;
		case "user":
			return libraryId === null ? null : `library:${libraryId}`;
	}
}

/**
 * Reads a provider ref of the `provider:externalId` form the search API uses.
 * Anything else is not a provider ref and returns null rather than guessing.
 */
export function providerSourceOf(ref: string): ContentSource | null {
	const match = /^([^:\s]+):(.+)$/.exec(ref.trim());
	if (
		!match ||
		match[1] === "system" ||
		match[1] === "community" ||
		match[1] === "library"
	) {
		return null;
	}
	return {
		type: "provider",
		provider: match[1] as string,
		externalId: match[2] as string,
	};
}

/** The provider source a library row records for a search result. */
export function externalConsumableSource(consumable: {
	ref: string;
}): ContentSource {
	const source = providerSourceOf(consumable.ref);
	if (!source) {
		throw new TypeError(
			`External consumable ref is not a provider ref: ${consumable.ref}`,
		);
	}
	return source;
}
