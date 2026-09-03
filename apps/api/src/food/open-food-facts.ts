import {
	type ConstituentAmounts,
	type ConsumableKind,
	type ExternalConsumable,
	FOOD_DATA_LICENCE,
	FOOD_DATA_SOURCE,
	PER_100_G,
	PER_100_ML,
	type Portion,
} from "@bro/domain/food-search";

export type FoodProvider = {
	search(query: string): Promise<ExternalConsumable[]>;
	findByRef(ref: string): Promise<ExternalConsumable | null>;
	findByBarcode(barcode: string): Promise<ExternalConsumable | null>;
};

type ProviderFetch = typeof fetch;

type OpenFoodFactsOptions = {
	fetch?: ProviderFetch;
	baseUrl?: string;
	timeoutMs?: number;
	userAgent: string;
};

type OpenFoodFactsNutriments = Record<string, unknown>;

type OpenFoodFactsProduct = {
	code?: unknown;
	product_name?: unknown;
	generic_name?: unknown;
	brands?: unknown;
	categories_tags?: unknown;
	serving_size?: unknown;
	serving_quantity?: unknown;
	serving_quantity_unit?: unknown;
	nutriments?: OpenFoodFactsNutriments;
};

type SearchPayload = { products?: unknown };
type ProductPayload = { status?: unknown; product?: unknown };

const PRODUCT_FIELDS = [
	"code",
	"product_name",
	"generic_name",
	"brands",
	"categories_tags",
	"serving_size",
	"serving_quantity",
	"serving_quantity_unit",
	"nutriments",
].join(",");

/** The label convention: salt is sodium × 2.5. */
const SALT_GRAMS_PER_SODIUM_GRAM = 2.5;
const KILOJOULES_PER_KILOCALORIE = 4.184;
const GRAMS_PER_KILOGRAM = 1_000;
const MILLILITRES_PER_LITRE = 1_000;

/**
 * Open Food Facts nutriment keys, mapped to constituent codes. Every `_100g`
 * mass value is in grams; for a liquid the suffix means per 100 ml. Energy is
 * kcal or kJ. Nothing else the provider knows reaches the client — the
 * constituent map is the whole contract.
 *
 * Alcohol is deliberately absent: the provider declares it as % by volume
 * against a provider basis, which cannot be converted honestly without a
 * density. A beer from a barcode carries its energy and sugar, not its ethanol.
 */
const MASS_NUTRIMENTS = [
	["proteins", "protein"],
	["carbohydrates", "carbohydrate"],
	["fat", "fat"],
	["saturated-fat", "saturated_fat"],
	["sugars", "sugar"],
	["fiber", "fibre"],
	["caffeine", "caffeine"],
	["vitamin-a", "vitamin_a"],
	["vitamin-d", "vitamin_d"],
	["vitamin-b12", "vitamin_b12"],
	["folates", "folate"],
	["vitamin-c", "vitamin_c"],
	["calcium", "calcium"],
	["iron", "iron"],
	["magnesium", "magnesium"],
	["potassium", "potassium"],
	["zinc", "zinc"],
] as const;

export class FoodProviderUnavailableError extends Error {
	constructor(readonly reason: "timeout" | "upstream") {
		super("Food lookup is temporarily unavailable.");
		this.name = "FoodProviderUnavailableError";
	}
}

function nonEmptyString(value: unknown): string | null {
	return typeof value === "string" && value.trim() ? value.trim() : null;
}

function finiteNonNegative(value: unknown): number | null {
	const parsed =
		typeof value === "number"
			? value
			: typeof value === "string" && value.trim()
				? Number(value)
				: Number.NaN;
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function nutrientPer100g(
	nutriments: OpenFoodFactsNutriments,
	name: string,
): number | null {
	return finiteNonNegative(nutriments[`${name}_100g`]);
}

function energyKcalPer100g(nutriments: OpenFoodFactsNutriments): number | null {
	const kcal = nutrientPer100g(nutriments, "energy-kcal");
	if (kcal !== null) return kcal;
	const kilojoules = nutrientPer100g(nutriments, "energy-kj");
	return kilojoules === null ? null : kilojoules / KILOJOULES_PER_KILOCALORIE;
}

/**
 * The constituent map per provider 100-unit basis in canonical units:
 * kilocalories for energy, kilograms for every mass. Absent nutriments stay
 * absent — "not applicable or unknown" — and a declared zero stays a zero.
 */
function constituentsPer100g(
	nutriments: OpenFoodFactsNutriments,
): ConstituentAmounts {
	const amounts: Record<string, number> = {};
	const energy = energyKcalPer100g(nutriments);
	if (energy !== null) amounts.energy = energy;
	for (const [nutriment, code] of MASS_NUTRIMENTS) {
		const grams = nutrientPer100g(nutriments, nutriment);
		if (grams !== null) amounts[code] = grams / GRAMS_PER_KILOGRAM;
	}
	const sodiumG = nutrientPer100g(nutriments, "sodium");
	const saltG = nutrientPer100g(nutriments, "salt");
	if (sodiumG !== null) {
		amounts.sodium = sodiumG / GRAMS_PER_KILOGRAM;
	} else if (saltG !== null) {
		amounts.sodium = saltG / SALT_GRAMS_PER_SODIUM_GRAM / GRAMS_PER_KILOGRAM;
	}
	return amounts;
}

function kindOf(product: OpenFoodFactsProduct): ConsumableKind {
	return Array.isArray(product.categories_tags) &&
		product.categories_tags.includes("en:beverages")
		? "drink"
		: "food";
}

/**
 * A declared serving becomes a portion only when its dimension matches the
 * product's provider basis. A relation that would require guessing density is
 * omitted. The native 100 g or 100 ml portion is always offered.
 */
function portionsOf(
	product: OpenFoodFactsProduct,
	kind: ConsumableKind,
): {
	portions: Portion[];
	defaultPortionId: string;
} {
	const portions: Portion[] = [];
	const servingLabel = nonEmptyString(product.serving_size);
	const servingQuantity = finiteNonNegative(product.serving_quantity);
	const servingUnit = nonEmptyString(
		product.serving_quantity_unit,
	)?.toLowerCase();
	const expectedUnit = kind === "drink" ? "ml" : "g";
	const servingMatchesBasis =
		servingQuantity !== null &&
		servingQuantity > 0 &&
		(servingUnit === expectedUnit ||
			(!servingUnit &&
				new RegExp(`\\b${expectedUnit}\\b`, "i").test(servingLabel ?? "")));
	if (servingLabel && servingMatchesBasis) {
		portions.push({
			id: "serving",
			label: servingLabel,
			massKg: kind === "food" ? servingQuantity / GRAMS_PER_KILOGRAM : null,
			volumeL:
				kind === "drink" ? servingQuantity / MILLILITRES_PER_LITRE : null,
			basisUnits: null,
		});
	}
	const providerPortion = kind === "drink" ? PER_100_ML : PER_100_G;
	portions.push({
		id: kind === "drink" ? "100ml" : "100g",
		label: kind === "drink" ? "100 ml" : "100 g",
		massKg: providerPortion.type === "mass" ? providerPortion.massKg : null,
		volumeL: providerPortion.type === "volume" ? providerPortion.volumeL : null,
		basisUnits: null,
	});
	return {
		portions,
		defaultPortionId: portions[0]?.id ?? (kind === "drink" ? "100ml" : "100g"),
	};
}

export function normaliseOpenFoodFactsProduct(
	product: OpenFoodFactsProduct,
): ExternalConsumable | null {
	const code = nonEmptyString(product.code);
	const name =
		nonEmptyString(product.product_name) ??
		nonEmptyString(product.generic_name);
	if (!code || !/^\d+$/.test(code) || !name) return null;

	const nutriments =
		product.nutriments && typeof product.nutriments === "object"
			? product.nutriments
			: {};
	const constituents = constituentsPer100g(nutriments);
	// A product the provider knows nothing about nutritionally cannot be logged
	// as intake; it is not a result.
	if (Object.keys(constituents).length === 0) return null;

	const kind = kindOf(product);
	return {
		ref: `off:${code}`,
		name,
		brand: nonEmptyString(product.brands),
		barcode: code,
		kind,
		basis: kind === "drink" ? PER_100_ML : PER_100_G,
		constituents,
		...portionsOf(product, kind),
		source: FOOD_DATA_SOURCE,
		licence: FOOD_DATA_LICENCE,
	};
}

function isProduct(value: unknown): value is OpenFoodFactsProduct {
	return value !== null && typeof value === "object";
}

export class OpenFoodFactsProvider implements FoodProvider {
	private readonly fetch: ProviderFetch;
	private readonly baseUrl: string;
	private readonly timeoutMs: number;
	private readonly userAgent: string;

	constructor(options: OpenFoodFactsOptions) {
		this.fetch = options.fetch ?? globalThis.fetch;
		this.baseUrl = (
			options.baseUrl ?? "https://world.openfoodfacts.org"
		).replace(/\/$/, "");
		this.timeoutMs = options.timeoutMs ?? 4_000;
		this.userAgent = options.userAgent;
	}

	async search(query: string): Promise<ExternalConsumable[]> {
		const params = new URLSearchParams({
			search_terms: query,
			search_simple: "1",
			action: "process",
			json: "1",
			page_size: "20",
			fields: PRODUCT_FIELDS,
		});
		const payload = await this.request<SearchPayload>(
			`${this.baseUrl}/cgi/search.pl?${params}`,
		);
		if (!Array.isArray(payload.products)) return [];
		const seen = new Set<string>();
		return payload.products.flatMap((candidate) => {
			if (!isProduct(candidate)) return [];
			const result = normaliseOpenFoodFactsProduct(candidate);
			if (!result || seen.has(result.ref)) return [];
			seen.add(result.ref);
			return [result];
		});
	}

	async findByRef(ref: string): Promise<ExternalConsumable | null> {
		const match = /^off:(\d+)$/.exec(ref);
		return match ? await this.findByBarcode(match[1] as string) : null;
	}

	async findByBarcode(barcode: string): Promise<ExternalConsumable | null> {
		if (!/^\d+$/.test(barcode)) return null;
		const params = new URLSearchParams({ fields: PRODUCT_FIELDS });
		const payload = await this.request<ProductPayload>(
			`${this.baseUrl}/api/v2/product/${barcode}?${params}`,
		);
		return payload.status === 1 && isProduct(payload.product)
			? normaliseOpenFoodFactsProduct(payload.product)
			: null;
	}

	private async request<Payload>(url: string): Promise<Payload> {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
		try {
			const response = await this.fetch(url, {
				headers: {
					Accept: "application/json",
					"User-Agent": this.userAgent,
				},
				signal: controller.signal,
			});
			if (!response.ok) throw new FoodProviderUnavailableError("upstream");
			return (await response.json()) as Payload;
		} catch (error) {
			if (error instanceof FoodProviderUnavailableError) throw error;
			throw new FoodProviderUnavailableError(
				controller.signal.aborted ? "timeout" : "upstream",
			);
		} finally {
			clearTimeout(timeout);
		}
	}
}
