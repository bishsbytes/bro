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
const { defaultWeekStart, UnitSettingsStore } = jest.requireActual(
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
				dimension: "height",
				resolvedUnit: "ft",
				explicitUnit: null,
				resolutionSource: "locale",
				preview: "5 ft 7 in",
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

	it("keeps height independent from other body measurements", async () => {
		const repository = new databaseApp.UnitPreferenceRepository(db);
		const store = new UnitSettingsStore(repository, () => "en-GB");

		await store.set("height", "cm");
		const snapshot = await store.set("length", "in");

		expect(snapshot.settings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					dimension: "height",
					resolvedUnit: "cm",
					preview: "170.0 cm",
				}),
				expect.objectContaining({
					dimension: "length",
					resolvedUnit: "in",
					preview: "33.00 in",
				}),
			]),
		);
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

	it("probes locale week metadata without persisting a default", async () => {
		const repository = new databaseApp.UnitPreferenceRepository(db);
		const store = new UnitSettingsStore(repository, () => "en-US");

		expect(await store.loadWeekStart()).toBe("sunday");
		expect(await repository.list()).toEqual([]);
		expect(defaultWeekStart(undefined)).toBe("monday");
		expect(defaultWeekStart("_")).toBe("monday");
	});

	it("persists week start as a reserved preference without affecting units", async () => {
		const repository = new databaseApp.UnitPreferenceRepository(db);
		const store = new UnitSettingsStore(repository, () => "en-GB");

		await store.setWeekStart("saturday");
		await store.set("mass", "lb");

		expect(await store.loadWeekStart()).toBe("saturday");
		expect((await store.load()).settings).toHaveLength(4);
		expect((await store.load()).settings[0]).toMatchObject({
			dimension: "mass",
			resolvedUnit: "lb",
		});
		expect(await repository.list()).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					dimension: "week_start",
					unit: "saturday",
				}),
				expect.objectContaining({ dimension: "mass", unit: "lb" }),
			]),
		);
	});

	it("uses a safe Monday fallback for an unsupported replicated week start", async () => {
		const repository = new databaseApp.UnitPreferenceRepository(db);
		await repository.set("week_start", "future-day");
		const store = new UnitSettingsStore(repository, () => "en-US");

		expect(await store.loadWeekStart()).toBe("monday");
	});
});
