import type { SQLiteDatabase } from "expo-sqlite";
import { getDb } from "./connection";
import { writeCheckInDraft, writeNoteDraft } from "./device-settings";
import { getLocalDb } from "./local-connection";
import { LOCAL_TABLES } from "./local-tables";
import { PRODUCT_TABLES } from "./product-tables";
import { withTransaction } from "./transaction";

/**
 * Hard-deletes durable product rows and disposable import rows while preserving
 * both database files and their migration histories. Each store owns its own
 * transaction; SQLite cannot make a transaction span two file handles.
 */
export async function deleteLocalProductData(
	db: SQLiteDatabase = getDb(),
	localDb: SQLiteDatabase = getLocalDb(),
): Promise<void> {
	writeNoteDraft(null);
	writeCheckInDraft("morning", null);
	writeCheckInDraft("evening", null);
	await withTransaction(db, async ({ database }) => {
		for (const table of PRODUCT_TABLES) {
			await database.runAsync(`DELETE FROM "${table}"`);
		}
	});

	await withTransaction(localDb, async ({ database }) => {
		for (const table of LOCAL_TABLES) {
			await database.runAsync(`DELETE FROM "${table}"`);
		}
	});
}
