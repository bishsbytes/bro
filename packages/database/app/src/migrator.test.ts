import type * as DatabaseApp from "./index";
import { migrations } from "./migrations/manifest";
import { createNodeSqliteMock } from "./test-support/node-sqlite";

const mockSqlite = createNodeSqliteMock();
let activeDatabaseApp: typeof DatabaseApp | undefined;

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
		const prepareAsync = jest.spyOn(db, "prepareAsync");

		await expect(databaseApp.runMigrations(db)).resolves.toBeUndefined();
		expect(prepareAsync).toHaveBeenCalled();

		const objects = await db.getAllAsync<{ name: string; type: string }>(
			`SELECT name, type FROM sqlite_master
			 WHERE name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'
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
			"idx_consumables_kind",
			"idx_consumables_source",
			"idx_daily_metrics_natural",
			"idx_day_notes_day",
			"idx_habit_completions_natural",
			"idx_intake_events_day",
			"idx_intake_events_kind_day",
			"idx_observations_day",
			"idx_observations_metric_day",
			"idx_recipe_ingredients_recipe",
		]);
	});

	it("creates the complete current schema from the initial migration", async () => {
		const { databaseApp, db } = await migratedDatabase("columns.db");
		await databaseApp.runMigrations(db);

		expect(
			await db.getFirstAsync<{ name: string }>(
				`SELECT name FROM pragma_table_info('tracked_metrics')
				 WHERE name = 'custom_label'`,
			),
		).toEqual({ name: "custom_label" });
		// The intake model: a constituent map on every event, and a library with
		// provenance columns. No old table name survives the squash.
		expect(
			await db.getAllAsync<{ name: string; notnull: number }>(
				`SELECT name, "notnull" FROM pragma_table_info('intake_events')
				 WHERE name IN ('constituents', 'context', 'source_ref', 'mass_kg')
				 ORDER BY name`,
			),
		).toEqual([
			{ name: "constituents", notnull: 1 },
			{ name: "context", notnull: 0 },
			{ name: "mass_kg", notnull: 0 },
			{ name: "source_ref", notnull: 0 },
		]);
		expect(
			await db.getAllAsync<{ name: string }>(
				`SELECT name FROM pragma_table_info('consumables')
				 WHERE name IN ('source_type', 'source_ref', 'source_version', 'forked_from', 'recipe')
				 ORDER BY name`,
			),
		).toEqual([
			{ name: "forked_from" },
			{ name: "recipe" },
			{ name: "source_ref" },
			{ name: "source_type" },
			{ name: "source_version" },
		]);
		expect(
			await db.getAllAsync<{ name: string }>(
				`SELECT name FROM sqlite_master WHERE type = 'table' AND name IN
					('consumption_entries', 'custom_consumables', 'custom_consumable_components')`,
			),
		).toEqual([]);
		expect(
			await db.getFirstAsync<{ name: string }>(
				`SELECT name FROM pragma_table_info('habits')
				 WHERE name = 'area_slug'`,
			),
		).toEqual({ name: "area_slug" });
		expect(
			await db.getAllAsync<{ name: string }>(
				`SELECT name FROM pragma_table_info('observations')
				 WHERE name = 'slot'`,
			),
		).toEqual([{ name: "slot" }]);
		expect(
			await db.getAllAsync<{ name: string }>(
				`SELECT name FROM pragma_table_info('tracked_metrics')
				 WHERE name = 'check_in_slots'`,
			),
		).toEqual([{ name: "check_in_slots" }]);
		expect(
			await db.getAllAsync<{ name: string; notnull: number }>(
				`SELECT name, "notnull" FROM pragma_table_info('reminders')
				 WHERE name = 'slot'`,
			),
		).toEqual([{ name: "slot", notnull: 1 }]);
	});

	it("is a no-op when the same database is migrated again", async () => {
		const { databaseApp, db } = await migratedDatabase("rerun.db");

		await databaseApp.runMigrations(db);
		await expect(databaseApp.runMigrations(db)).resolves.toBeUndefined();

		const marker = await db.getFirstAsync<{ count: number }>(
			"SELECT COUNT(*) AS count FROM __drizzle_migrations",
		);
		expect(marker?.count).toBe(migrations.journal.entries.length);
	});

	it("creates and safely re-runs the independent local-store manifest", async () => {
		const databaseApp = loadDatabaseApp();
		activeDatabaseApp = databaseApp;
		const db = await databaseApp.initLocalDb("fresh-local.db");

		await expect(databaseApp.runLocalMigrations(db)).resolves.toBeUndefined();
		await expect(databaseApp.runLocalMigrations(db)).resolves.toBeUndefined();
		expect(
			await db.getAllAsync<{ name: string }>(
				"SELECT name FROM pragma_table_info('raw_samples') WHERE name = 'origin'",
			),
		).toEqual([{ name: "origin" }]);

		const objects = await db.getAllAsync<{ name: string; type: string }>(
			`SELECT name, type FROM sqlite_master
			 WHERE name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'
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
		expect(
			await db.getFirstAsync<{ count: number }>(
				"SELECT COUNT(*) AS count FROM __drizzle_migrations",
			),
		).toEqual({ count: 1 });
	});
});
