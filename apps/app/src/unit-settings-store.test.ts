import type * as DatabaseApp from "@bro/database-app";
import type { SQLiteDatabase } from "expo-sqlite";
import { createNodeSqliteMock } from "./test-support/node-sqlite";

const mockSqlite = createNodeSqliteMock();
let databaseApp: typeof DatabaseApp;
let db: SQLiteDatabase;

jest.mock("expo-sqlite", () => ({
	openDatabaseSync: mockSqlite.openDatabaseSync,
	openDatabaseAsync: mockSqlite.openDatabaseAsync,
}));
jest.mock("expo-crypto", () => ({
	getRandomBytes: jest.fn((length: number) => new Uint8Array(length)),
}));

const { UnitSettingsStore } = jest.requireActual(
	"./units/unit-settings-store",
) as typeof import("./units/unit-settings-store");

describe("unit settings store", () => {
	beforeEach(async () => {
		mockSqlite.reset();
		databaseApp = jest.requireActual("@bro/database-app");
		db = await databaseApp.initDb("unit-settings-store.db");
		await databaseApp.runMigrations(db);
	});

	afterEach(async () => {
		await databaseApp.closeDb();
	});

	afterAll(() => {
		mockSqlite.cleanup();
	});

	it("uses locale defaults without persisting or marking an explicit choice", async () => {
		const repository = new databaseApp.UnitPreferenceRepository(db);
		const store = new UnitSettingsStore(repository, () => "en-GB");

		const snapshot = await store.load();

		expect(snapshot.settings).toMatchObject([
			{
				dimension: "mass",
				resolvedUnit: "st",
				explicitUnit: null,
				resolutionSource: "locale",
				preview: "12 st 4 lb",
			},
			{
				dimension: "length",
				resolvedUnit: "cm",
				explicitUnit: null,
				resolutionSource: "locale",
				preview: "84.0 cm",
			},
			{
				dimension: "fraction",
				resolvedUnit: "%",
				explicitUnit: null,
				resolutionSource: "locale",
				preview: "18.5%",
			},
		]);
		expect(await repository.list()).toEqual([]);
	});

	it("persists a valid choice and refreshes the live preview", async () => {
		const repository = new databaseApp.UnitPreferenceRepository(db);
		const store = new UnitSettingsStore(repository, () => "en-GB");

		const snapshot = await store.set("mass", "kg");

		expect(snapshot.settings[0]).toMatchObject({
			resolvedUnit: "kg",
			explicitUnit: "kg",
			resolutionSource: "explicit",
			preview: "78.0 kg",
		});
		expect(await repository.list()).toMatchObject([
			{ dimension: "mass", unit: "kg" },
		]);
	});

	it("falls back safely for a future replicated unit and rejects invalid choices", async () => {
		const repository = new databaseApp.UnitPreferenceRepository(db);
		await repository.set("mass", "future-mass-unit");
		const store = new UnitSettingsStore(repository, () => "en-GB");

		expect((await store.load()).settings[0]).toMatchObject({
			resolvedUnit: "kg",
			explicitUnit: null,
			resolutionSource: "fallback",
			preview: "78.0 kg",
		});
		await expect(store.set("mass", "cm")).rejects.toThrow(
			"does not measure mass",
		);
		expect((await repository.list())[0]?.unit).toBe("future-mass-unit");
	});
});
