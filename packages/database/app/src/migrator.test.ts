import type { SQLiteDatabase } from "expo-sqlite";
import type * as DatabaseApp from "./index";
import { createNodeSqliteMock } from "./test-support/node-sqlite";

const mockSqlite = createNodeSqliteMock();
let activeDatabaseApp: typeof DatabaseApp | undefined;

const MIGRATION_IDS = ["0000_initial_schema", "0001_bored_giant_man"] as const;
const LOCAL_MIGRATION_IDS = ["L000_local_store"] as const;

jest.mock("expo-sqlite", () => ({
	openDatabaseSync: mockSqlite.openDatabaseSync,
	openDatabaseAsync: mockSqlite.openDatabaseAsync,
}));

function loadDatabaseApp(): typeof DatabaseApp {
	jest.resetModules();
	return jest.requireActual("./index");
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
		await Promise.all([
			activeDatabaseApp?.closeDb(),
			activeDatabaseApp?.closeLocalDb(),
		]);
		activeDatabaseApp = undefined;
	});

	afterAll(() => {
		mockSqlite.cleanup();
	});

	it("creates every product table and index in a fresh database", async () => {
		const { databaseApp, db } = await migratedDatabase("fresh.db");

		await expect(databaseApp.runMigrations(db)).resolves.toEqual({
			applied: MIGRATION_IDS,
			skipped: [],
		});

		const objects = await db.getAllAsync<{ name: string; type: string }>(
			`SELECT name, type FROM sqlite_master
			 WHERE name NOT LIKE 'sqlite_%' AND name != '__app_migrations'
			 ORDER BY name`,
		);

		expect(
			objects
				.filter(({ type }) => type === "table")
				.map(({ name }) => name)
				.sort(),
		).toEqual([...databaseApp.PRODUCT_TABLES].sort());
		expect(
			objects.filter(({ type }) => type === "index").map(({ name }) => name),
		).toEqual([
			"idx_challenge_progress_natural",
			"idx_consumption_entries_day",
			"idx_consumption_entries_kind_day",
			"idx_custom_consumable_components_parent",
			"idx_daily_metrics_natural",
			"idx_day_notes_day",
			"idx_habit_completions_natural",
			"idx_observations_day",
			"idx_observations_metric_day",
		]);
	});

	it("creates the columns that were once incremental additions", async () => {
		const { databaseApp, db } = await migratedDatabase("columns.db");
		await databaseApp.runMigrations(db);

		expect(
			await db.getFirstAsync<{ name: string }>(
				`SELECT name FROM pragma_table_info('tracked_metrics')
				 WHERE name = 'custom_label'`,
			),
		).toEqual({ name: "custom_label" });
		expect(
			await db.getAllAsync<{ name: string }>(
				`SELECT name FROM pragma_table_info('consumption_entries')
				 WHERE name IN ('protein_g', 'carbs_g', 'fat_g', 'consumable_ref')
				 ORDER BY name`,
			),
		).toEqual([
			{ name: "carbs_g" },
			{ name: "consumable_ref" },
			{ name: "fat_g" },
			{ name: "protein_g" },
		]);
		expect(
			await db.getFirstAsync<{ name: string }>(
				`SELECT name FROM pragma_table_info('habits')
				 WHERE name = 'area_slug'`,
			),
		).toEqual({ name: "area_slug" });
	});

	it("is a no-op when the same database is migrated again", async () => {
		const { databaseApp, db } = await migratedDatabase("rerun.db");

		await databaseApp.runMigrations(db);
		await expect(databaseApp.runMigrations(db)).resolves.toEqual({
			applied: [],
			skipped: MIGRATION_IDS,
		});

		const markers = await db.getAllAsync<{ id: string }>(
			"SELECT id FROM __app_migrations",
		);
		expect(markers).toEqual(MIGRATION_IDS.map((id) => ({ id })));
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
			applied: MIGRATION_IDS,
			skipped: [],
		});

		const markers = await db.getFirstAsync<{ count: number }>(
			"SELECT COUNT(*) AS count FROM __app_migrations",
		);
		expect(markers?.count).toBe(MIGRATION_IDS.length);
		expect(
			await db.getAllAsync<{ name: string }>(
				`SELECT name FROM sqlite_master WHERE type = 'table'
				 AND name NOT LIKE 'sqlite_%' AND name != '__app_migrations'`,
			),
		).toHaveLength(databaseApp.PRODUCT_TABLES.length);
	});

	it("restores a table dropped out from under the migration marker", async () => {
		const { databaseApp, db } = await migratedDatabase("repair.db");
		await databaseApp.runMigrations(db);
		await db.execAsync(`
			DROP TABLE unit_preferences;
			DELETE FROM __app_migrations WHERE id = '0000_initial_schema';
		`);

		await expect(databaseApp.runMigrations(db)).resolves.toEqual({
			applied: ["0000_initial_schema"],
			skipped: ["0001_bored_giant_man"],
		});
		expect(
			await db.getFirstAsync<{ name: string }>(
				`SELECT name FROM sqlite_master
				 WHERE type = 'table' AND name = 'unit_preferences'`,
			),
		).toEqual({ name: "unit_preferences" });
	});

	it("replays a column-adding migration without failing on the live column", async () => {
		const { databaseApp, db } = await migratedDatabase("column-replay.db");
		await databaseApp.runMigrations(db);
		await db.execAsync(
			`DELETE FROM __app_migrations WHERE id = '0001_bored_giant_man';`,
		);

		await expect(databaseApp.runMigrations(db)).resolves.toEqual({
			applied: ["0001_bored_giant_man"],
			skipped: ["0000_initial_schema"],
		});
		expect(
			await db.getAllAsync<{ name: string }>(
				`SELECT name FROM pragma_table_info('habits')
				 WHERE name = 'area_slug'`,
			),
		).toEqual([{ name: "area_slug" }]);
	});

	it("creates and safely re-runs the independent local-store manifest", async () => {
		const databaseApp = loadDatabaseApp();
		activeDatabaseApp = databaseApp;
		const db = await databaseApp.initLocalDb("fresh-local.db");

		await expect(databaseApp.runLocalMigrations(db)).resolves.toEqual({
			applied: LOCAL_MIGRATION_IDS,
			skipped: [],
		});
		expect(await databaseApp.runLocalMigrations(db)).toEqual({
			applied: [],
			skipped: LOCAL_MIGRATION_IDS,
		});
		expect(
			await db.getAllAsync<{ name: string }>(
				"SELECT name FROM pragma_table_info('raw_samples') WHERE name = 'origin'",
			),
		).toEqual([{ name: "origin" }]);

		const objects = await db.getAllAsync<{ name: string; type: string }>(
			`SELECT name, type FROM sqlite_master
			 WHERE name NOT LIKE 'sqlite_%' AND name != '__local_migrations'
			 ORDER BY name`,
		);
		expect(objects).toEqual([
			{ name: "food_cache", type: "table" },
			{ name: "health_connections", type: "table" },
			{ name: "idx_health_connections_platform_metric", type: "index" },
			{ name: "idx_raw_samples_identity", type: "index" },
			{ name: "idx_raw_samples_metric_day", type: "index" },
			{ name: "raw_samples", type: "table" },
		]);
		expect(
			objects
				.filter(({ type }) => type === "table")
				.map(({ name }) => name)
				.sort(),
		).toEqual([...databaseApp.LOCAL_TABLES].sort());
	});
});
