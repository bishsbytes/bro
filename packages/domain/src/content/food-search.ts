export const FOOD_DATA_SOURCE = "Open Food Facts" as const;
export const FOOD_DATA_LICENCE = "ODbL-1.0" as const;

export type FoodSearchServing = {
	id: string;
	label: string;
	energyKcal: number | null;
	proteinG: number | null;
	carbsG: number | null;
	fatG: number | null;
};

/** Provider-neutral food data returned by bro's public lookup endpoint. */
export type FoodSearchResult = {
	ref: string;
	label: string;
	brand: string | null;
	source: string;
	licence: string;
	servings: FoodSearchServing[];
};

export type FoodSearchResponse = {
	results: FoodSearchResult[];
};

function nullableFiniteNonNegative(value: unknown): value is number | null {
	return (
		value === null ||
		(typeof value === "number" && Number.isFinite(value) && value >= 0)
	);
}

export function isFoodSearchResult(value: unknown): value is FoodSearchResult {
	if (!value || typeof value !== "object") return false;
	const candidate = value as Partial<FoodSearchResult>;
	return (
		typeof candidate.ref === "string" &&
		/^[^:\s]+:.+$/.test(candidate.ref) &&
		typeof candidate.label === "string" &&
		candidate.label.trim().length > 0 &&
		(candidate.brand === null || typeof candidate.brand === "string") &&
		typeof candidate.source === "string" &&
		typeof candidate.licence === "string" &&
		Array.isArray(candidate.servings) &&
		candidate.servings.length > 0 &&
		candidate.servings.every(
			(serving) =>
				serving !== null &&
				typeof serving === "object" &&
				typeof serving.id === "string" &&
				typeof serving.label === "string" &&
				nullableFiniteNonNegative(serving.energyKcal) &&
				nullableFiniteNonNegative(serving.proteinG) &&
				nullableFiniteNonNegative(serving.carbsG) &&
				nullableFiniteNonNegative(serving.fatG),
		)
	);
}

export function isFoodSearchResponse(
	value: unknown,
): value is FoodSearchResponse {
	return (
		value !== null &&
		typeof value === "object" &&
		Array.isArray((value as Partial<FoodSearchResponse>).results) &&
		(value as FoodSearchResponse).results.every(isFoodSearchResult)
	);
}
