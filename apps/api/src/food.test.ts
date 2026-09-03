import type { ExternalConsumable } from "@bro/domain/food-search";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";
import {
	FoodProviderUnavailableError,
	normaliseOpenFoodFactsProduct,
	OpenFoodFactsProvider,
} from "./food/open-food-facts.js";
import { coarseBucketOf, InMemoryFoodRateLimiter } from "./routes/food.js";

const result: ExternalConsumable = {
	ref: "off:12345678",
	name: "Chicken thighs",
	brand: "Example",
	barcode: "12345678",
	kind: "food",
	basis: { type: "mass", massKg: 0.1 },
	constituents: { energy: 210, protein: 0.026, carbohydrate: 0 },
	portions: [
		{
			id: "100g",
			label: "100 g",
			massKg: 0.1,
			volumeL: null,
			basisUnits: null,
		},
	],
	defaultPortionId: "100g",
	source: "Open Food Facts",
	licence: "ODbL-1.0",
};

function jsonResponse(value: unknown, status = 200) {
	return new Response(JSON.stringify(value), {
		status,
		headers: { "content-type": "application/json" },
	});
}

describe("Open Food Facts normalisation", () => {
	it("returns the consumable shape per 100 g with every constituent it knows", () => {
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
					"saturated-fat_100g": 2.1,
					salt_100g: 0.5,
					"vitamin-b12_100g": 0.0000012,
					iron_100g: 0.0011,
				},
			}),
		).toEqual({
			ref: "off:12345678",
			name: "Chicken thighs",
			brand: "Example",
			barcode: "12345678",
			kind: "food",
			basis: { type: "mass", massKg: 0.1 },
			constituents: {
				energy: 210,
				protein: 0.026,
				carbohydrate: 0,
				saturated_fat: expect.closeTo(0.0021, 12),
				// Salt on the label becomes sodium in storage, at ×2.5.
				sodium: 0.0002,
				vitamin_b12: 1.2e-9,
				iron: 0.0000011,
			},
			portions: [
				{
					id: "serving",
					label: "120 g",
					massKg: 0.12,
					volumeL: null,
					basisUnits: null,
				},
				{
					id: "100g",
					label: "100 g",
					massKg: 0.1,
					volumeL: null,
					basisUnits: null,
				},
			],
			defaultPortionId: "serving",
			source: "Open Food Facts",
			licence: "ODbL-1.0",
		});
	});

	it("keeps null distinct from zero, falls back to kilojoules, and reads a drink's kind", () => {
		const cola = normaliseOpenFoodFactsProduct({
			code: "5000112637922",
			product_name: "Cola",
			categories_tags: ["en:beverages", "en:sodas"],
			serving_size: "1 can",
			nutriments: {
				"energy-kj_100g": 180,
				sugars_100g: 10.6,
				sodium_100g: 0,
			},
		});
		expect(cola).toMatchObject({
			kind: "drink",
			constituents: {
				energy: expect.closeTo(43.021, 3),
				sugar: 0.0106,
				sodium: 0,
			},
			// A serving with no mass cannot be related to the basis and is not
			// offered; 100 g always is.
			portions: [
				{
					id: "100g",
					label: "100 g",
					massKg: 0.1,
					volumeL: null,
					basisUnits: null,
				},
			],
			defaultPortionId: "100g",
		});
		expect(cola?.constituents).not.toHaveProperty("protein");
		// A product the provider knows nothing about nutritionally is not a result.
		expect(
			normaliseOpenFoodFactsProduct({ code: "1", product_name: "Mystery" }),
		).toBeNull();
		expect(
			normaliseOpenFoodFactsProduct({
				code: "abc",
				product_name: "Bad code",
				nutriments: { "energy-kcal_100g": 1 },
			}),
		).toBeNull();
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

		upstreamFetch.mockResolvedValueOnce(
			jsonResponse({
				status: 1,
				product: {
					code: "12345678",
					product_name: "Chicken thighs",
					brands: "Example",
					nutriments: {
						"energy-kcal_100g": 210,
						proteins_100g: 26,
						carbohydrates_100g: 0,
					},
				},
			}),
		);
		await expect(provider.findByBarcode("12345678")).resolves.toEqual(result);
		expect(String(upstreamFetch.mock.calls[1]?.[0])).toContain(
			"/api/v2/product/12345678?",
		);
		await expect(provider.findByRef("usda:1")).resolves.toBeNull();
	});
});

describe("public food routes", () => {
	const authHandler = vi.fn(async () => new Response(null, { status: 404 }));
	const search = vi.fn(async () => [result]);
	const findByRef = vi.fn(
		async (): Promise<ExternalConsumable | null> => result,
	);
	const findByBarcode = vi.fn(
		async (): Promise<ExternalConsumable | null> => result,
	);
	const observe = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	function app(
		rateLimiter?: InMemoryFoodRateLimiter,
		trustProxyHeaders = true,
	) {
		return createApp({
			auth: { handler: authHandler },
			corsOrigin: "app://",
			foodProvider: { search, findByRef, findByBarcode },
			foodRateLimiter: rateLimiter,
			observeFoodRoute: observe,
			trustProxyHeaders,
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

	it("looks a barcode up without scanning it", async () => {
		const found = await app().request("/api/food/barcode/12345678", {
			headers: { authorization: "Bearer must-not-be-used" },
		});
		expect(found.status).toBe(200);
		await expect(found.json()).resolves.toEqual(result);
		expect(findByBarcode).toHaveBeenCalledWith("12345678");
		expect(authHandler).not.toHaveBeenCalled();

		findByBarcode.mockResolvedValueOnce(null);
		expect((await app().request("/api/food/barcode/00000000")).status).toBe(
			404,
		);
		expect((await app().request("/api/food/barcode/12")).status).toBe(400);
		expect((await app().request("/api/food/barcode/abc")).status).toBe(400);
		findByBarcode.mockRejectedValueOnce(
			new FoodProviderUnavailableError("upstream"),
		);
		expect((await app().request("/api/food/barcode/12345678")).status).toBe(
			502,
		);
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

	it("ignores forwarded-for headers unless a proxy is trusted", async () => {
		const rateLimiter = new InMemoryFoodRateLimiter(1, 60_000, () => 0);
		const untrusted = app(rateLimiter, false);
		expect(
			(
				await untrusted.request("/api/food/search?q=chicken", {
					headers: { "x-forwarded-for": "192.0.2.44" },
				})
			).status,
		).toBe(200);
		// A spoofed header must not mint a fresh bucket for the same caller.
		expect(
			(
				await untrusted.request("/api/food/search?q=another", {
					headers: { "x-forwarded-for": "198.51.100.7" },
				})
			).status,
		).toBe(429);
	});

	it("unwraps IPv4-mapped peer addresses into their own /24 buckets", () => {
		const rateLimiter = new InMemoryFoodRateLimiter(1, 60_000, () => 0);
		expect(rateLimiter.consume(coarseBucketOf("::ffff:192.0.2.44"))).toEqual(
			expect.objectContaining({ allowed: true }),
		);
		expect(rateLimiter.consume(coarseBucketOf("::ffff:198.51.100.7"))).toEqual(
			expect.objectContaining({ allowed: true }),
		);
		expect(rateLimiter.consume(coarseBucketOf("192.0.2.99"))).toEqual(
			expect.objectContaining({ allowed: false }),
		);
	});

	it("evicts the oldest bucket rather than sharing one when full", () => {
		let clock = 0;
		const rateLimiter = new InMemoryFoodRateLimiter(1, 60_000, () => clock, 2);
		expect(rateLimiter.consume("v4:192.0.2").allowed).toBe(true);
		clock = 1;
		expect(rateLimiter.consume("v4:198.51.100").allowed).toBe(true);
		// The map is full. A third caller must still get its own fresh window
		// rather than inheriting somebody else's exhausted count.
		clock = 2;
		expect(rateLimiter.consume("v4:203.0.113").allowed).toBe(true);
		expect(rateLimiter.consume("v4:203.0.113").allowed).toBe(false);
	});
});
