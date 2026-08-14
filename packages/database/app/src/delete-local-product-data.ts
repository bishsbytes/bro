import type { SQLiteDatabase } from "expo-sqlite";
import { getDb } from "./connection";
import { PRODUCT_TABLES } from "./product-tables";

/**
 * Hard-deletes product rows while preserving the database file and migrations.
 * Device settings live in bro-device.db and are deliberately outside this
 * transaction.
 */
export async function deleteLocalProductData(
	db: SQLiteDatabase = getDb(),
): Promise<void> {
	await db.withTransactionAsync(async () => {
		for (const table of PRODUCT_TABLES) {
			await db.runAsync(`DELETE FROM "${table}"`);
		}
	});
}
