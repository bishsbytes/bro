import type * as DatabaseApp from "@bro/database-app";
import type { SQLiteDatabase } from "expo-sqlite";
import { createNodeSqliteMock } from "./test-support/node-sqlite";

const mockSqlite = createNodeSqliteMock();
let activeDatabaseApp: typeof DatabaseApp | undefined;

jest.mock("expo-sqlite", () => ({
	openDatabaseSync: mockSqlite.openDatabaseSync,
	openDatabaseAsync: mockSqlite.openDatabaseAsync,
}));

function loadDatabaseApp(): typeof DatabaseApp {
	jest.resetModules();
	return jest.requireActual("@bro/database-app");
}

async function migratedDatabase(databaseName: string) {
	const databaseApp = loadDatabaseApp();
	activeDatabaseApp = databaseApp;
	const db = await databaseApp.initDb(databaseName);
	return { databaseApp, db };
}

describe("product database migrations", () => {
	beforeEach(() => {
		mockSqlite.reset();
	});

	afterEach(async () => {
		await activeDatabaseApp?.closeDb();
		activeDatabaseApp = undefined;
	});

	afterAll(() => {
		mockSqlite.cleanup();
	});

	it("creates the first product tables and indexes in a fresh database", async () => {
		const { databaseApp, db } = await migratedDatabase("fresh.db");

		await expect(databaseApp.runMigrations(db)).resolves.toEqual({
			applied: ["0000_check_in"],
			skipped: [],
		});

		const objects = await db.getAllAsync<{ name: string; type: string }>(
			`SELECT name, type FROM sqlite_master
			 WHERE name IN (
				'observations',
				'day_notes',
				'tracked_metrics',
				'idx_observations_metric_day',
				'idx_observations_day',
				'idx_day_notes_day'
			 )
			 ORDER BY name`,
		);

		expect(objects).toEqual([
			{ name: "day_notes", type: "table" },
			{ name: "idx_day_notes_day", type: "index" },
			{ name: "idx_observations_day", type: "index" },
			{ name: "idx_observations_metric_day", type: "index" },
			{ name: "observations", type: "table" },
			{ name: "tracked_metrics", type: "table" },
		]);
		expect(
			objects
				.filter(({ type }) => type === "table")
				.map(({ name }) => name)
				.sort(),
		).toEqual([...databaseApp.PRODUCT_TABLES].sort());
	});

	it("is a no-op when the same database is migrated again", async () => {
		const { databaseApp, db } = await migratedDatabase("rerun.db");

		await databaseApp.runMigrations(db);
		await expect(databaseApp.runMigrations(db)).resolves.toEqual({
			applied: [],
			skipped: ["0000_check_in"],
		});

		const markers = await db.getAllAsync<{ id: string }>(
			"SELECT id FROM __app_migrations",
		);
		expect(markers).toEqual([{ id: "0000_check_in" }]);
	});

	it("tolerates a replicated marker winning the race after startup", async () => {
		const { databaseApp, db } = await migratedDatabase("marker-race.db");
		const realGetAll = db.getAllAsync.bind(db);
		let hideMarkerOnce = true;

		await db.execAsync(`
			CREATE TABLE IF NOT EXISTS __app_migrations (
				id TEXT PRIMARY KEY NOT NULL,
				applied_at INTEGER NOT NULL
			);
			INSERT INTO __app_migrations (id, applied_at)
			VALUES ('0000_check_in', 1);
		`);

		const racingDb = {
			...db,
			getAllAsync: async <Row>(sql: string, ...params: unknown[]) => {
				if (hideMarkerOnce && sql.includes("__app_migrations")) {
					hideMarkerOnce = false;
					return [] as Row[];
				}

				return await realGetAll<Row>(sql, ...(params as never[]));
			},
		} as SQLiteDatabase;

		await expect(databaseApp.runMigrations(racingDb)).resolves.toEqual({
			applied: ["0000_check_in"],
			skipped: [],
		});

		const marker = await db.getFirstAsync<{ count: number }>(
			"SELECT COUNT(*) AS count FROM __app_migrations WHERE id = ?",
			["0000_check_in"],
		);
		expect(marker?.count).toBe(1);
	});
});
