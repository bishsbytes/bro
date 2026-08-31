import type { MigrationMeta } from "drizzle-orm/migrator";
import { type AsyncRemoteCallback, drizzle } from "drizzle-orm/sqlite-proxy";
import type { SQLiteDatabase } from "expo-sqlite";
import { localMigrations } from "./migrations/local-manifest";
import { migrations } from "./migrations/manifest";

type MigrationBundle = {
	journal: {
		entries: readonly {
			idx: number;
			when: number;
			tag: string;
			breakpoints: boolean;
		}[];
	};
	migrations: Readonly<Record<string, string>>;
};

type DrizzleMigrationDatabase = {
	dialect: {
		migrate: (migrations: MigrationMeta[], session: unknown) => Promise<void>;
	};
	session: unknown;
};

function migrationMetadata(bundle: MigrationBundle): MigrationMeta[] {
	return bundle.journal.entries.map((entry) => {
		const key = `m${entry.idx.toString().padStart(4, "0")}`;
		const migration = bundle.migrations[key];
		if (migration === undefined) {
			throw new Error(`Missing migration: ${entry.tag}`);
		}
		return {
			sql: migration.split("--> statement-breakpoint"),
			folderMillis: entry.when,
			hash: "",
			bps: entry.breakpoints,
		};
	});
}

function asyncDrizzleDatabase(db: SQLiteDatabase): DrizzleMigrationDatabase {
	const query: AsyncRemoteCallback = async (sql, params, method) => {
		if (method === "run") {
			await db.runAsync(sql, params);
			return { rows: [] };
		}
		if (method === "values") {
			const statement = await db.prepareAsync(sql);
			try {
				const result = await statement.executeForRawResultAsync(params);
				return { rows: await result.getAllAsync() };
			} finally {
				await statement.finalizeAsync();
			}
		}
		throw new TypeError(`Unsupported migration query method: ${method}`);
	};

	// Drizzle's public Expo adapter is synchronous. Its async SQLite dialect is
	// exposed through sqlite-proxy, but the dialect/session fields used by every
	// official migrator are marked internal in the type declarations.
	return drizzle(query) as unknown as DrizzleMigrationDatabase;
}

async function runMigrationBundle(
	db: SQLiteDatabase,
	bundle: MigrationBundle,
): Promise<void> {
	const drizzleDb = asyncDrizzleDatabase(db);
	await drizzleDb.dialect.migrate(migrationMetadata(bundle), drizzleDb.session);
}

/**
 * Applies the generated product schema through Drizzle's async SQLite dialect.
 * Repository queries continue to use the underlying expo-sqlite handle directly.
 */
export async function runMigrations(db: SQLiteDatabase): Promise<void> {
	await runMigrationBundle(db, migrations);
}

/** Applies the independent bro-local.db migration manifest. */
export async function runLocalMigrations(db: SQLiteDatabase): Promise<void> {
	await runMigrationBundle(db, localMigrations);
}
