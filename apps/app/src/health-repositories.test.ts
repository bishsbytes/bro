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
		const updated = await repository.upsert({ ...base, value: 450 });
		expect(updated).toEqual({ ...first, value: 450 });
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
});
