import type { SQLiteDatabase, SQLiteRunResult } from "expo-sqlite";

export type SQLiteParam = string | number | null | Uint8Array;

/**
 * Base class for the app's data-domain repositories.
 *
 * This is a thin ergonomics layer over expo-sqlite's raw API, not an ORM: every
 * query is hand-written parameterised SQL. Domain operations belong in
 * subclasses as named methods (`findById`, `listRecent`, …) — there is
 * deliberately no public `execute(sql)` escape hatch, so all SQL for a domain
 * stays in that domain's repository.
 *
 * See ./README.md for the recipe for adding a new one.
 */
export abstract class BaseRepository {
	protected constructor(protected readonly db: SQLiteDatabase) {}

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

	/** Runs several reads and writes atomically and returns the callback result. */
	protected async transaction<Result>(
		work: () => Promise<Result>,
	): Promise<Result> {
		let result: Result | undefined;
		await this.db.withTransactionAsync(async () => {
			result = await work();
		});
		return result as Result;
	}
}
