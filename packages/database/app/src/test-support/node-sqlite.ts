import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type NodeSqliteMock = {
	/** Stands in for the `expo-sqlite` module. */
	openDatabaseSync: jest.Mock;
	openDatabaseAsync: jest.Mock;
	/** Stands in for `expo-sqlite/kv-store`'s class of the same name. */
	SQLiteStorage: new (
		databaseName: string,
	) => NodeSQLiteStorage;
	/** Starts a fresh device: new files, so module state and storage reset together. */
	reset: () => void;
	cleanup: () => void;
};

export type NodeSQLiteStorage = {
	getItemSync: (key: string) => string | null;
	setItemSync: (key: string, value: string) => void;
	removeItemSync: (key: string) => boolean;
	getAllKeysSync: () => string[];
	closeSync: () => void;
};

/**
 * Backs both storage entry points with a real SQLite engine and real files, so
 * these tests exercise actual SQL and actual persistence rather than a fake
 * that pattern-matches SQL strings. Files survive close, which is what makes
 * cold-relaunch assertions meaningful.
 */
export function createNodeSqliteMock(): NodeSqliteMock {
	const roots: string[] = [];
	let root = mkdtempSync(join(tmpdir(), "bro-sqlite-"));
	roots.push(root);

	function open(databaseName: string): DatabaseSync {
		return new DatabaseSync(
			databaseName === ":memory:" ? ":memory:" : join(root, databaseName),
		);
	}

	function wrap(db: DatabaseSync) {
		const bindParams = (params: unknown[]): unknown[] =>
			params.length === 1 && Array.isArray(params[0])
				? (params[0] as unknown[])
				: params;

		return {
			execSync: (sql: string) => db.exec(sql),
			prepareSync: (sql: string) => ({
				executeSync: (params: unknown[] = []) => {
					const statement = db.prepare(sql);
					if (statement.columns().length > 0) {
						return {
							changes: 0,
							lastInsertRowId: 0,
							getAllSync: () => statement.all(...(params as never[])),
							getFirstSync: () => statement.get(...(params as never[])) ?? null,
						};
					}

					const result = statement.run(...(params as never[]));
					return {
						changes: Number(result.changes),
						lastInsertRowId: Number(result.lastInsertRowid),
						getAllSync: () => [],
						getFirstSync: () => null,
					};
				},
				executeForRawResultSync: (params: unknown[] = []) => {
					const statement = db.prepare(sql);
					statement.setReturnArrays(true);
					return {
						getAllSync: () => statement.all(...(params as never[])),
					};
				},
			}),
			getFirstSync: (sql: string, ...params: unknown[]) =>
				db.prepare(sql).get(...(bindParams(params) as never[])) ?? null,
			getAllSync: (sql: string, ...params: unknown[]) =>
				db.prepare(sql).all(...(bindParams(params) as never[])),
			runSync: (sql: string, ...params: unknown[]) =>
				db.prepare(sql).run(...(bindParams(params) as never[])),
			closeSync: () => db.close(),
			execAsync: async (sql: string) => db.exec(sql),
			getFirstAsync: async (sql: string, ...params: unknown[]) =>
				db.prepare(sql).get(...(bindParams(params) as never[])) ?? null,
			getAllAsync: async (sql: string, ...params: unknown[]) =>
				db.prepare(sql).all(...(bindParams(params) as never[])),
			runAsync: async (sql: string, ...params: unknown[]) =>
				db.prepare(sql).run(...(bindParams(params) as never[])),
			withTransactionAsync: async (work: () => Promise<void>) => {
				db.exec("BEGIN");
				try {
					await work();
					db.exec("COMMIT");
				} catch (error) {
					db.exec("ROLLBACK");
					throw error;
				}
			},
			closeAsync: async () => db.close(),
		};
	}

	const openDatabaseSync = jest.fn((databaseName: string) =>
		wrap(open(databaseName)),
	);
	const openDatabaseAsync = jest.fn(async (databaseName: string) =>
		wrap(open(databaseName)),
	);

	class SQLiteStorage implements NodeSQLiteStorage {
		private db: DatabaseSync | null = null;

		constructor(private readonly databaseName: string) {}

		private getDb(): DatabaseSync {
			if (!this.db) {
				const db = open(this.databaseName);
				db.exec(
					"CREATE TABLE IF NOT EXISTS storage (key TEXT PRIMARY KEY NOT NULL, value TEXT);",
				);
				this.db = db;
			}

			return this.db;
		}

		getItemSync(key: string): string | null {
			const row = this.getDb()
				.prepare("SELECT value FROM storage WHERE key = ?;")
				.get(key) as { value: string } | undefined;
			return row?.value ?? null;
		}

		setItemSync(key: string, value: string): void {
			this.getDb()
				.prepare(
					"INSERT INTO storage (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;",
				)
				.run(key, value);
		}

		removeItemSync(key: string): boolean {
			const result = this.getDb()
				.prepare("DELETE FROM storage WHERE key = ?;")
				.run(key);
			return Number(result.changes) > 0;
		}

		getAllKeysSync(): string[] {
			const rows = this.getDb().prepare("SELECT key FROM storage;").all() as {
				key: string;
			}[];
			return rows.map((row) => row.key);
		}

		closeSync(): void {
			this.db?.close();
			this.db = null;
		}
	}

	return {
		openDatabaseSync,
		openDatabaseAsync,
		SQLiteStorage,
		reset: () => {
			root = mkdtempSync(join(tmpdir(), "bro-sqlite-"));
			roots.push(root);
			openDatabaseSync.mockClear();
			openDatabaseAsync.mockClear();
		},
		cleanup: () => {
			for (const previous of roots) {
				rmSync(previous, { recursive: true, force: true });
			}
		},
	};
}
