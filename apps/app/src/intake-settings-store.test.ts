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

const { IntakeSettingsStore } = jest.requireActual(
	"./intake/intake-settings-store",
) as typeof import("./intake/intake-settings-store");

describe("intake settings store", () => {
	beforeEach(async () => {
		mockSqlite.reset();
		databaseApp = jest.requireActual("@bro/database-app");
		db = await databaseApp.initDb("intake-settings.db");
		await databaseApp.runMigrations(db);
	});

	afterEach(async () => {
		await databaseApp.closeDb();
	});

	afterAll(() => mockSqlite.cleanup());

	it("starts with food and drink only, nothing tracked, and locale units", async () => {
		const store = new IntakeSettingsStore(db, () => "en-GB");
		const settings = await store.loadSettings();

		expect(await store.enabledKinds()).toEqual(["food", "drink"]);
		expect(
			settings.streams.map(({ kind, enabled }) => [kind, enabled]),
		).toEqual([
			["supplement", false],
			["medication", false],
			["nicotine", false],
			["other", false],
		]);
		expect(settings.streams.map(({ label }) => label)).toEqual([
			"Supplements",
			"Medication",
			"Smoking & vaping",
			"Other",
		]);
		expect(settings.groups.map(({ category }) => category)).toEqual([
			"energy",
			"macronutrient",
			"micronutrient",
			"hydration",
			"stimulant",
			"alcohol",
			"supplement",
		]);
		expect(
			settings.groups.flatMap(({ rows }) => rows).every((row) => !row.tracked),
		).toBe(true);
		expect(
			settings.groups
				.flatMap(({ rows }) => rows)
				.filter((row) => row.primary)
				.map((row) => row.code),
		).toEqual([
			"energy",
			"protein",
			"carbohydrate",
			"fat",
			"fluid",
			"caffeine",
			"nicotine",
			"ethanol",
			"creatine",
		]);
		expect(
			settings.units.map(({ dimension, resolvedUnit, preview }) => [
				dimension,
				resolvedUnit,
				preview,
			]),
		).toEqual([
			["alcohol", "uk_unit", "2.6 units"],
			["volume", "ml", "568 ml"],
			["sodium", "salt_g", "1.5 g salt"],
		]);
	});

	it("switches streams and totals on and off and changes units", async () => {
		const store = new IntakeSettingsStore(db, () => "en-US");

		let settings = await store.setStreamEnabled("nicotine", true);
		expect(
			settings.streams.find(({ kind }) => kind === "nicotine")?.enabled,
		).toBe(true);
		expect(await store.enabledKinds()).toEqual(["food", "drink", "nicotine"]);
		expect(await store.isStreamEnabled("nicotine")).toBe(true);
		expect(await store.isStreamEnabled("supplement")).toBe(false);
		await expect(store.setStreamEnabled("food", false)).rejects.toThrow(
			"Only optional intake streams",
		);

		settings = await store.setTracked("energy_intake", true);
		expect(
			settings.groups
				.flatMap(({ rows }) => rows)
				.filter((row) => row.tracked)
				.map((row) => row.metricSlug),
		).toEqual(["energy_intake"]);
		await expect(store.setTracked("thc_intake", true)).rejects.toThrow(
			"Unknown total: thc_intake",
		);

		settings = await store.setUnit("alcohol", "g");
		expect(
			settings.units.find(({ dimension }) => dimension === "alcohol"),
		).toMatchObject({
			resolvedUnit: "g",
			explicitUnit: "g",
			preview: "20.2 g",
		});
		expect(
			settings.units.find(({ dimension }) => dimension === "sodium"),
		).toMatchObject({ resolvedUnit: "mg", preview: "600 mg" });
		await expect(store.setUnit("sodium", "kg")).rejects.toThrow(
			"does not measure sodium",
		);
	});
});
