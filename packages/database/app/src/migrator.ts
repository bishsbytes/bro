import { drizzle } from "drizzle-orm/expo-sqlite";
import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import type { SQLiteDatabase } from "expo-sqlite";
import { localMigrations } from "./migrations/local-manifest";
import { migrations } from "./migrations/manifest";

/**
 * Applies the generated product schema through Drizzle's Expo migrator.
 * Repository queries continue to use the underlying expo-sqlite handle directly.
 */
export async function runMigrations(db: SQLiteDatabase): Promise<void> {
	await migrate(drizzle(db), migrations);
}

/** Applies the independent bro-local.db migration manifest. */
export async function runLocalMigrations(db: SQLiteDatabase): Promise<void> {
	await migrate(drizzle(db), localMigrations);
}
