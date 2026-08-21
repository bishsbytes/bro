import type * as DatabaseApp from "@bro/database-app";
import { KILOGRAMS_PER_POUND } from "@bro/domain";
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

const { BodyStore } = jest.requireActual(
	"./body/body-store",
) as typeof import("./body/body-store");

describe("body store", () => {
	beforeEach(async () => {
		mockSqlite.reset();
		mockRandomSeed = 0;
		databaseApp = jest.requireActual("@bro/database-app");
		db = await databaseApp.initDb("body-store.db");
		await databaseApp.runMigrations(db);
	});

	afterEach(async () => {
		await databaseApp.closeDb();
	});

	afterAll(() => {
		mockSqlite.cleanup();
	});

	it("ships body tracking default-off and persists toggles through the overlay", async () => {
		const store = new BodyStore(
			db,
			() => new Date("2026-08-14T12:00:00.000Z"),
			() => "en-GB",
		);

		const fresh = await store.loadOverview();
		expect(fresh.metrics.map(({ metricSlug }) => metricSlug)).toEqual([
			"weight",
			"waist",
			"body_fat",
		]);
		expect(fresh.metrics).toMatchObject([
			{ metricSlug: "weight", tracked: false, displayUnit: "st" },
			{ metricSlug: "waist", tracked: false, displayUnit: "cm" },
			{ metricSlug: "body_fat", tracked: false, displayUnit: "%" },
		]);

		const enabled = await store.setTracked("weight", true);
		expect(enabled.metrics[0]).toMatchObject({
			metricSlug: "weight",
			tracked: true,
		});
		const overlays = await new databaseApp.TrackedMetricsRepository(
			db,
		).listResolved([{ metricSlug: "weight", position: 0, enabled: false }]);
		expect(overlays[0]?.enabled).toBe(true);
	});

	it("keeps imported-only metrics hidden when there is no imported data", async () => {
		await new databaseApp.TrackedMetricsRepository(db).configure(
			"resting_heart_rate",
			5,
			true,
		);
		const store = new BodyStore(db);

		expect(await store.loadMetric("resting_heart_rate")).toBeNull();
		expect((await store.loadOverview()).metrics).toHaveLength(3);
	});

	it("merges imported body values, exposes resting heart rate read-only, and resolves goals", async () => {
		let now = new Date("2026-08-16T12:00:00.000Z");
		const observations = new databaseApp.ObservationRepository(db);
		const daily = new databaseApp.DailyMetricRepository(db);
		const preferences = new databaseApp.UnitPreferenceRepository(db);
		await preferences.set("mass", "kg");
		const manual = await observations.create({
			metricSlug: "weight",
			value: 80,
			scaleMin: null,
			scaleMax: null,
			observedAt: Date.parse("2026-08-15T08:00:00.000Z"),
			localDay: "2026-08-15",
			tzOffsetMinutes: 0,
			source: "user",
			sourceRecordId: null,
			assessmentId: null,
		});
		await daily.upsert({
			metricSlug: "weight",
			localDay: "2026-08-15",
			value: 79,
			source: "health_connect",
		});
		await daily.upsert({
			metricSlug: "resting_heart_rate",
			localDay: "2026-08-15",
			value: 62,
			source: "health_connect",
		});
		const store = new BodyStore(
			db,
			() => now,
			() => "en-GB",
		);

		const overview = await store.loadOverview();
		expect(overview.metrics.map(({ metricSlug }) => metricSlug)).toEqual([
			"weight",
			"waist",
			"body_fat",
			"resting_heart_rate",
		]);
		expect(overview.metrics[0]).toMatchObject({
			metricSlug: "weight",
			tracked: false,
			visible: true,
			hasImportedData: true,
			latestFormatted: "79.0 kg",
			latest: { source: "health_connect", value: 79 },
		});
		expect(overview.metrics.at(-1)).toMatchObject({
			metricSlug: "resting_heart_rate",
			userEnterable: false,
			visible: true,
			latestFormatted: "62 bpm",
		});

		const weight = await store.loadMetric("weight");
		expect(weight?.history).toHaveLength(2);
		expect(weight?.history).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					selected: true,
					editable: false,
					observation: expect.objectContaining({ source: "health_connect" }),
				}),
				expect.objectContaining({
					selected: false,
					editable: true,
					observation: expect.objectContaining({
						id: manual.id,
						source: "user",
					}),
				}),
			]),
		);
		expect(
			(await store.loadMetric("resting_heart_rate"))?.editablePresentation,
		).toBeNull();

		const goal = await store.createGoal("weight", 70, null);
		expect(goal).toMatchObject({ direction: "decrease" });
		now = new Date("2026-08-17T18:00:00.000Z");
		await daily.upsert({
			metricSlug: "weight",
			localDay: "2026-08-17",
			value: 77,
			source: "health_connect",
		});
		expect((await store.loadMetric("weight"))?.goals[0]).toMatchObject({
			startValue: 79,
			currentValue: 77,
			progressPercent: 22,
		});
	});

	it("derives decreasing goal progress from canonical history across unit changes", async () => {
		let now = new Date("2026-08-14T12:00:00.000Z");
		const observations = new databaseApp.ObservationRepository(db);
		const preferences = new databaseApp.UnitPreferenceRepository(db);
		const store = new BodyStore(
			db,
			() => now,
			() => "en-GB",
		);
		await store.setTracked("weight", true);
		await preferences.set("mass", "st");
		const first = await observations.create({
			metricSlug: "weight",
			value: 80,
			scaleMin: null,
			scaleMax: null,
			observedAt: now.getTime(),
			localDay: "2026-08-14",
			tzOffsetMinutes: 0,
			source: "user",
			sourceRecordId: null,
			assessmentId: null,
		});

		now = new Date("2026-08-14T12:05:00.000Z");
		const targetValue = 11 * 14 * KILOGRAMS_PER_POUND;
		const goal = await store.createGoal("weight", targetValue, "2026-12-25");
		expect(goal).toMatchObject({
			metricSlug: "weight",
			direction: "decrease",
			targetValue,
			targetDate: "2026-12-25",
		});

		now = new Date("2026-09-14T12:00:00.000Z");
		const second = await observations.create({
			metricSlug: "weight",
			value: 77,
			scaleMin: null,
			scaleMax: null,
			observedAt: now.getTime(),
			localDay: "2026-09-14",
			tzOffsetMinutes: 0,
			source: "user",
			sourceRecordId: null,
			assessmentId: null,
		});
		const stones = await store.loadMetric("weight");
		expect(stones?.history).toHaveLength(2);
		expect(stones?.goals[0]).toMatchObject({
			status: "active",
			startValue: 80,
			currentValue: 77,
			targetFormatted: "11 st 0 lb",
		});
		expect(stones?.goals[0]?.progressPercent).toBeGreaterThan(0);

		await preferences.set("mass", "kg");
		const kilograms = await store.loadMetric("weight");
		expect(kilograms?.goals[0]).toMatchObject({
			targetFormatted: "69.9 kg",
			startValue: 80,
			currentValue: 77,
			progressPercent: stones?.goals[0]?.progressPercent,
		});
		expect(
			(await new databaseApp.GoalRepository(db).findById(goal.id))?.targetValue,
		).toBe(targetValue);

		const updated = await store.updateMeasurement(second.id, 76);
		expect(updated?.latest?.value).toBe(76);
		expect((await observations.findById(first.id))?.value).toBe(80);
		const afterDelete = await store.deleteMeasurement(second.id);
		expect(afterDelete?.history).toHaveLength(1);
		expect(afterDelete?.latest?.id).toBe(first.id);

		await store.abandonGoal(goal.id);
		expect((await store.loadMetric("weight"))?.goals[0]?.status).toBe(
			"abandoned",
		);
	});

	it("records a typed measurement against the day it was entered", async () => {
		const now = new Date("2026-08-14T12:00:00.000Z");
		const store = new BodyStore(
			db,
			() => now,
			() => "en-GB",
		);
		await store.setTracked("weight", true);

		const overview = await store.recordMeasurement("weight", 78.5);

		expect(overview.inputLocale).toBe("en-GB");
		expect(overview.metrics[0]).toMatchObject({
			metricSlug: "weight",
			tracked: true,
			latestFormatted: "12 st 5 lb",
		});
		const rows = await new databaseApp.ObservationRepository(db).listByDay(
			"2026-08-14",
		);
		expect(rows).toMatchObject([
			{
				metricSlug: "weight",
				value: 78.5,
				scaleMin: null,
				scaleMax: null,
				observedAt: now.getTime(),
				localDay: "2026-08-14",
				tzOffsetMinutes: now.getTimezoneOffset(),
				source: "user",
			},
		]);
	});

	it("refuses to record an untracked, unknown, or out-of-range measurement", async () => {
		const store = new BodyStore(
			db,
			() => new Date("2026-08-14T12:00:00.000Z"),
			() => "en-GB",
		);

		await expect(store.recordMeasurement("weight", 78)).rejects.toThrow(
			"Measurement is not tracked",
		);
		await expect(store.recordMeasurement("mood", 4)).rejects.toThrow(
			"Unknown measurement slug",
		);
		// Imported-only metrics have no entry field, whatever an overlay claims.
		await new databaseApp.TrackedMetricsRepository(db).configure(
			"steps",
			99,
			true,
		);
		await expect(store.recordMeasurement("steps", 10_000)).rejects.toThrow(
			"Unknown measurement slug: steps",
		);

		await store.setTracked("weight", true);
		await expect(store.recordMeasurement("weight", -1)).rejects.toThrow(
			"finite and non-negative",
		);
		await store.setTracked("body_fat", true);
		await expect(store.recordMeasurement("body_fat", 1.4)).rejects.toThrow(
			"between zero and one",
		);
		expect(await new databaseApp.ObservationRepository(db).listAll()).toEqual(
			[],
		);
	});

	it("refuses non-measurement history and goals", async () => {
		const observations = new databaseApp.ObservationRepository(db);
		const mood = await observations.create({
			metricSlug: "mood",
			value: 4,
			scaleMin: 1,
			scaleMax: 5,
			observedAt: Date.parse("2026-08-14T12:00:00.000Z"),
			localDay: "2026-08-14",
			tzOffsetMinutes: 0,
			source: "user",
			sourceRecordId: null,
			assessmentId: null,
		});
		const store = new BodyStore(db);

		expect(await store.loadMetric("mood")).toBeNull();
		await expect(store.updateMeasurement(mood.id, 3)).rejects.toThrow(
			"Unknown measurement slug",
		);
		await expect(store.createGoal("mood", 3, null)).rejects.toThrow(
			"Unknown measurement slug",
		);
	});
});
