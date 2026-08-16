import type { SQLiteDatabase } from "expo-sqlite";
import { getDb } from "./connection";
import { getLocalDb } from "./local-connection";
import { LOCAL_TABLES } from "./local-tables";
import { PRODUCT_TABLES } from "./product-tables";

/**
 * Hard-deletes durable product rows and disposable import rows while preserving
 * both database files and their migration histories. Each store owns its own
 * transaction; SQLite cannot make a transaction span two file handles.
 */
export async function deleteLocalProductData(
	db: SQLiteDatabase = getDb(),
	localDb: SQLiteDatabase = getLocalDb(),
): Promise<void> {
	await db.withTransactionAsync(async () => {
		for (const table of PRODUCT_TABLES) {
			await db.runAsync(`DELETE FROM "${table}"`);
		}
	});

	await localDb.withTransactionAsync(async () => {
		for (const table of LOCAL_TABLES) {
			await localDb.runAsync(`DELETE FROM "${table}"`);
		}
	});
}
