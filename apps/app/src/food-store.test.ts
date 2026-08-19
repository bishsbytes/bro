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

const { FoodStore } = jest.requireActual(
	"./food/food-store",
) as typeof import("./food/food-store");

describe("food store", () => {
	const now = new Date(2026, 7, 19, 12, 0, 0, 0);

	beforeEach(async () => {
		mockSqlite.reset();
		databaseApp = jest.requireActual("@bro/database-app");
		db = await databaseApp.initDb("food-store.db");
		await databaseApp.runMigrations(db);
	});

	afterEach(async () => {
		await databaseApp.closeDb();
	});

	afterAll(() => {
		mockSqlite.cleanup();
	});

	it("logs food offline and combines its energy with drink energy", async () => {
		const store = new FoodStore(
			db,
			() => now,
			() => "en-GB",
		);
		await new databaseApp.ConsumptionEntryRepository(db).create({
			kind: "drink",
			catalogueRef: "drink:coffee",
			label: "Coffee",
			servingLabel: "mug",
			quantity: 1,
			volumeL: 0.25,
			ethanolKg: 0,
			caffeineKg: 0.000_095,
			energyKcal: 2,
			occurredAt: Date.parse("2026-08-19T08:00:00.000Z"),
			localDay: "2026-08-19",
			tzOffsetMinutes: 0,
		});
		const chicken = await store.logFree({
			label: "Chicken thighs",
			servingLabel: "portion",
			quantity: 2,
			energyKcal: 210,
			proteinG: 26,
			carbsG: 0,
			fatG: null,
			localDay: "2026-08-19",
			time: "12:00",
		});
		expect(chicken).toMatchObject({
			kind: "food",
			energyKcal: 420,
			proteinG: 52,
			carbsG: 0,
			fatG: null,
		});

		let snapshot = await store.loadToday();
		expect(snapshot.entries.map(({ entry }) => entry.label)).toEqual([
			"Chicken thighs",
		]);
		expect(
			snapshot.metrics.find(({ metric }) => metric.slug === "energy_intake")
				?.dayFormatted,
		).toBe("422 kcal");
		expect(
			snapshot.metrics.find(({ metric }) => metric.slug === "protein_intake")
				?.dayFormatted,
		).toBe("52.0 g");
		expect(
			snapshot.metrics.find(({ metric }) => metric.slug === "carbs_intake")
				?.dayFormatted,
		).toBe("0.0 g");
		expect(
			snapshot.metrics.find(({ metric }) => metric.slug === "fat_intake")
				?.dayValue,
		).toBeNull();

		await store.updateEntry(chicken.id, {
			label: chicken.label,
			servingLabel: chicken.servingLabel,
			quantity: 1,
			localDay: "2026-08-19",
			time: "12:00",
		});
		snapshot = await store.loadToday();
		expect(
			snapshot.metrics.find(({ metric }) => metric.slug === "protein_intake")
				?.dayFormatted,
		).toBe("26.0 g");
		await store.deleteEntry(chicken.id);
		expect((await store.loadToday()).entries).toEqual([]);
		expect(await new databaseApp.ObservationRepository(db).listAll()).toEqual(
			[],
		);
	});

	it("logs a recipe as one immutable snapshot", async () => {
		const store = new FoodStore(
			db,
			() => now,
			() => "en-GB",
		);
		const recipe = await store.saveCustom({
			label: "Chicken bowl",
			brand: null,
			isRecipe: true,
			servings: [
				{
					id: "bowl",
					label: "1 bowl",
					volumeL: null,
					ethanolKg: null,
					caffeineKg: null,
					energyKcal: 600,
					proteinG: 52,
					carbsG: 48,
					fatG: 20,
				},
			],
			components: [
				{
					position: 0,
					label: "Chicken and rice",
					quantity: 1,
					energyKcal: 600,
					proteinG: 52,
					carbsG: 48,
					fatG: 20,
				},
			],
		});
		const logged = await store.logCustom(recipe.id, "bowl", 1, {
			localDay: "2026-08-19",
			time: "18:00",
		});
		expect(logged).toMatchObject({
			consumableRef: `custom:${recipe.id}`,
			energyKcal: 600,
			proteinG: 52,
		});
		expect(
			await new databaseApp.ConsumptionEntryRepository(db).listAll(),
		).toHaveLength(1);
		const originalServing = recipe.servings[0];
		if (!originalServing) throw new Error("Expected a recipe serving.");

		await store.saveCustom({
			id: recipe.id,
			label: "Larger chicken bowl",
			brand: null,
			isRecipe: true,
			servings: [
				{
					...originalServing,
					energyKcal: 800,
					proteinG: 70,
				},
			],
			components: [
				{
					position: 0,
					label: "More chicken and rice",
					quantity: 1,
					energyKcal: 800,
					proteinG: 70,
					carbsG: 48,
					fatG: 20,
				},
			],
		});
		expect(
			await new databaseApp.ConsumptionEntryRepository(db).findById(logged.id),
		).toMatchObject({ label: "Chicken bowl", energyKcal: 600, proteinG: 52 });
		await store.deleteCustom(recipe.id);
		expect(
			await new databaseApp.ConsumptionEntryRepository(db).findById(logged.id),
		).toMatchObject({ label: "Chicken bowl", energyKcal: 600 });
	});

	it("snapshots a provider result and preserves unknown nutrients", async () => {
		const store = new FoodStore(
			db,
			() => now,
			() => "en-GB",
		);
		const logged = await store.logSearchResult(
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
			"100g",
			2,
			{ localDay: "2026-08-19", time: "12:00" },
		);

		expect(logged).toMatchObject({
			consumableRef: "off:12345678",
			label: "Example · Chicken thighs",
			servingLabel: "100 g",
			quantity: 2,
			energyKcal: 420,
			proteinG: 52,
			carbsG: 0,
			fatG: null,
		});
	});

	it("keeps nutrition metrics default-off and creates goals in both directions", async () => {
		const store = new FoodStore(
			db,
			() => now,
			() => "en-GB",
		);
		expect(
			(await store.loadSettings()).metrics.every(({ tracked }) => !tracked),
		).toBe(true);
		await store.setTracked("energy_intake", true);
		await store.setTracked("protein_intake", true);
		await store.logFree({
			label: "Meal",
			servingLabel: "plate",
			quantity: 1,
			energyKcal: 600,
			proteinG: 50,
			carbsG: 60,
			fatG: 20,
			localDay: "2026-08-19",
			time: "12:00",
		});
		await expect(
			store.createGoal("energy_intake", "500", null),
		).resolves.toMatchObject({
			direction: "decrease",
			targetValue: 500,
		});
		await expect(
			store.createGoal("protein_intake", "60", null),
		).resolves.toMatchObject({
			direction: "increase",
			targetValue: 0.06,
		});
	});
});
