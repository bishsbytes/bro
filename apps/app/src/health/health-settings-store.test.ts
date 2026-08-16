import type * as DatabaseApp from "@bro/database-app";
import type { SQLiteDatabase } from "expo-sqlite";
import { createNodeSqliteMock } from "../test-support/node-sqlite";

const mockSqlite = createNodeSqliteMock();
let mockRandomByte = 0;

jest.mock("expo-sqlite", () => ({
	openDatabaseSync: mockSqlite.openDatabaseSync,
	openDatabaseAsync: mockSqlite.openDatabaseAsync,
}));
jest.mock("expo-crypto", () => ({
	getRandomBytes: jest.fn((length: number) => {
		const bytes = new Uint8Array(length);
		bytes.fill(++mockRandomByte);
		return bytes;
	}),
}));

const databaseApp: typeof DatabaseApp = jest.requireActual("@bro/database-app");
const { HealthSettingsStore }: typeof import("./health-settings-store") =
	jest.requireActual("./health-settings-store");

describe("health settings store", () => {
	let db: SQLiteDatabase;

	beforeEach(async () => {
		mockSqlite.reset();
		mockRandomByte = 0;
		db = await mockSqlite.openDatabaseAsync("health-settings.db");
		await databaseApp.runLocalMigrations(db);
	});

	afterEach(async () => {
		await db.closeAsync();
	});

	afterAll(() => mockSqlite.cleanup());

	it("reflects partial grants and the latest import time from local connection state", async () => {
		const connections = new databaseApp.HealthConnectionRepository(db, {
			now: () => 1_000,
			createId: () => "connection-1",
		});
		const engine = {
			availability: jest.fn(async () => ({
				available: true as const,
				platform: "health_connect" as const,
			})),
			connect: jest.fn(async () => {
				await connections.connect("health_connect", "sleep_duration");
				await connections.markImported(
					"health_connect",
					"sleep_duration",
					"token-1",
					2_000,
				);
				return {
					platform: "health_connect" as const,
					importedMetrics: ["sleep_duration" as const],
					importedSamples: 1,
				};
			}),
			refresh: jest.fn(async () => ({
				platform: "health_connect" as const,
				importedMetrics: ["sleep_duration" as const],
				importedSamples: 0,
			})),
			disconnect: jest.fn(
				async () => await connections.disconnect("health_connect"),
			),
			openSettings: jest.fn(async () => undefined),
		};
		const store = new HealthSettingsStore(engine, () => connections);

		expect(await store.load()).toMatchObject({
			platformLabel: "Health Connect",
			connected: false,
		});
		const connected = await store.connect();
		expect(connected.connected).toBe(true);
		expect(connected.metrics.filter((metric) => metric.connected)).toEqual([
			{
				metricSlug: "sleep_duration",
				label: "Sleep",
				connected: true,
				lastImportedAt: 2_000,
			},
		]);
		expect((await store.disconnect()).connected).toBe(false);
	});
});
