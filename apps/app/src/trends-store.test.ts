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
		).toEqual(["mood", "energy"]);
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

	it("keeps the no-connection trends snapshot unchanged", async () => {
		await new databaseApp.TrackedMetricsRepository(db).configure(
			"sleep_duration",
			3,
			true,
		);
		const store = new TrendsStore(db);

		expect(
			(await store.load(7)).metrics.map(({ metric }) => metric.slug),
		).toEqual(["mood", "energy"]);
	});

	it("adds imported metrics and resolves tracker values over manual values", async () => {
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
			"weight",
			"sleep_duration",
			"resting_heart_rate",
		]);
		expect(
			snapshot.metrics.find(({ metric }) => metric.slug === "weight"),
		).toMatchObject({ latestFormatted: "79.0 kg" });
		expect(
			snapshot.metrics
				.find(({ metric }) => metric.slug === "weight")
				?.series.points.at(-1)?.value,
		).toBe(79);
		expect(
			snapshot.metrics.find(({ metric }) => metric.slug === "sleep_duration"),
		).toMatchObject({ latestFormatted: "7 h 0 m" });
		expect(
			snapshot.metrics.find(
				({ metric }) => metric.slug === "resting_heart_rate",
			),
		).toMatchObject({ latestFormatted: "61.5 bpm" });
	});
});
