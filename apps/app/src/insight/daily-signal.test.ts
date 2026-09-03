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
	"@bro/logic",
) as typeof import("@bro/logic");

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

	it("resolves scored, imported, tag, and intake-derived signals", async () => {
		const observations = new databaseApp.ObservationRepository(db);
		const daily = new databaseApp.DailyMetricRepository(db);
		const intake = new databaseApp.IntakeEventRepository(db);
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
			slot: "morning",
		});
		await observations.create({
			...base,
			observedAt: base.observedAt + 1,
			metricSlug: "mood",
			value: 4,
			scaleMin: 1,
			scaleMax: 5,
			slot: "evening",
		});
		await observations.create({
			...base,
			observedAt: base.observedAt + 2,
			metricSlug: "mood",
			value: 10,
			scaleMin: 0,
			scaleMax: 10,
			slot: "morning",
		});
		await observations.create({
			...base,
			observedAt: base.observedAt + 2 * 86_400_000,
			localDay: "2026-08-16",
			metricSlug: "mood",
			value: 3,
			scaleMin: 1,
			scaleMax: 5,
			slot: "morning",
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
		const event = {
			consumableId: null,
			brand: null,
			quantity: 1,
			massKg: null,
			context: null,
			notes: null,
			tzOffsetMinutes: -60,
		};
		await intake.create({
			...event,
			kind: "drink",
			sourceRef: "system:drink:lager-4_5",
			name: "Lager",
			portionLabel: "pint",
			volumeL: 0.568_261_25,
			constituents: {
				fluid: 0.568_261_25,
				ethanol: 0.020_181_999,
				caffeine: 0,
				energy: 227,
			},
			occurredAt: base.observedAt,
			localDay: base.localDay,
		});
		await intake.create({
			...event,
			kind: "drink",
			sourceRef: "system:drink:filter-coffee",
			name: "Coffee",
			portionLabel: "mug",
			volumeL: 0.25,
			constituents: { fluid: 0.25, ethanol: 0, caffeine: 0.000_095, energy: 2 },
			occurredAt: base.observedAt + 86_400_000,
			localDay: "2026-08-15",
		});
		const source = {
			observations: await observations.listAll(),
			dailyMetrics: await daily.listAll(),
			intakeEvents: await intake.listAll(),
		};

		expect(readDailySignal("mood", base.localDay, source)?.value).toBe(3);
		expect(
			readDailySignal("ethanol_intake", base.localDay, source)?.value,
		).toBe(0.020_181_999);
		expect(
			readDailySignal("caffeine_intake", "2026-08-15", source)?.value,
		).toBe(0.000_095);
		// A check-in day with no entries reads as zero intake; a day without a
		// check-in stays unknown rather than claiming abstinence.
		expect(readDailySignal("ethanol_intake", "2026-08-16", source)?.value).toBe(
			0,
		);
		expect(readDailySignal("ethanol_intake", "2026-08-17", source)).toBeNull();
		expect(
			readDailySignal("training", "2026-08-16", {
				...source,
				tagActive: () => false,
			}),
		).toBeNull();
		expect(readDailySignal("training", "2026-08-16", source)?.value).toBe(0);
		expect(readDailySignal("training", "2026-08-17", source)).toBeNull();
		expect(
			readDailySignal("sleep_duration", base.localDay, source)?.value,
		).toBe(18_000);
		expect(readDailySignal("mood", "2026-08-13", source)).toBeNull();
	});
});
