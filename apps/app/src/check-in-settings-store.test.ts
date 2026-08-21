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

const { CheckInSettingsStore } = jest.requireActual(
	"./check-in/check-in-settings-store",
) as typeof import("./check-in/check-in-settings-store");

describe("check-in settings store", () => {
	beforeEach(async () => {
		mockSqlite.reset();
		databaseApp = jest.requireActual("@bro/database-app");
		db = await databaseApp.initDb("check-in-settings-store.db");
		await databaseApp.runMigrations(db);
	});

	afterEach(async () => {
		await databaseApp.closeDb();
	});

	afterAll(() => mockSqlite.cleanup());

	it("keeps optional prompts off by default and persists each toggle", async () => {
		const store = new CheckInSettingsStore(db);
		expect(await store.load()).toEqual({
			metrics: [
				{
					metricSlug: "motivation",
					label: "Motivation",
					enabled: false,
					sensitive: false,
				},
				{
					metricSlug: "productivity",
					label: "Productivity",
					enabled: false,
					sensitive: false,
				},
				{
					metricSlug: "libido",
					label: "Libido",
					enabled: false,
					sensitive: true,
				},
			],
		});

		expect(
			(await store.setEnabled("motivation", true)).metrics.find(
				(metric) => metric.metricSlug === "motivation",
			),
		).toMatchObject({ metricSlug: "motivation", enabled: true });
		await expect(store.setEnabled("mood", false)).rejects.toThrow(
			"Unknown optional check-in score: mood",
		);
	});
});
