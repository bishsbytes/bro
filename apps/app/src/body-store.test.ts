import type * as DatabaseApp from "@bro/database-app";
import type { SQLiteDatabase } from "expo-sqlite";
import { createNodeSqliteMock } from "./test-support/node-sqlite";
import { KILOGRAMS_PER_POUND } from "./units";

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

	it("does not expose imported-only metrics before the resolved read side lands", async () => {
		await new databaseApp.TrackedMetricsRepository(db).configure(
			"resting_heart_rate",
			5,
			true,
		);
		const store = new BodyStore(db);

		expect(await store.loadMetric("resting_heart_rate")).toBeNull();
		expect((await store.loadOverview()).metrics).toHaveLength(3);
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
