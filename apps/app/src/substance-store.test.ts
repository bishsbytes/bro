import type * as DatabaseApp from "@bro/database-app";
import { nicotineKgFromMg } from "@bro/domain/nicotine-catalogue";
import type { SQLiteDatabase } from "expo-sqlite";
import { createNodeSqliteMock } from "./test-support/node-sqlite";

const mockSqlite = createNodeSqliteMock();
let databaseApp: typeof DatabaseApp;
let db: SQLiteDatabase;

jest.mock("expo-sqlite", () => ({
	openDatabaseSync: mockSqlite.openDatabaseSync,
	openDatabaseAsync: mockSqlite.openDatabaseAsync,
}));

const { SubstanceStore } = jest.requireActual(
	"./substances/substance-store",
) as typeof import("./substances/substance-store");
const { NICOTINE_DESCRIPTOR } = jest.requireActual(
	"./substances/nicotine",
) as typeof import("./substances/nicotine");

describe("substance store, configured for nicotine", () => {
	let now: Date;

	beforeEach(async () => {
		mockSqlite.reset();
		databaseApp = jest.requireActual("@bro/database-app");
		db = await databaseApp.initDb("substance-store.db");
		await databaseApp.runMigrations(db);
		now = new Date(2026, 8, 1, 12, 0, 0, 0);
	});

	afterEach(async () => {
		await databaseApp.closeDb();
	});

	afterAll(() => {
		mockSqlite.cleanup();
	});

	function store() {
		return new SubstanceStore(
			NICOTINE_DESCRIPTOR,
			db,
			() => now,
			() => "en-GB",
		);
	}

	it("logs catalogue snapshots and corrects every derived total", async () => {
		const subject = store();
		const cigarette = await subject.logCatalogue(
			"nicotine:cigarette",
			"one",
			3,
			{ localDay: "2026-09-01", time: "09:15" },
		);

		expect(cigarette).toMatchObject({
			kind: "nicotine",
			catalogueRef: "nicotine:cigarette",
			label: "Cigarette",
			servingLabel: "cigarette",
			quantity: 3,
			localDay: "2026-09-01",
			// A substance entry carries its own quantity and nothing else.
			volumeL: null,
			ethanolKg: null,
			caffeineKg: null,
			energyKcal: null,
		});
		expect(cigarette.nicotineKg).toBeCloseTo(nicotineKgFromMg(3.6), 12);

		const today = await subject.loadToday();
		expect(
			today.metrics.find(({ metric }) => metric.slug === "nicotine_intake")
				?.dayFormatted,
		).toBe("4 mg");
		// Logging a smoke is not a check-in and writes no observation.
		expect(await new databaseApp.ObservationRepository(db).listAll()).toEqual(
			[],
		);

		await subject.deleteEntry(cigarette.id);
		// The day goes back to having no reading at all rather than a logged
		// zero: nothing was recorded, which is not the same as recording none.
		expect(
			(await subject.loadToday()).metrics.find(
				({ metric }) => metric.slug === "nicotine_intake",
			),
		).toMatchObject({ dayValue: null, dayFormatted: null });
	});

	it("repeats a recent entry, the journey a smoker actually uses", async () => {
		const subject = store();
		const vape = await subject.logCatalogue("nicotine:vape-20", "session", 1, {
			localDay: "2026-08-31",
			time: "21:00",
		});

		now = new Date(2026, 8, 1, 18, 30, 0, 0);
		const repeated = await subject.repeatEntry(vape.id);
		expect(repeated).toMatchObject({
			label: vape.label,
			servingLabel: vape.servingLabel,
			nicotineKg: vape.nicotineKg,
			localDay: "2026-09-01",
		});
		expect(
			(await subject.loadToday()).recents.filter(
				({ entry }) => entry.label === vape.label,
			),
		).toHaveLength(1);
	});

	it("logs a free entry in milligrams and rejects a negative amount", async () => {
		const subject = store();
		const entry = await subject.logFree({
			label: "Cigarillo",
			servingLabel: null,
			quantity: 2,
			amount: nicotineKgFromMg(2),
			localDay: "2026-09-01",
			time: "12:00",
		});
		expect(entry.nicotineKg).toBeCloseTo(nicotineKgFromMg(4), 12);
		expect(entry.catalogueRef).toBeNull();

		await expect(
			subject.logFree({
				label: "Bad",
				servingLabel: null,
				quantity: 1,
				amount: -1,
				localDay: "2026-09-01",
				time: "12:00",
			}),
		).rejects.toThrow("zero or more");
		await expect(
			subject.logCatalogue("nicotine:gone", "one", 1, {
				localDay: "2026-09-01",
				time: "12:00",
			}),
		).rejects.toThrow("Choose an item");
	});

	it("is off until tracked, and never shows another stream's entries", async () => {
		const subject = store();
		expect(await subject.isTracked()).toBe(false);

		await subject.setTracked("nicotine_intake", true);
		expect(await subject.isTracked()).toBe(true);

		// A drink logged elsewhere is invisible here, and vice versa.
		await new databaseApp.ConsumptionEntryRepository(db).create({
			kind: "drink",
			catalogueRef: "drink:lager-4_5",
			consumableRef: null,
			label: "Lager, 4.5%",
			servingLabel: "pint",
			quantity: 1,
			volumeL: 0.568,
			ethanolKg: 0.0202,
			caffeineKg: null,
			energyKcal: 244,
			occurredAt: now.getTime(),
			localDay: "2026-09-01",
			tzOffsetMinutes: 0,
		});
		await subject.logCatalogue("nicotine:cigarette", "one", 1, {
			localDay: "2026-09-01",
			time: "10:00",
		});

		const today = await subject.loadToday();
		expect(today.entries.map(({ entry }) => entry.label)).toEqual([
			"Cigarette",
		]);
		expect(today.metrics.map(({ metric }) => metric.slug)).toEqual([
			"nicotine_intake",
		]);
	});
});
