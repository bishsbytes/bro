import type { SQLiteDatabase, SQLiteRunResult } from "expo-sqlite";
import {
	assertScopeFor,
	type TransactionScope,
	withTransaction,
} from "../transaction";
import { createUuidV7 } from "../uuid-v7";

export type SQLiteParam = string | number | null | Uint8Array;

/**
 * The clock and identity a repository writes with. Both are injectable so tests
 * can pin timestamps and ids without reaching into the database.
 */
export type RepositoryOptions = {
	now?: () => number;
	createId?: (timestamp: number) => string;
};

/**
 * Base class for the app's data-domain repositories.
 *
 * This is a thin ergonomics layer over expo-sqlite's raw API, not an ORM: every
 * query is hand-written parameterised SQL. Domain operations belong in
 * subclasses as named methods (`findById`, `listRecent`, …) — there is
 * deliberately no public `execute(sql)` escape hatch, so all SQL for a domain
 * stays in that domain's repository.
 *
 * Subclasses that need nothing beyond `db`, `now`, and `createId` can omit a
 * constructor entirely and inherit this one.
 *
 * See ./README.md for the recipe for adding a new one.
 */
export abstract class BaseRepository {
	protected readonly now: () => number;
	/**
	 * Time-ordered by default, so rows written in sequence sort in that order
	 * without a separate index. A repository whose rows have a natural key
	 * overrides this with its own deterministic id instead.
	 */
	protected readonly createId: (timestamp: number) => string;

	constructor(
		protected readonly db: SQLiteDatabase,
		options: RepositoryOptions = {},
	) {
		this.now = options.now ?? Date.now;
		this.createId = options.createId ?? createUuidV7;
	}

	/** Rows matching a query, or an empty array. */
	protected async all<Row>(
		sql: string,
		params: SQLiteParam[] = [],
	): Promise<Row[]> {
		return await this.db.getAllAsync<Row>(sql, params);
	}

	/** The first matching row, or null. */
	protected async first<Row>(
		sql: string,
		params: SQLiteParam[] = [],
	): Promise<Row | null> {
		return await this.db.getFirstAsync<Row>(sql, params);
	}

	/** A write returning affected-row and last-insert metadata. */
	protected async run(
		sql: string,
		params: SQLiteParam[] = [],
	): Promise<SQLiteRunResult> {
		return await this.db.runAsync(sql, params);
	}

	/**
	 * Runs several reads and writes atomically and returns the callback result.
	 *
	 * A caller already inside a transaction passes its `scope`, and the work
	 * joins that transaction rather than opening a second one SQLite would
	 * refuse. Methods that can be composed this way take an optional trailing
	 * scope and hand it straight to here.
	 */
	protected async transaction<Result>(
		work: () => Promise<Result>,
		scope?: TransactionScope,
	): Promise<Result> {
		if (scope !== undefined) {
			assertScopeFor(scope, this.db);
			return await work();
		}
		return await withTransaction(this.db, async () => await work());
	}
}
