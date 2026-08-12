import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

export const DATABASE_NAME = "bro.db";

let database: SQLiteDatabase | undefined;
let opening: Promise<SQLiteDatabase> | undefined;
let openDatabaseName: string | undefined;

/**
 * Opens the active workspace's local product database once per process.
 * Phase 5 will reintroduce embedded replicas with API-minted credentials; the
 * Phase 1 connection is intentionally local-only.
 */
export async function initDb(
	databaseName = DATABASE_NAME,
): Promise<SQLiteDatabase> {
	// Claimed when the open starts rather than when it resolves, so a concurrent
	// caller asking for a different workspace is rejected instead of being handed
	// the first caller's handle.
	if (openDatabaseName !== undefined && openDatabaseName !== databaseName) {
		throw new Error(
			`Database "${openDatabaseName}" is already open. Close it before opening "${databaseName}".`,
		);
	}

	if (database) {
		return database;
	}

	openDatabaseName = databaseName;

	// Cache the in-flight promise so concurrent callers share one open.
	opening ??= openDatabaseAsync(databaseName)
		.then((db) => {
			database = db;
			return db;
		})
		.catch((error: unknown) => {
			// A rejected open must leave no claim behind, so the startup error
			// screen can retry — possibly against a different workspace.
			openDatabaseName = undefined;
			throw error;
		})
		.finally(() => {
			opening = undefined;
		});

	return await opening;
}

/**
 * Returns the open database handle. Call {@link initDb} first — this throws
 * rather than opening implicitly so startup ordering stays explicit.
 */
export function getDb(): SQLiteDatabase {
	if (!database) {
		throw new Error(
			"Database is not open yet. Await initDb() during app startup.",
		);
	}

	return database;
}

/** Closes the active handle so startup can retry or another workspace can open. */
export async function closeDb(): Promise<void> {
	if (!database) {
		return;
	}

	await database.closeAsync();
	database = undefined;
	openDatabaseName = undefined;
}
