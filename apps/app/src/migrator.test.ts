import type * as DatabaseApp from "@bro/database-app";
import type { SQLiteDatabase } from "expo-sqlite";
import { createNodeSqliteMock } from "./test-support/node-sqlite";

const mockSqlite = createNodeSqliteMock();
let activeDatabaseApp: typeof DatabaseApp | undefined;

const MIGRATION_IDS = [
	"0000_check_in",
	"0001_odd_lockheed",
	"0002_square_mikhail_rasputin",
	"0003_curly_tinkerer",
	"0004_brainy_maggott",
	"0005_red_wolfsbane",
	"0006_right_mother_askani",
	"0007_wooden_skreet",
] as const;

const LOCAL_MIGRATION_IDS = [
	"L001_health_import",
	"L002_raw_sample_origin",
	"L003_food_cache",
] as const;

function migrationsExcept(...ids: string[]): string[] {
	return MIGRATION_IDS.filter((id) => !ids.includes(id));
}

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
		await Promise.all([
			activeDatabaseApp?.closeDb(),
			activeDatabaseApp?.closeLocalDb(),
		]);
		activeDatabaseApp = undefined;
	});

	afterAll(() => {
		mockSqlite.cleanup();
	});

	it("creates the first product tables and indexes in a fresh database", async () => {
		const { databaseApp, db } = await migratedDatabase("fresh.db");

		await expect(databaseApp.runMigrations(db)).resolves.toEqual({
			applied: MIGRATION_IDS,
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
				'unit_preferences',
				'daily_metrics',
				'idx_observations_metric_day',
				'idx_observations_day',
				'idx_day_notes_day',
				'idx_daily_metrics_natural',
				'habits',
				'habit_completions',
				'challenge_enrolments',
				'challenge_progress',
				'consumption_entries',
				'custom_consumables',
				'custom_consumable_components',
				'idx_habit_completions_natural',
				'idx_challenge_progress_natural',
				'idx_consumption_entries_day',
				'idx_consumption_entries_kind_day',
				'idx_custom_consumable_components_parent'
			 )
			 ORDER BY name`,
		);

		expect(objects).toEqual([
			{ name: "assessments", type: "table" },
			{ name: "challenge_enrolments", type: "table" },
			{ name: "challenge_progress", type: "table" },
			{ name: "consumption_entries", type: "table" },
			{ name: "custom_consumable_components", type: "table" },
			{ name: "custom_consumables", type: "table" },
			{ name: "daily_metrics", type: "table" },
			{ name: "day_notes", type: "table" },
			{ name: "goals", type: "table" },
			{ name: "habit_completions", type: "table" },
			{ name: "habits", type: "table" },
			{ name: "idx_challenge_progress_natural", type: "index" },
			{ name: "idx_consumption_entries_day", type: "index" },
			{ name: "idx_consumption_entries_kind_day", type: "index" },
			{
				name: "idx_custom_consumable_components_parent",
				type: "index",
			},
			{ name: "idx_daily_metrics_natural", type: "index" },
			{ name: "idx_day_notes_day", type: "index" },
			{ name: "idx_habit_completions_natural", type: "index" },
			{ name: "idx_observations_day", type: "index" },
			{ name: "idx_observations_metric_day", type: "index" },
			{ name: "observations", type: "table" },
			{ name: "reminders", type: "table" },
			{ name: "tracked_metrics", type: "table" },
			{ name: "unit_preferences", type: "table" },
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

	it("applies migrations 003 through 008 to a step-2 database", async () => {
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
			applied: MIGRATION_IDS.slice(2),
			skipped: ["0000_check_in", "0001_odd_lockheed"],
		});
		expect(
			await db.getAllAsync<{ name: string }>(
				`SELECT name FROM sqlite_master
				 WHERE type = 'table'
				 AND name IN ('assessments', 'daily_metrics', 'goals', 'unit_preferences')
				 ORDER BY name`,
			),
		).toEqual([
			{ name: "assessments" },
			{ name: "daily_metrics" },
			{ name: "goals" },
			{ name: "unit_preferences" },
		]);
		expect(
			await db.getFirstAsync<{ name: string }>(
				`SELECT name FROM pragma_table_info('tracked_metrics')
				 WHERE name = 'custom_label'`,
			),
		).toEqual({ name: "custom_label" });
	});

	it("applies only migration 004 to a step-3 database", async () => {
		const { databaseApp, db } = await migratedDatabase("step-three.db");
		await databaseApp.runMigrations(db);
		await db.execAsync(`
			DROP TABLE unit_preferences;
			DELETE FROM __app_migrations WHERE id = '0003_curly_tinkerer';
		`);

		await expect(databaseApp.runMigrations(db)).resolves.toEqual({
			applied: ["0003_curly_tinkerer"],
			skipped: migrationsExcept("0003_curly_tinkerer"),
		});
		expect(
			await db.getFirstAsync<{ name: string }>(
				`SELECT name FROM sqlite_master
				 WHERE type = 'table' AND name = 'unit_preferences'`,
			),
		).toEqual({ name: "unit_preferences" });
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
			await db.getFirstAsync<{ count: number }>(
				`SELECT COUNT(*) AS count FROM pragma_table_info('tracked_metrics')
				 WHERE name = 'custom_label'`,
			),
		).toEqual({ count: 1 });
	});

	it("applies migration 005 to a step-4 database", async () => {
		const { databaseApp, db } = await migratedDatabase("step-four.db");
		await databaseApp.runMigrations(db);
		await db.execAsync(`
			DROP TABLE daily_metrics;
			DELETE FROM __app_migrations WHERE id = '0004_brainy_maggott';
		`);

		await expect(databaseApp.runMigrations(db)).resolves.toEqual({
			applied: ["0004_brainy_maggott"],
			skipped: migrationsExcept("0004_brainy_maggott"),
		});
		expect(
			await db.getFirstAsync<{ name: string }>(
				`SELECT name FROM sqlite_master
				 WHERE type = 'table' AND name = 'daily_metrics'`,
			),
		).toEqual({ name: "daily_metrics" });
	});

	it("applies only migration 006 to a step-5 database", async () => {
		const { databaseApp, db } = await migratedDatabase("step-five.db");
		await databaseApp.runMigrations(db);
		await db.execAsync(`
			DROP TABLE challenge_progress;
			DROP TABLE challenge_enrolments;
			DROP TABLE habit_completions;
			DROP TABLE habits;
			DELETE FROM __app_migrations WHERE id = '0005_red_wolfsbane';
		`);

		await expect(databaseApp.runMigrations(db)).resolves.toEqual({
			applied: ["0005_red_wolfsbane"],
			skipped: migrationsExcept("0005_red_wolfsbane"),
		});
		expect(
			await db.getAllAsync<{ name: string }>(
				`SELECT name FROM sqlite_master
				 WHERE type = 'table'
				 AND name IN (
					'habits', 'habit_completions',
					'challenge_enrolments', 'challenge_progress'
				 ) ORDER BY name`,
			),
		).toEqual([
			{ name: "challenge_enrolments" },
			{ name: "challenge_progress" },
			{ name: "habit_completions" },
			{ name: "habits" },
		]);
	});

	it("applies only migration 007 to a step-7 database", async () => {
		const { databaseApp, db } = await migratedDatabase("step-seven.db");
		await databaseApp.runMigrations(db);
		await db.execAsync(`
			DROP TABLE consumption_entries;
			DELETE FROM __app_migrations WHERE id = '0006_right_mother_askani';
		`);

		await expect(databaseApp.runMigrations(db)).resolves.toEqual({
			applied: ["0006_right_mother_askani"],
			skipped: migrationsExcept("0006_right_mother_askani"),
		});
		expect(
			await db.getAllAsync<{ name: string; type: string }>(
				`SELECT name, type FROM sqlite_master
				 WHERE name IN (
					'consumption_entries', 'idx_consumption_entries_day',
					'idx_consumption_entries_kind_day'
				 ) ORDER BY name`,
			),
		).toEqual([
			{ name: "consumption_entries", type: "table" },
			{ name: "idx_consumption_entries_day", type: "index" },
			{ name: "idx_consumption_entries_kind_day", type: "index" },
		]);
	});

	it("applies only migration 008 to a step-8 database", async () => {
		const { databaseApp, db } = await migratedDatabase("step-eight.db");
		await databaseApp.runMigrations(db);
		await db.execAsync(`
			DROP TABLE custom_consumable_components;
			DROP TABLE custom_consumables;
			ALTER TABLE consumption_entries DROP COLUMN protein_g;
			ALTER TABLE consumption_entries DROP COLUMN carbs_g;
			ALTER TABLE consumption_entries DROP COLUMN fat_g;
			ALTER TABLE consumption_entries DROP COLUMN consumable_ref;
			DELETE FROM __app_migrations WHERE id = '0007_wooden_skreet';
		`);

		await expect(databaseApp.runMigrations(db)).resolves.toEqual({
			applied: ["0007_wooden_skreet"],
			skipped: migrationsExcept("0007_wooden_skreet"),
		});
		expect(
			await db.getAllAsync<{ name: string }>(
				`SELECT name FROM pragma_table_info('consumption_entries')
				 WHERE name IN ('protein_g', 'carbs_g', 'fat_g', 'consumable_ref')
				 ORDER BY name`,
			),
		).toHaveLength(4);
		expect(
			await db.getAllAsync<{ name: string }>(
				`SELECT name FROM sqlite_master
				 WHERE type = 'table'
				 AND name IN ('custom_consumables', 'custom_consumable_components')
				 ORDER BY name`,
			),
		).toEqual([
			{ name: "custom_consumable_components" },
			{ name: "custom_consumables" },
		]);
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
			 WHERE name IN (
				'health_connections', 'raw_samples', 'food_cache',
				'idx_health_connections_platform_metric',
				'idx_raw_samples_identity', 'idx_raw_samples_metric_day'
			 ) ORDER BY name`,
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
