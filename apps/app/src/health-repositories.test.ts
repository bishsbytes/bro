import type * as DatabaseApp from "@bro/database-app";
import { createNodeSqliteMock } from "./test-support/node-sqlite";

const mockSqlite = createNodeSqliteMock();

jest.mock("expo-sqlite", () => ({
	openDatabaseSync: mockSqlite.openDatabaseSync,
	openDatabaseAsync: mockSqlite.openDatabaseAsync,
}));
jest.mock("expo-crypto", () => ({
	getRandomBytes: jest.fn((length: number) => new Uint8Array(length)),
}));

const databaseApp: typeof DatabaseApp = jest.requireActual("@bro/database-app");

describe("health import repositories", () => {
	beforeAll(async () => {
		const db = await databaseApp.initDb("health-product.db");
		const localDb = await databaseApp.initLocalDb("health-local.db");
		await Promise.all([
			databaseApp.runMigrations(db),
			databaseApp.runLocalMigrations(localDb),
		]);
	});

	afterAll(async () => {
		await Promise.all([databaseApp.closeDb(), databaseApp.closeLocalDb()]);
		mockSqlite.cleanup();
	});

	it("upserts one deterministic daily row per natural key", async () => {
		let now = 100;
		const repository = new databaseApp.DailyMetricRepository(
			databaseApp.getDb(),
			{ now: () => now },
		);
		const first = await repository.upsert({
			metricSlug: "weight",
			localDay: "2026-08-16",
			value: 81.2,
			source: "health_connect",
		});
		now = 200;
		const updated = await repository.upsert({
			metricSlug: "weight",
			localDay: "2026-08-16",
			value: 80.9,
			source: "health_connect",
		});

		expect(updated).toEqual({
			...first,
			value: 80.9,
			computedAt: 200,
			updatedAt: 200,
		});
		expect(await repository.listByMetric("weight")).toEqual([updated]);
	});

	it("persists per-metric connection tokens and clears them on disconnect", async () => {
		const repository = new databaseApp.HealthConnectionRepository(
			databaseApp.getLocalDb(),
			{ now: () => 1_000, createId: () => "connection-1" },
		);
		const connection = await repository.connect("healthkit", "weight");
		expect(await repository.connect("healthkit", "weight")).toEqual(connection);
		expect(
			await repository.markImported("healthkit", "weight", "anchor-2", 2_000),
		).toEqual({
			...connection,
			changeToken: "anchor-2",
			lastImportedAt: 2_000,
			updatedAt: 2_000,
		});
		expect(await repository.disconnect("healthkit", "weight")).toBe(1);
		expect(await repository.list()).toEqual([]);
	});

	it("deduplicates, deletes, and prunes raw samples by platform identity", async () => {
		let id = 0;
		const repository = new databaseApp.RawSampleRepository(
			databaseApp.getLocalDb(),
			{ now: () => 3_000, createId: () => `sample-${++id}` },
		);
		const base = {
			metricSlug: "steps",
			value: 400,
			startedAt: 1_000,
			endedAt: 2_000,
			localDay: "2026-08-16",
			source: "health_connect",
			sourceRecordId: "record-1",
		};
		const first = await repository.upsert(base);
		expect(first.origin).toBeNull();
		const updated = await repository.upsert({
			...base,
			value: 450,
			origin: "com.watch",
		});
		expect(updated).toEqual({ ...first, value: 450, origin: "com.watch" });
		expect(await repository.listByMetricDay("steps", "2026-08-16")).toEqual([
			updated,
		]);
		expect(
			await repository.deleteBySourceRecord("health_connect", "record-1"),
		).toEqual(updated);

		await repository.upsert({
			...base,
			sourceRecordId: "old",
			endedAt: 1_999,
		});
		await repository.upsert({
			...base,
			sourceRecordId: "boundary",
			endedAt: 2_000,
		});
		expect(await repository.pruneEndedBefore(2_000)).toBe(1);
		expect(
			await repository.listByMetricDay("steps", "2026-08-16"),
		).toHaveLength(1);
	});

	it("caches normalised food payloads only in the disposable local store", async () => {
		let now = 4_000;
		const repository = new databaseApp.FoodCacheRepository(
			databaseApp.getLocalDb(),
			{ now: () => now },
		);
		const first = await repository.upsert({
			ref: "off:123456",
			query: " chicken thighs ",
			payload: {
				ref: "off:123456",
				label: "Chicken thighs",
				servings: [{ id: "100g", fatG: null }],
			},
		});
		expect(first).toMatchObject({
			ref: "off:123456",
			query: "chicken thighs",
			fetchedAt: 4_000,
		});
		await expect(
			repository.listByQuery<typeof first.payload>("CHICKEN THIGHS"),
		).resolves.toEqual([first]);

		now = 5_000;
		const refreshed = await repository.upsert({
			ref: first.ref,
			query: "chicken",
			payload: { ...first.payload, label: "Chicken thigh" },
		});
		await expect(
			repository.findByRef<typeof refreshed.payload>(first.ref),
		).resolves.toEqual(refreshed);
		await expect(repository.pruneFetchedBefore(5_001)).resolves.toBe(1);
		await expect(repository.listRecent()).resolves.toEqual([]);
	});

	it("deletes food entries, custom consumables, components, and cache rows", async () => {
		const productDb = databaseApp.getDb();
		const localDb = databaseApp.getLocalDb();
		await productDb.execAsync(`
			INSERT INTO custom_consumables (
				id, kind, label, is_recipe, servings, created_at, updated_at
			) VALUES (
				'custom-delete', 'food', 'Recipe', 1, '[]', 1, 1
			);
			INSERT INTO custom_consumable_components (
				id, consumable_id, position, label, quantity, energy_kcal,
				created_at, updated_at
			) VALUES (
				'component-delete', 'custom-delete', 0, 'Part', 1, 1, 1, 1
			);
			INSERT INTO consumption_entries (
				id, kind, label, quantity, energy_kcal, occurred_at, local_day,
				tz_offset_minutes, created_at, updated_at
			) VALUES (
				'entry-delete', 'food', 'Meal', 1, 1, 1, '2026-08-19', 0, 1, 1
			);
		`);
		await localDb.runAsync(
			`INSERT INTO food_cache (ref, payload, query, fetched_at)
			 VALUES (?, ?, ?, ?)`,
			["off:delete", "{}", "delete", 1],
		);

		await databaseApp.deleteLocalProductData(productDb, localDb);

		for (const table of [
			"consumption_entries",
			"custom_consumables",
			"custom_consumable_components",
		]) {
			expect(
				await productDb.getFirstAsync<{ count: number }>(
					`SELECT COUNT(*) AS count FROM "${table}"`,
				),
			).toEqual({ count: 0 });
		}
		expect(
			await localDb.getFirstAsync<{ count: number }>(
				"SELECT COUNT(*) AS count FROM food_cache",
			),
		).toEqual({ count: 0 });
	});
});
