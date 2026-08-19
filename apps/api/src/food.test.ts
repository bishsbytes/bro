import type { FoodSearchResult } from "@bro/domain/food-search";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";
import {
	FoodProviderUnavailableError,
	normaliseOpenFoodFactsProduct,
	OpenFoodFactsProvider,
} from "./food/open-food-facts.js";
import { InMemoryFoodRateLimiter } from "./routes/food.js";

const result: FoodSearchResult = {
	ref: "off:12345678",
	label: "Chicken thighs",
	brand: "Example",
	source: "Open Food Facts",
	licence: "ODbL-1.0",
	servings: [
		{
			id: "100g",
			label: "100 g",
			energyKcal: 210,
			proteinG: 26,
			carbsG: 0,
			fatG: null,
		},
	],
};

function jsonResponse(value: unknown, status = 200) {
	return new Response(JSON.stringify(value), {
		status,
		headers: { "content-type": "application/json" },
	});
}

describe("Open Food Facts normalisation", () => {
	it("keeps null distinct from zero and creates serving and 100 g choices", () => {
		expect(
			normaliseOpenFoodFactsProduct({
				code: "12345678",
				product_name: "Chicken thighs",
				brands: "Example",
				serving_size: "120 g",
				serving_quantity: 120,
				serving_quantity_unit: "g",
				nutriments: {
					"energy-kcal_100g": 210,
					proteins_100g: 26,
					carbohydrates_100g: 0,
				},
			}),
		).toEqual({
			ref: "off:12345678",
			label: "Chicken thighs",
			brand: "Example",
			source: "Open Food Facts",
			licence: "ODbL-1.0",
			servings: [
				{
					id: "serving",
					label: "120 g",
					energyKcal: 252,
					proteinG: 31.2,
					carbsG: 0,
					fatG: null,
				},
				{
					id: "100g",
					label: "100 g",
					energyKcal: 210,
					proteinG: 26,
					carbsG: 0,
					fatG: null,
				},
			],
		});
	});

	it("uses a short identified request and returns only the owned shape", async () => {
		const upstreamFetch = vi.fn(
			async (_input: string | URL | Request, _init?: RequestInit) =>
				jsonResponse({
					products: [
						{
							code: "12345678",
							product_name: "Chicken thighs",
							brands: "Example",
							nutriments: {
								"energy-kcal_100g": 210,
								proteins_100g: 26,
								carbohydrates_100g: 0,
							},
						},
					],
				}),
		);
		const provider = new OpenFoodFactsProvider({
			fetch: upstreamFetch as unknown as typeof fetch,
			baseUrl: "https://provider.test",
			timeoutMs: 50,
			userAgent: "bro-test/1.0 (test@example.test)",
		});

		await expect(provider.search("chicken thighs")).resolves.toEqual([result]);
		const [url, init] = upstreamFetch.mock.calls[0] ?? [];
		expect(String(url)).toContain("/cgi/search.pl?");
		expect(String(url)).toContain("search_terms=chicken+thighs");
		expect(init).toMatchObject({
			headers: {
				Accept: "application/json",
				"User-Agent": "bro-test/1.0 (test@example.test)",
			},
		});
	});
});

describe("public food routes", () => {
	const authHandler = vi.fn(async () => new Response(null, { status: 404 }));
	const search = vi.fn(async () => [result]);
	const findByRef = vi.fn(async (): Promise<FoodSearchResult | null> => result);
	const observe = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	function app(rateLimiter?: InMemoryFoodRateLimiter) {
		return createApp({
			auth: { handler: authHandler },
			corsOrigin: "app://",
			foodProvider: { search, findByRef },
			foodRateLimiter: rateLimiter,
			observeFoodRoute: observe,
		});
	}

	it("searches anonymously and records aggregate-only observations", async () => {
		const response = await app().request(
			"/api/food/search?q=private%20meal%20query",
			{
				headers: {
					authorization: "Bearer must-not-be-used",
					cookie: "session=must-not-be-used",
					"x-device-id": "must-not-be-used",
					"x-forwarded-for": "192.0.2.44",
				},
			},
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ results: [result] });
		expect(search).toHaveBeenCalledWith("private meal query");
		expect(authHandler).not.toHaveBeenCalled();
		expect(observe).toHaveBeenCalledWith("food_lookup_hit", {
			durationMs: expect.any(Number),
			resultCount: 1,
		});
		expect(JSON.stringify(observe.mock.calls)).not.toContain(
			"private meal query",
		);
		expect(response.headers.get("cache-control")).toBe("no-store");
	});

	it("never puts a failed query or upstream error in the observer", async () => {
		search.mockRejectedValueOnce(
			new Error("private meal query in upstream URL"),
		);
		const response = await app().request(
			"/api/food/search?q=private%20meal%20query",
		);

		expect(response.status).toBe(502);
		expect(JSON.stringify(observe.mock.calls)).not.toContain(
			"private meal query",
		);
		await expect(response.json()).resolves.toEqual({
			error: "Food search is temporarily unavailable.",
		});
	});

	it("returns timeout and not-found responses without provider details", async () => {
		search.mockRejectedValueOnce(new FoodProviderUnavailableError("timeout"));
		expect((await app().request("/api/food/search?q=chicken")).status).toBe(
			504,
		);
		findByRef.mockResolvedValueOnce(null);
		expect((await app().request("/api/food/off:00000000")).status).toBe(404);
		expect((await app().request("/api/food/usda:1")).status).toBe(404);
	});

	it("limits a coarse in-memory IP bucket", async () => {
		const rateLimiter = new InMemoryFoodRateLimiter(1, 60_000, () => 0);
		const first = await app(rateLimiter).request("/api/food/search?q=chicken", {
			headers: { "x-forwarded-for": "192.0.2.44" },
		});
		const limited = await app(rateLimiter).request(
			"/api/food/search?q=another",
			{ headers: { "x-forwarded-for": "192.0.2.99" } },
		);

		expect(first.status).toBe(200);
		expect(limited.status).toBe(429);
		expect(limited.headers.get("retry-after")).toBe("60");
	});

	it("coarsens compressed IPv6 addresses into the same /64 bucket", async () => {
		const rateLimiter = new InMemoryFoodRateLimiter(1, 60_000, () => 0);
		expect(
			(
				await app(rateLimiter).request("/api/food/search?q=chicken", {
					headers: { "x-forwarded-for": "2001:db8:1:2::1" },
				})
			).status,
		).toBe(200);
		expect(
			(
				await app(rateLimiter).request("/api/food/search?q=another", {
					headers: { "x-forwarded-for": "2001:db8:1:2::ffff" },
				})
			).status,
		).toBe(429);
	});
});
