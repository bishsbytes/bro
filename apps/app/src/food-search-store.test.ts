import type * as DatabaseApp from "@bro/database-app";
import type { FoodSearchResponse } from "@bro/domain/food-search";
import type { SQLiteDatabase } from "expo-sqlite";
import { createNodeSqliteMock } from "./test-support/node-sqlite";

const mockSqlite = createNodeSqliteMock();
let databaseApp: typeof DatabaseApp;
let localDb: SQLiteDatabase;

jest.mock("expo-sqlite", () => ({
	openDatabaseSync: mockSqlite.openDatabaseSync,
	openDatabaseAsync: mockSqlite.openDatabaseAsync,
}));

const { FoodSearchStore } = jest.requireActual(
	"./food/food-search-store",
) as typeof import("./food/food-search-store");

const responsePayload: FoodSearchResponse = {
	results: [
		{
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
		},
	],
};

describe("food search store", () => {
	beforeEach(async () => {
		mockSqlite.reset();
		databaseApp = jest.requireActual("@bro/database-app");
		localDb = await databaseApp.initLocalDb("food-search-local.db");
		await databaseApp.runLocalMigrations(localDb);
	});

	afterEach(async () => {
		await databaseApp.closeLocalDb();
	});

	afterAll(() => {
		mockSqlite.cleanup();
	});

	it("uses an anonymous request and caches the owned response locally", async () => {
		const searchFetch = jest.fn(
			async (_input: string | URL | Request, _init?: RequestInit) =>
				new Response(JSON.stringify(responsePayload), {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
		) as unknown as jest.MockedFunction<typeof fetch>;
		const store = new FoodSearchStore(localDb, {
			baseUrl: "https://api.example.test/",
			fetch: searchFetch,
			timeoutMs: 50,
		});

		await expect(store.search("chicken thighs")).resolves.toMatchObject({
			query: "chicken thighs",
			results: responsePayload.results,
			fromCache: false,
			offline: false,
		});
		const [url, init] = searchFetch.mock.calls[0] ?? [];
		expect(url).toBe(
			"https://api.example.test/api/food/search?q=chicken+thighs",
		);
		expect(init).toMatchObject({
			method: "GET",
			credentials: "omit",
			headers: { Accept: "application/json" },
		});
		expect(init?.headers).not.toHaveProperty("Authorization");
		expect(init?.headers).not.toHaveProperty("X-Device-Id");

		await expect(
			new databaseApp.FoodCacheRepository(localDb).findByRef("off:12345678"),
		).resolves.toMatchObject({
			query: "chicken thighs",
			payload: responsePayload.results[0],
		});
	});

	it("degrades to matching cache without losing typed input", async () => {
		await new databaseApp.FoodCacheRepository(localDb).upsert({
			ref: "off:12345678",
			payload: responsePayload.results[0],
			query: "chicken thighs",
		});
		const unavailableFetch = jest.fn(
			async (_input: string | URL | Request, _init?: RequestInit) => {
				throw new TypeError("Network request failed");
			},
		) as unknown as jest.MockedFunction<typeof fetch>;
		const store = new FoodSearchStore(localDb, {
			baseUrl: "https://api.example.test",
			fetch: unavailableFetch,
			timeoutMs: 50,
		});

		await expect(store.search("  chicken thighs  ")).resolves.toEqual({
			query: "  chicken thighs  ",
			results: responsePayload.results,
			fromCache: true,
			offline: true,
			message:
				"Search needs a connection. Your recents, custom foods, and saved results are still available.",
		});
		expect(unavailableFetch).toHaveBeenCalledTimes(1);
	});

	it("reads a cached ref without issuing a request", async () => {
		await new databaseApp.FoodCacheRepository(localDb).upsert({
			ref: "off:12345678",
			payload: responsePayload.results[0],
			query: null,
		});
		const searchFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
		const store = new FoodSearchStore(localDb, {
			baseUrl: "https://api.example.test",
			fetch: searchFetch,
		});

		await expect(store.findByRef("off:12345678")).resolves.toEqual(
			responsePayload.results[0],
		);
		expect(searchFetch).not.toHaveBeenCalled();
	});
});
