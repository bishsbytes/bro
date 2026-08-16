import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

export const LOCAL_DATABASE_NAME = "bro-local.db";

let database: SQLiteDatabase | undefined;
let opening: Promise<SQLiteDatabase> | undefined;
let openDatabaseName: string | undefined;

/** Opens the disposable, device-only health import store once per process. */
export async function initLocalDb(
	databaseName = LOCAL_DATABASE_NAME,
): Promise<SQLiteDatabase> {
	if (openDatabaseName !== undefined && openDatabaseName !== databaseName) {
		throw new Error(
			`Local database "${openDatabaseName}" is already open. Close it before opening "${databaseName}".`,
		);
	}
	if (database) {
		return database;
	}

	openDatabaseName = databaseName;
	opening ??= openDatabaseAsync(databaseName)
		.then((db) => {
			database = db;
			return db;
		})
		.catch((error: unknown) => {
			openDatabaseName = undefined;
			throw error;
		})
		.finally(() => {
			opening = undefined;
		});
	return await opening;
}

export function getLocalDb(): SQLiteDatabase {
	if (!database) {
		throw new Error(
			"Local database is not open yet. Await initLocalDb() during app startup.",
		);
	}
	return database;
}

export async function closeLocalDb(): Promise<void> {
	if (!database) {
		return;
	}
	await database.closeAsync();
	database = undefined;
	openDatabaseName = undefined;
}
