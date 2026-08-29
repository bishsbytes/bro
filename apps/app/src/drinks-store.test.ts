import type * as DatabaseApp from "@bro/database-app";
import { KILOGRAMS_ETHANOL_PER_UK_UNIT } from "@bro/domain";
import { UK_PINT_L } from "@bro/domain/drink-catalogue";
import type { SQLiteDatabase } from "expo-sqlite";
import { i18n } from "./i18n";
import { createNodeSqliteMock } from "./test-support/node-sqlite";

const mockSqlite = createNodeSqliteMock();
let databaseApp: typeof DatabaseApp;
let db: SQLiteDatabase;

jest.mock("expo-sqlite", () => ({
	openDatabaseSync: mockSqlite.openDatabaseSync,
	openDatabaseAsync: mockSqlite.openDatabaseAsync,
}));

const { DrinksStore } = jest.requireActual(
	"./drinks/drinks-store",
) as typeof import("./drinks/drinks-store");

describe("drinks store", () => {
	let now: Date;

	beforeEach(async () => {
		mockSqlite.reset();
		databaseApp = jest.requireActual("@bro/database-app");
		db = await databaseApp.initDb("drinks-store.db");
		await databaseApp.runMigrations(db);
		now = new Date(2026, 7, 19, 12, 0, 0, 0);
	});

	afterEach(async () => {
		await databaseApp.closeDb();
	});

	afterAll(() => {
		mockSqlite.cleanup();
	});

	it("logs immutable catalogue snapshots, repeats them, and corrects every derived total", async () => {
		const store = new DrinksStore(
			db,
			() => now,
			() => "en-GB",
		);
		const lager = await store.logCatalogue("drink:lager-4_5", "pint-uk", 1, {
			localDay: "2026-08-18",
			time: "20:30",
		});
		await store.logCatalogue("drink:filter-coffee", "mug-250ml", 1, {
			localDay: "2026-08-19",
			time: "08:00",
		});

		expect(lager).toMatchObject({
			catalogueRef: "drink:lager-4_5",
			label: "Lager, 4.5%",
			servingLabel: "pint",
			volumeL: UK_PINT_L,
			localDay: "2026-08-18",
		});
		expect(lager.ethanolKg).toBeCloseTo(0.020_182_252_902_75, 12);
		const beforeRepeat = await store.loadToday();
		expect(beforeRepeat.recentLocalDays).toEqual(["2026-08-18"]);
		expect(beforeRepeat.metrics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					metric: expect.objectContaining({ slug: "caffeine_intake" }),
					dayFormatted: "95 mg",
				}),
				expect.objectContaining({
					metric: expect.objectContaining({ slug: "alcohol_intake" }),
					dayFormatted: "0.0 units",
					weekFormatted: "2.6 units",
				}),
			]),
		);

		now = new Date(2026, 7, 19, 21, 15, 0, 0);
		const repeated = await store.repeatEntry(lager.id);
		expect(repeated).toMatchObject({
			label: lager.label,
			servingLabel: lager.servingLabel,
			ethanolKg: lager.ethanolKg,
			localDay: "2026-08-19",
		});
		let today = await store.loadToday();
		expect(
			today.recents.filter(({ entry }) => entry.label === lager.label),
		).toHaveLength(1);
		expect(
			today.metrics.find(({ metric }) => metric.slug === "alcohol_intake")
				?.dayFormatted,
		).toBe("2.6 units");
		expect(await new databaseApp.ObservationRepository(db).listAll()).toEqual(
			[],
		);

		await store.updateEntry(repeated.id, {
			label: "Friday lager",
			servingLabel: "pint",
			quantity: 2,
			localDay: "2026-08-19",
			time: "21:15",
		});
		today = await store.loadToday();
		expect(
			today.entries.find(({ entry }) => entry.id === repeated.id)?.entry,
		).toMatchObject({
			label: "Friday lager",
			quantity: 2,
			volumeL: UK_PINT_L * 2,
		});
		expect(
			today.metrics.find(({ metric }) => metric.slug === "alcohol_intake")
				?.dayFormatted,
		).toBe("5.1 units");

		await store.deleteEntry(repeated.id);
		expect(
			(await store.loadToday()).metrics.find(
				({ metric }) => metric.slug === "alcohol_intake",
			)?.dayFormatted,
		).toBe("0.0 units");
	});

	it("logs a complete free entry and rejects ambiguous date or ABV input", async () => {
		const store = new DrinksStore(
			db,
			() => now,
			() => "en-GB",
		);
		const free = await store.logFree({
			label: "House lager",
			servingLabel: "glass",
			quantity: 2,
			volumeMl: 330,
			abvPercent: 5,
			caffeineMg: null,
			energyKcal: 140,
			localDay: "2026-08-18",
			time: "22:10",
		});
		expect(free).toMatchObject({
			catalogueRef: null,
			volumeL: 0.66,
			energyKcal: 280,
			localDay: "2026-08-18",
		});
		expect(free.ethanolKg).toBeCloseTo(0.026_044_92, 12);

		await expect(
			store.logFree({
				label: "Unknown spirit",
				servingLabel: null,
				quantity: 1,
				volumeMl: null,
				abvPercent: 40,
				caffeineMg: null,
				energyKcal: null,
				localDay: "2026-08-19",
				time: "20:00",
			}),
		).rejects.toThrow("Enter a volume");
		await expect(
			store.logCatalogue("drink:water", "glass-250ml", 1, {
				localDay: "2026-02-30",
				time: "20:00",
			}),
		).rejects.toThrow("Choose a real date");
	});

	it("localises and locale-formats the entry detail as one message", async () => {
		i18n.addResourceBundle(
			"en",
			"common",
			{
				consumption: {
					defaultServing_drink: "translated serving",
					entryDetail_drink: "At {{time}}: {{quantity}} × {{serving}}",
				},
			},
			true,
			true,
		);
		try {
			const store = new DrinksStore(
				db,
				() => now,
				() => "de-DE",
			);
			await store.logFree({
				label: "Water",
				servingLabel: null,
				quantity: 1.5,
				volumeMl: 250,
				abvPercent: null,
				caffeineMg: null,
				energyKcal: null,
				localDay: "2026-08-19",
				time: "12:00",
			});

			expect((await store.loadToday()).entries[0]?.detail).toBe(
				"At 12:00: 1,5 × translated serving",
			);
		} finally {
			i18n.addResourceBundle(
				"en",
				"common",
				{
					consumption: {
						defaultServing_drink: "serving",
						entryDetail_drink: "{{quantity}} × {{serving}} · {{time}}",
					},
				},
				true,
				true,
			);
		}
	});

	it("keeps tracking default-off and stores goals canonically across unit changes", async () => {
		const store = new DrinksStore(
			db,
			() => now,
			() => "en-GB",
		);
		expect(
			(await store.loadSettings()).metrics.every((metric) => !metric.tracked),
		).toBe(true);
		await store.setTracked("alcohol_intake", true);
		await store.setUnit("alcohol", "uk_unit");
		await store.setUnit("volume", "fl_oz_uk");
		const settings = await store.loadSettings();
		expect(
			settings.metrics.find(({ metricSlug }) => metricSlug === "alcohol_intake")
				?.tracked,
		).toBe(true);
		expect(settings.units).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					dimension: "alcohol",
					explicitUnit: "uk_unit",
					preview: "2.6 units",
				}),
				expect.objectContaining({
					dimension: "volume",
					explicitUnit: "fl_oz_uk",
					preview: "20.0 fl oz",
				}),
			]),
		);

		await store.logCatalogue("drink:lager-4_5", "pint-uk", 1, {
			localDay: "2026-08-19",
			time: "10:00",
		});
		const goal = await store.createGoal("alcohol_intake", "2 units", null);
		expect(goal).toMatchObject({
			direction: "decrease",
			targetValue: 2 * KILOGRAMS_ETHANOL_PER_UK_UNIT,
		});
		const increaseGoal = await store.createGoal(
			"caffeine_intake",
			"200 mg",
			null,
		);
		expect(increaseGoal).toMatchObject({
			direction: "increase",
			targetValue: 0.000_2,
		});
		await store.setUnit("alcohol", "us_standard_drink");
		const alcohol = (await store.loadToday()).metrics.find(
			({ metric }) => metric.slug === "alcohol_intake",
		);
		// The goal's "current" level is a 7-day daily mean with unlogged days as
		// zero, not the latest day's spike: one 1.4-drink day averages to 0.2.
		expect(alcohol?.goals[0]).toMatchObject({
			targetFormatted: "1.1 standard drinks",
			currentFormatted: "0.2 standard drinks",
			targetReached: true,
		});
		expect(
			(await new databaseApp.GoalRepository(db).findById(goal.id))?.targetValue,
		).toBe(2 * KILOGRAMS_ETHANOL_PER_UK_UNIT);
	});

	it("creates, edits, logs, and deletes a custom drink without changing its snapshot", async () => {
		const store = new DrinksStore(
			db,
			() => now,
			() => "en-GB",
		);
		const custom = await store.saveCustom({
			label: "Recovery shake",
			brand: null,
			servings: [
				{
					id: "bottle",
					label: "bottle",
					volumeL: 0.5,
					ethanolKg: 0,
					caffeineKg: 0,
					energyKcal: 240,
					proteinG: 30,
					carbsG: 20,
					fatG: 4,
				},
			],
		});
		const logged = await store.logCustom(custom.id, "bottle", 1, {
			localDay: "2026-08-19",
			time: "12:00",
		});
		const originalServing = custom.servings[0];
		if (!originalServing) throw new Error("Expected a custom drink serving.");
		await store.saveCustom({
			id: custom.id,
			label: "New recovery shake",
			brand: null,
			servings: [{ ...originalServing, energyKcal: 300 }],
		});
		expect(
			await new databaseApp.ConsumptionEntryRepository(db).findById(logged.id),
		).toMatchObject({ label: "Recovery shake", energyKcal: 240 });
		await store.deleteCustom(custom.id);
		expect(
			await new databaseApp.ConsumptionEntryRepository(db).findById(logged.id),
		).toMatchObject({ label: "Recovery shake", energyKcal: 240 });
	});
});
