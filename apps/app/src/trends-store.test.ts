import type * as DatabaseApp from "@bro/database-app";
import type { SQLiteDatabase } from "expo-sqlite";
import { createNodeSqliteMock } from "./test-support/node-sqlite";

const mockSqlite = createNodeSqliteMock();
let mockRandomSeed = 0;
let databaseApp: typeof DatabaseApp;
let db: SQLiteDatabase;

jest.mock("expo-sqlite", () => ({
	openDatabaseSync: mockSqlite.openDatabaseSync,
	openDatabaseAsync: mockSqlite.openDatabaseAsync,
}));
jest.mock("expo-crypto", () => ({
	getRandomBytes: jest.fn((length: number) => {
		const bytes = new Uint8Array(length);
		mockRandomSeed += 1;
		bytes[length - 1] = mockRandomSeed;
		return bytes;
	}),
}));

const { TrendsStore } = jest.requireActual(
	"./trends/trends-store",
) as typeof import("./trends/trends-store");

describe("trends store", () => {
	beforeEach(async () => {
		mockSqlite.reset();
		mockRandomSeed = 0;
		databaseApp = jest.requireActual("@bro/database-app");
		db = await databaseApp.initDb("trends-store.db");
		await databaseApp.runMigrations(db);
	});

	afterEach(async () => {
		await databaseApp.closeDb();
	});

	afterAll(() => {
		mockSqlite.cleanup();
	});

	it("adds only tracked measurements and formats their last daily value", async () => {
		const now = new Date("2026-08-14T22:00:00.000Z");
		const tracked = new databaseApp.TrackedMetricsRepository(db);
		const preferences = new databaseApp.UnitPreferenceRepository(db);
		const observations = new databaseApp.ObservationRepository(db);
		const store = new TrendsStore(
			db,
			() => now,
			() => "en-GB",
		);

		expect(
			(await store.load(7)).metrics.map(({ metric }) => metric.slug),
		).toEqual(["mood", "energy", "motivation", "productivity", "libido"]);
		await tracked.configure("weight", 0, true);
		await tracked.relabel("weight", "Morning weight", {
			position: 0,
			enabled: true,
		});
		await preferences.set("mass", "st");
		for (const [id, value, observedAt] of [
			["first", 78, Date.parse("2026-08-14T08:00:00.000Z")],
			["last", 77.56429527, Date.parse("2026-08-14T20:00:00.000Z")],
		] as const) {
			await observations.create({
				metricSlug: "weight",
				value,
				scaleMin: null,
				scaleMax: null,
				observedAt,
				localDay: "2026-08-14",
				tzOffsetMinutes: 0,
				source: "user",
				sourceRecordId: id,
				assessmentId: null,
			});
		}

		const weight = (await store.load(7)).metrics.find(
			({ metric }) => metric.slug === "weight",
		);
		expect(weight).toMatchObject({
			label: "Morning weight",
			displayUnit: "st",
			latestFormatted: "12 st 3 lb",
		});
		expect(weight?.series.points.at(-1)?.value).toBe(77.56429527);
	});

	it("includes every default score and removes one after opt-out", async () => {
		const tracked = new databaseApp.TrackedMetricsRepository(db);
		const store = new TrendsStore(db);

		expect(
			(await store.load(7)).metrics.map(({ metric }) => metric.slug),
		).toEqual(["mood", "energy", "motivation", "productivity", "libido"]);
		await tracked.configure("energy", 1, false);
		expect(
			(await store.load(7)).metrics.map(({ metric }) => metric.slug),
		).toEqual(["mood", "motivation", "productivity", "libido"]);
	});

	it("keeps the no-connection trends snapshot unchanged", async () => {
		await new databaseApp.TrackedMetricsRepository(db).configure(
			"sleep_duration",
			3,
			true,
		);
		const store = new TrendsStore(db);

		expect(
			(await store.load(7)).metrics.map(({ metric }) => metric.slug),
		).toEqual(["mood", "energy", "motivation", "productivity", "libido"]);
	});

	it("adds imported metrics while manual values take precedence", async () => {
		const now = new Date("2026-08-14T22:00:00.000Z");
		const daily = new databaseApp.DailyMetricRepository(db);
		const observations = new databaseApp.ObservationRepository(db);
		const preferences = new databaseApp.UnitPreferenceRepository(db);
		await preferences.set("mass", "kg");
		await observations.create({
			metricSlug: "weight",
			value: 80,
			scaleMin: null,
			scaleMax: null,
			observedAt: Date.parse("2026-08-14T08:00:00.000Z"),
			localDay: "2026-08-14",
			tzOffsetMinutes: 0,
			source: "user",
			sourceRecordId: null,
			assessmentId: null,
		});
		await daily.upsert({
			metricSlug: "weight",
			localDay: "2026-08-14",
			value: 79,
			source: "health_connect",
		});
		await daily.upsert({
			metricSlug: "sleep_duration",
			localDay: "2026-08-14",
			value: 25_200,
			source: "health_connect",
		});
		await daily.upsert({
			metricSlug: "resting_heart_rate",
			localDay: "2026-08-14",
			value: 61.5,
			source: "health_connect",
		});

		const snapshot = await new TrendsStore(
			db,
			() => now,
			() => "en-GB",
		).load(7);
		expect(snapshot.metrics.map(({ metric }) => metric.slug)).toEqual([
			"mood",
			"energy",
			"motivation",
			"productivity",
			"libido",
			"weight",
			"sleep_duration",
			"resting_heart_rate",
		]);
		expect(
			snapshot.metrics.find(({ metric }) => metric.slug === "weight"),
		).toMatchObject({ latestFormatted: "80.0 kg" });
		expect(
			snapshot.metrics
				.find(({ metric }) => metric.slug === "weight")
				?.series.points.at(-1)?.value,
		).toBe(80);
		expect(
			snapshot.metrics.find(({ metric }) => metric.slug === "sleep_duration"),
		).toMatchObject({ latestFormatted: "7 h 0 m" });
		expect(
			snapshot.metrics.find(
				({ metric }) => metric.slug === "resting_heart_rate",
			),
		).toMatchObject({ latestFormatted: "61.5 bpm" });
	});

	it("adds opted-in intake totals without writing observations", async () => {
		const now = new Date("2026-08-19T22:00:00.000Z");
		await new databaseApp.TrackedMetricsRepository(db).configure(
			"ethanol_intake",
			111,
			true,
		);
		await new databaseApp.UnitPreferenceRepository(db).set(
			"alcohol",
			"uk_unit",
		);
		const events = new databaseApp.IntakeEventRepository(db);
		for (const [id, localDay, ethanol] of [
			["first", "2026-08-18", 0.01],
			["second", "2026-08-19", 0.02],
			["third", "2026-08-19", 0.005],
		] as const) {
			await events.create({
				kind: "drink",
				consumableId: null,
				sourceRef: `system:drink:${id}`,
				name: id,
				brand: null,
				portionLabel: "serving",
				quantity: 1,
				massKg: null,
				volumeL: 0.25,
				constituents: { fluid: 0.25, ethanol, caffeine: 0, energy: 100 },
				context: null,
				notes: null,
				occurredAt: Date.parse(`${localDay}T20:00:00.000Z`),
				localDay,
				tzOffsetMinutes: 0,
			});
		}

		const alcohol = (
			await new TrendsStore(
				db,
				() => now,
				() => "en-GB",
			).load(7)
		).metrics.find(({ metric }) => metric.slug === "ethanol_intake");
		expect(alcohol).toMatchObject({ latestFormatted: "3.2 units" });
		expect(
			alcohol?.series.points
				.filter((point) => point.value !== null)
				.map((point) => point.value),
		).toEqual([0.01, 0.025]);
		expect(await new databaseApp.ObservationRepository(db).listAll()).toEqual(
			[],
		);
	});
});
