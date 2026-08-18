import type * as DatabaseApp from "@bro/database-app";
import type { SQLiteDatabase } from "expo-sqlite";
import { createNodeSqliteMock } from "../test-support/node-sqlite";

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

const { readDailySignal } = jest.requireActual(
	"./daily-signal",
) as typeof import("./daily-signal");

describe("daily insight signal", () => {
	beforeEach(async () => {
		mockSqlite.reset();
		mockRandomSeed = 0;
		databaseApp = jest.requireActual("@bro/database-app");
		db = await databaseApp.initDb("insight-signal.db");
		await databaseApp.runMigrations(db);
	});

	afterEach(async () => {
		await databaseApp.closeDb();
	});

	afterAll(() => mockSqlite.cleanup());

	it("means scored rows, excludes old bounds, derives absence, and resolves imports", async () => {
		const observations = new databaseApp.ObservationRepository(db);
		const daily = new databaseApp.DailyMetricRepository(db);
		const base = {
			observedAt: Date.parse("2026-08-14T09:00:00.000Z"),
			localDay: "2026-08-14",
			tzOffsetMinutes: -60,
			source: "user",
			sourceRecordId: null,
			assessmentId: null,
		};
		await observations.create({
			...base,
			metricSlug: "mood",
			value: 2,
			scaleMin: 1,
			scaleMax: 5,
		});
		await observations.create({
			...base,
			observedAt: base.observedAt + 1,
			metricSlug: "mood",
			value: 4,
			scaleMin: 1,
			scaleMax: 5,
		});
		await observations.create({
			...base,
			observedAt: base.observedAt + 2,
			metricSlug: "mood",
			value: 10,
			scaleMin: 0,
			scaleMax: 10,
		});
		await observations.create({
			...base,
			metricSlug: "sleep_duration",
			value: 18_000,
			scaleMin: null,
			scaleMax: null,
		});
		await daily.upsert({
			metricSlug: "sleep_duration",
			localDay: base.localDay,
			value: 25_200,
			source: "health_connect",
		});
		const source = {
			observations: await observations.listAll(),
			dailyMetrics: await daily.listAll(),
		};

		expect(readDailySignal("mood", base.localDay, source)?.value).toBe(3);
		expect(readDailySignal("alcohol", base.localDay, source)?.value).toBe(0);
		expect(
			readDailySignal("alcohol", base.localDay, {
				...source,
				factorActive: () => false,
			}),
		).toBeNull();
		expect(
			readDailySignal("sleep_duration", base.localDay, source)?.value,
		).toBe(25_200);
		expect(readDailySignal("mood", "2026-08-13", source)).toBeNull();
	});
});
