import type { SQLiteDatabase } from "expo-sqlite";
import { type Migration, migrations } from "./migrations/manifest";

const MIGRATIONS_TABLE = "__app_migrations";

/**
 * drizzle-kit splits a migration into statements with this marker. Each
 * statement is executed separately so a multi-statement migration applies
 * cleanly inside one transaction.
 */
const STATEMENT_BREAKPOINT = "--> statement-breakpoint";

export type MigrationResult = {
	applied: string[];
	skipped: string[];
};

async function ensureMigrationsTable(db: SQLiteDatabase): Promise<void> {
	await db.execAsync(
		`CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
			id TEXT PRIMARY KEY NOT NULL,
			applied_at INTEGER NOT NULL
		)`,
	);
}

async function readAppliedIds(db: SQLiteDatabase): Promise<Set<string>> {
	const rows = await db.getAllAsync<{ id: string }>(
		`SELECT id FROM ${MIGRATIONS_TABLE}`,
	);
	return new Set(rows.map((row) => row.id));
}

function statementsOf(migration: Migration): string[] {
	return migration.sql
		.split(STATEMENT_BREAKPOINT)
		.map((statement) => statement.trim())
		.filter((statement) => statement.length > 0);
}

const ADD_COLUMN_STATEMENT =
	/^ALTER TABLE [`"]?([A-Za-z_][A-Za-z0-9_]*)[`"]? ADD(?: COLUMN)? [`"]?([A-Za-z_][A-Za-z0-9_]*)[`"]?/i;

async function executeStatement(
	db: SQLiteDatabase,
	statement: string,
): Promise<void> {
	const addColumn = statement.match(ADD_COLUMN_STATEMENT);
	if (addColumn) {
		const [, tableName, columnName] = addColumn;
		const columns = await db.getAllAsync<{ name: string }>(
			`PRAGMA table_info("${tableName}")`,
		);
		if (columns.some(({ name }) => name === columnName)) {
			return;
		}
	}

	await db.execAsync(statement);
}

/**
 * Applies any migrations that have not run against this device's database.
 *
 * Deliberately hand-rolled on top of expo-sqlite's raw API rather than
 * drizzle-orm/expo-sqlite's migrator, so the Drizzle query client stays out of
 * the app bundle entirely (see src/repositories/README.md).
 *
 * Throws on the first failing migration — a database in an unknown shape should
 * stop startup rather than let the app run against it.
 */
export async function runMigrations(
	db: SQLiteDatabase,
): Promise<MigrationResult> {
	await ensureMigrationsTable(db);

	const applied = await readAppliedIds(db);
	const result: MigrationResult = { applied: [], skipped: [] };

	for (const migration of migrations) {
		if (applied.has(migration.id)) {
			result.skipped.push(migration.id);
			continue;
		}

		await db.withTransactionAsync(async () => {
			for (const statement of statementsOf(migration)) {
				await executeStatement(db, statement);
			}

			await db.runAsync(
				`INSERT INTO ${MIGRATIONS_TABLE} (id, applied_at) VALUES (?, ?)
				 ON CONFLICT (id) DO NOTHING`,
				[migration.id, Date.now()],
			);
		});

		result.applied.push(migration.id);
	}

	return result;
}
