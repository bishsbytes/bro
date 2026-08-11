import {
	openDatabaseAsync,
	type SQLiteDatabase,
	type SQLiteOpenOptions,
} from "expo-sqlite";

export const DATABASE_NAME = "bro.db";

let database: SQLiteDatabase | undefined;
let opening: Promise<SQLiteDatabase> | undefined;
let syncEnabled = false;

function readSyncCredentials(): { url: string; authToken: string } | undefined {
	const url = process.env.EXPO_PUBLIC_TURSO_SYNC_URL;
	const authToken = process.env.EXPO_PUBLIC_TURSO_AUTH_TOKEN;

	if ((url && !authToken) || (!url && authToken)) {
		throw new Error(
			"Turso requires both EXPO_PUBLIC_TURSO_SYNC_URL and EXPO_PUBLIC_TURSO_AUTH_TOKEN. Leave both blank for local-only storage.",
		);
	}

	if (!url || !authToken) {
		return undefined;
	}

	return { url, authToken };
}

async function open(): Promise<SQLiteDatabase> {
	const credentials = readSyncCredentials();
	const options: SQLiteOpenOptions = credentials
		? {
				libSQLOptions: {
					url: credentials.url,
					authToken: credentials.authToken,
				},
			}
		: {};

	syncEnabled = credentials !== undefined;

	return await openDatabaseAsync(DATABASE_NAME, options);
}

/**
 * Opens the embedded database once per process.
 *
 * With `EXPO_PUBLIC_TURSO_SYNC_URL` and `EXPO_PUBLIC_TURSO_AUTH_TOKEN` set, this
 * is a libSQL embedded replica that syncs with the remote Turso database.
 * Without them it falls back to a purely local on-device SQLite file, which is
 * fully functional apart from sync.
 */
export async function initDb(): Promise<SQLiteDatabase> {
	if (database) {
		return database;
	}

	// Cache the in-flight promise so concurrent callers share one open.
	opening ??= open().then((db) => {
		database = db;
		opening = undefined;
		return db;
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

/** True when the database was opened as a syncing embedded replica. */
export function isSyncEnabled(): boolean {
	return syncEnabled;
}

/**
 * Pushes local writes to, and pulls remote changes from, the Turso database.
 * No-ops in local-only mode.
 */
export async function triggerSync(): Promise<void> {
	if (!syncEnabled) {
		return;
	}

	await getDb().syncLibSQL();
}

/** Closes the handle and resets module state. Intended for tests. */
export async function closeDb(): Promise<void> {
	if (!database) {
		return;
	}

	await database.closeAsync();
	database = undefined;
	syncEnabled = false;
}
