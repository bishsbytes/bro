import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type NodeSqliteMock = {
	/** Drop-in replacement for expo-sqlite's `openDatabaseAsync`. */
	openDatabaseAsync: jest.Mock;
	/** Starts a fresh device: new files, so module state and storage reset together. */
	reset: () => void;
	cleanup: () => void;
};

/**
 * Backs expo-sqlite's async surface with a real SQLite engine and real files, so
 * schema tests exercise the actual DDL, constraints, PRAGMAs, and transaction
 * behaviour instead of a fake that pattern-matches SQL strings. Files persist
 * across `closeAsync`, which is what makes cold-relaunch assertions meaningful.
 */
export function createNodeSqliteMock(): NodeSqliteMock {
	const roots: string[] = [];

	function newRoot(): string {
		const root = mkdtempSync(join(tmpdir(), "bro-sqlite-"));
		roots.push(root);
		return root;
	}

	let root = newRoot();

	const openDatabaseAsync = jest.fn(async (databaseName: string) => {
		const db = new DatabaseSync(join(root, databaseName));

		return {
			execAsync: async (sql: string) => {
				db.exec(sql);
			},
			getFirstAsync: async (sql: string, params: unknown[] = []) =>
				db.prepare(sql).get(...(params as never[])) ?? null,
			getAllAsync: async (sql: string, params: unknown[] = []) =>
				db.prepare(sql).all(...(params as never[])),
			runAsync: async (sql: string, params: unknown[] = []) =>
				db.prepare(sql).run(...(params as never[])),
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
			closeAsync: async () => {
				db.close();
			},
		};
	});

	return {
		openDatabaseAsync,
		reset: () => {
			root = newRoot();
			openDatabaseAsync.mockClear();
		},
		cleanup: () => {
			for (const previous of roots) {
				rmSync(previous, { recursive: true, force: true });
			}
		},
	};
}
