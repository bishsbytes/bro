import type { SQLiteDatabase } from "expo-sqlite";

const SCOPE_DATABASE = Symbol("transactionScopeDatabase");

/**
 * Proof that the holder is already inside an open transaction on a database.
 *
 * SQLite has no nested `BEGIN`, so a repository method that opens its own
 * transaction cannot be called from inside another one. A caller that already
 * holds a transaction passes its scope down, and the method runs its work
 * directly instead of opening a second.
 *
 * The scope is passed explicitly rather than tracked ambiently on the database.
 * JavaScript cannot tell a genuinely nested call from an unrelated one that
 * merely interleaved with it, so ambient tracking would silently enrol an
 * independent write into someone else's transaction — and roll it back with
 * them. An argument cannot be wrong about which call it came from.
 */
export type TransactionScope = {
	readonly [SCOPE_DATABASE]: SQLiteDatabase;
};

/**
 * Runs `work` inside one transaction, handing it a scope to pass to any
 * repository method that would otherwise open its own.
 */
export async function withTransaction<Result>(
	db: SQLiteDatabase,
	work: (scope: TransactionScope) => Promise<Result>,
): Promise<Result> {
	const scope: TransactionScope = { [SCOPE_DATABASE]: db };
	let result: Result | undefined;
	await db.withTransactionAsync(async () => {
		result = await work(scope);
	});
	return result as Result;
}

/**
 * Throws unless the scope belongs to `db`. A scope from another connection is
 * proof of nothing here, and honouring it would skip a transaction that was
 * never opened — the app holds two connections, so this is reachable.
 */
export function assertScopeFor(
	scope: TransactionScope,
	db: SQLiteDatabase,
): void {
	if (scope[SCOPE_DATABASE] !== db) {
		throw new TypeError(
			"Transaction scope belongs to a different database connection.",
		);
	}
}
