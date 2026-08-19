import {
	FOOD_DATA_LICENCE,
	FOOD_DATA_SOURCE,
	type FoodSearchResult,
	type FoodSearchServing,
} from "@bro/domain/food-search";

export type FoodProvider = {
	search(query: string): Promise<FoodSearchResult[]>;
	findByRef(ref: string): Promise<FoodSearchResult | null>;
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
	"serving_size",
	"serving_quantity",
	"serving_quantity_unit",
	"nutriments",
].join(",");

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

function nutrient(
	nutriments: OpenFoodFactsNutriments,
	name: string,
	suffix: "serving" | "100g",
): number | null {
	return finiteNonNegative(nutriments[`${name}_${suffix}`]);
}

function energyKcal(
	nutriments: OpenFoodFactsNutriments,
	suffix: "serving" | "100g",
): number | null {
	const kcal = nutrient(nutriments, "energy-kcal", suffix);
	if (kcal !== null) return kcal;
	const kilojoules = nutrient(nutriments, "energy-kj", suffix);
	return kilojoules === null ? null : kilojoules / 4.184;
}

function nutrition(
	nutriments: OpenFoodFactsNutriments,
	suffix: "serving" | "100g",
): Omit<FoodSearchServing, "id" | "label"> {
	return {
		energyKcal: energyKcal(nutriments, suffix),
		proteinG: nutrient(nutriments, "proteins", suffix),
		carbsG: nutrient(nutriments, "carbohydrates", suffix),
		fatG: nutrient(nutriments, "fat", suffix),
	};
}

function hasKnownNutrition(
	values: Omit<FoodSearchServing, "id" | "label">,
): boolean {
	return Object.values(values).some((value) => value !== null);
}

function scaledNutrition(
	values: Omit<FoodSearchServing, "id" | "label">,
	factor: number,
): Omit<FoodSearchServing, "id" | "label"> {
	return {
		energyKcal: values.energyKcal === null ? null : values.energyKcal * factor,
		proteinG: values.proteinG === null ? null : values.proteinG * factor,
		carbsG: values.carbsG === null ? null : values.carbsG * factor,
		fatG: values.fatG === null ? null : values.fatG * factor,
	};
}

export function normaliseOpenFoodFactsProduct(
	product: OpenFoodFactsProduct,
): FoodSearchResult | null {
	const code = nonEmptyString(product.code);
	const label =
		nonEmptyString(product.product_name) ??
		nonEmptyString(product.generic_name);
	if (!code || !/^\d+$/.test(code) || !label) return null;

	const nutriments =
		product.nutriments && typeof product.nutriments === "object"
			? product.nutriments
			: {};
	const per100g = nutrition(nutriments, "100g");
	const directServing = nutrition(nutriments, "serving");
	const servingLabel = nonEmptyString(product.serving_size);
	const servingQuantity = finiteNonNegative(product.serving_quantity);
	const servingUnit = nonEmptyString(
		product.serving_quantity_unit,
	)?.toLowerCase();
	const canScaleGrams =
		servingQuantity !== null &&
		(servingUnit === "g" ||
			(!servingUnit && servingLabel?.toLowerCase().includes("g")));
	const servingNutrition = hasKnownNutrition(directServing)
		? directServing
		: canScaleGrams
			? scaledNutrition(per100g, servingQuantity / 100)
			: directServing;
	const servings: FoodSearchServing[] = [];
	if (servingLabel && (hasKnownNutrition(servingNutrition) || canScaleGrams)) {
		servings.push({ id: "serving", label: servingLabel, ...servingNutrition });
	}
	servings.push({ id: "100g", label: "100 g", ...per100g });

	return {
		ref: `off:${code}`,
		label,
		brand: nonEmptyString(product.brands),
		source: FOOD_DATA_SOURCE,
		licence: FOOD_DATA_LICENCE,
		servings,
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

	async search(query: string): Promise<FoodSearchResult[]> {
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

	async findByRef(ref: string): Promise<FoodSearchResult | null> {
		const match = /^off:(\d+)$/.exec(ref);
		if (!match) return null;
		const params = new URLSearchParams({ fields: PRODUCT_FIELDS });
		const payload = await this.request<ProductPayload>(
			`${this.baseUrl}/api/v2/product/${match[1]}?${params}`,
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
