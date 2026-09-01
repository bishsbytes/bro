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

	it("creates the complete current schema from the initial migration", async () => {
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
				 WHERE name IN
					('protein_g', 'carbs_g', 'fat_g', 'consumable_ref', 'nicotine_kg')
				 ORDER BY name`,
			),
		).toEqual([
			{ name: "carbs_g" },
			{ name: "consumable_ref" },
			{ name: "fat_g" },
			{ name: "nicotine_kg" },
			{ name: "protein_g" },
		]);
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

	it("adds nicotine_kg to a database that predates it, keeping its rows", async () => {
		const { databaseApp, db } = await migratedDatabase("baseline.db");

		// A device on the pre-nicotine baseline: the first migration's statements
		// applied and recorded in Drizzle's ledger — which is what stops the
		// baseline's plain CREATE TABLEs from re-running — plus a logged drink.
		const [baselineEntry] = migrations.journal.entries;
		if (!baselineEntry) throw new Error("Expected a baseline migration.");
		for (const statement of migrations.migrations.m0000.split(
			"--> statement-breakpoint",
		)) {
			await db.execAsync(statement);
		}
		await db.execAsync(
			`CREATE TABLE IF NOT EXISTS __drizzle_migrations (
				id SERIAL PRIMARY KEY,
				hash text NOT NULL,
				created_at numeric
			)`,
		);
		await db.runAsync(
			"INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
			["", baselineEntry.when],
		);
		await db.runAsync(
			`INSERT INTO consumption_entries (
				id, kind, label, quantity, ethanol_kg, occurred_at, local_day,
				tz_offset_minutes, created_at, updated_at
			) VALUES ('e1', 'drink', 'Lager, 4.5%', 1, 0.0202, 1, '2026-09-01', 0, 1, 1)`,
		);

		await expect(databaseApp.runMigrations(db)).resolves.toBeUndefined();

		expect(
			await db.getFirstAsync<{ name: string }>(
				`SELECT name FROM pragma_table_info('consumption_entries')
				 WHERE name = 'nicotine_kg'`,
			),
		).toEqual({ name: "nicotine_kg" });
		// The pre-existing drink survives untouched, with no nicotine of its own.
		expect(
			await db.getFirstAsync<{ label: string; nicotine_kg: number | null }>(
				"SELECT label, nicotine_kg FROM consumption_entries WHERE id = 'e1'",
			),
		).toEqual({ label: "Lager, 4.5%", nicotine_kg: null });
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
