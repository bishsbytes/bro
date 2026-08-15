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
			applied: [
				"0000_check_in",
				"0001_odd_lockheed",
				"0002_square_mikhail_rasputin",
			],
			skipped: [],
		});

		const objects = await db.getAllAsync<{ name: string; type: string }>(
			`SELECT name, type FROM sqlite_master
			 WHERE name IN (
				'observations',
				'day_notes',
				'tracked_metrics',
				'reminders',
				'assessments',
				'goals',
				'idx_observations_metric_day',
				'idx_observations_day',
				'idx_day_notes_day'
			 )
			 ORDER BY name`,
		);

		expect(objects).toEqual([
			{ name: "assessments", type: "table" },
			{ name: "day_notes", type: "table" },
			{ name: "goals", type: "table" },
			{ name: "idx_day_notes_day", type: "index" },
			{ name: "idx_observations_day", type: "index" },
			{ name: "idx_observations_metric_day", type: "index" },
			{ name: "observations", type: "table" },
			{ name: "reminders", type: "table" },
			{ name: "tracked_metrics", type: "table" },
		]);
		expect(
			objects
				.filter(({ type }) => type === "table")
				.map(({ name }) => name)
				.sort(),
		).toEqual([...databaseApp.PRODUCT_TABLES].sort());
		expect(
			await db.getFirstAsync<{ name: string }>(
				`SELECT name FROM pragma_table_info('tracked_metrics')
				 WHERE name = 'custom_label'`,
			),
		).toEqual({ name: "custom_label" });
	});

	it("is a no-op when the same database is migrated again", async () => {
		const { databaseApp, db } = await migratedDatabase("rerun.db");

		await databaseApp.runMigrations(db);
		await expect(databaseApp.runMigrations(db)).resolves.toEqual({
			applied: [],
			skipped: [
				"0000_check_in",
				"0001_odd_lockheed",
				"0002_square_mikhail_rasputin",
			],
		});

		const markers = await db.getAllAsync<{ id: string }>(
			"SELECT id FROM __app_migrations",
		);
		expect(markers).toEqual([
			{ id: "0000_check_in" },
			{ id: "0001_odd_lockheed" },
			{ id: "0002_square_mikhail_rasputin" },
		]);
	});

	it("applies only migration 003 to a step-2 database", async () => {
		const { databaseApp, db } = await migratedDatabase("step-two.db");
		await db.execAsync(`
			CREATE TABLE IF NOT EXISTS __app_migrations (
				id TEXT PRIMARY KEY NOT NULL,
				applied_at INTEGER NOT NULL
			);
			INSERT INTO __app_migrations (id, applied_at)
			VALUES ('0000_check_in', 1), ('0001_odd_lockheed', 2);
			CREATE TABLE tracked_metrics (
				id TEXT PRIMARY KEY NOT NULL,
				metric_slug TEXT NOT NULL,
				position INTEGER NOT NULL,
				added_at INTEGER,
				removed_at INTEGER,
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL
			);
		`);

		await expect(databaseApp.runMigrations(db)).resolves.toEqual({
			applied: ["0002_square_mikhail_rasputin"],
			skipped: ["0000_check_in", "0001_odd_lockheed"],
		});
		expect(
			await db.getAllAsync<{ name: string }>(
				`SELECT name FROM sqlite_master
				 WHERE type = 'table' AND name IN ('assessments', 'goals')
				 ORDER BY name`,
			),
		).toEqual([{ name: "assessments" }, { name: "goals" }]);
		expect(
			await db.getFirstAsync<{ name: string }>(
				`SELECT name FROM pragma_table_info('tracked_metrics')
				 WHERE name = 'custom_label'`,
			),
		).toEqual({ name: "custom_label" });
	});

	it("tolerates migration statements re-running after a marker race", async () => {
		const { databaseApp, db } = await migratedDatabase("marker-race.db");
		await databaseApp.runMigrations(db);
		const realGetAll = db.getAllAsync.bind(db);
		let hideMarkerOnce = true;

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
			applied: [
				"0000_check_in",
				"0001_odd_lockheed",
				"0002_square_mikhail_rasputin",
			],
			skipped: [],
		});

		const markers = await db.getFirstAsync<{ count: number }>(
			"SELECT COUNT(*) AS count FROM __app_migrations",
		);
		expect(markers?.count).toBe(3);
		expect(
			await db.getFirstAsync<{ count: number }>(
				`SELECT COUNT(*) AS count FROM pragma_table_info('tracked_metrics')
				 WHERE name = 'custom_label'`,
			),
		).toEqual({ count: 1 });
	});
});
