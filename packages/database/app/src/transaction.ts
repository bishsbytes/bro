import type { SQLiteDatabase } from "expo-sqlite";

const owners = new WeakMap<SQLiteDatabase, SQLiteDatabase>();
const queues = new WeakMap<SQLiteDatabase, Promise<unknown>>();
const connections = new WeakMap<SQLiteDatabase, SQLiteDatabase>();
const scopes = new WeakMap<SQLiteDatabase, TransactionScope>();

export type TransactionScope = {
	readonly database: SQLiteDatabase;
	readonly owner: SQLiteDatabase;
	active: boolean;
};

function ownerOf(db: SQLiteDatabase): SQLiteDatabase {
	return owners.get(db) ?? db;
}

function enqueue<Result>(
	db: SQLiteDatabase,
	work: () => Promise<Result>,
): Promise<Result> {
	const owner = ownerOf(db);
	const pending = queues.get(owner) ?? Promise.resolve();
	const result = pending.then(work, work);
	queues.set(
		owner,
		result.catch(() => undefined),
	);
	return result;
}

/** All repository I/O joins the connection queue. Only an explicit scope bypasses it. */
export function coordinatedDatabase(db: SQLiteDatabase): SQLiteDatabase {
	if (scopes.has(db)) return db;
	const owner = ownerOf(db);
	const existing = connections.get(owner);
	if (existing) return existing;
	const proxy = new Proxy(owner, {
		get(target, key) {
			const value = Reflect.get(target, key, target);
			if (typeof value !== "function") return value;
			if (typeof key === "string" && key.endsWith("Async")) {
				return (...args: unknown[]) =>
					enqueue(owner, () => value.apply(target, args));
			}
			return value.bind(target);
		},
	});
	owners.set(proxy, owner);
	connections.set(owner, proxy);
	return proxy;
}

/** A scoped connection is valid only inside the awaited callback that owns it. */
export async function withTransaction<Result>(
	db: SQLiteDatabase,
	work: (scope: TransactionScope) => Promise<Result>,
): Promise<Result> {
	const joined = scopes.get(db);
	if (joined) {
		assertScopeFor(joined, db);
		return work(joined);
	}
	const owner = ownerOf(db);
	return enqueue(owner, async () => {
		let result: Result | undefined;
		const proxy = new Proxy(owner, {
			get(target, key) {
				const value = Reflect.get(target, key, target);
				if (typeof value !== "function") return value;
				return (...args: unknown[]) => {
					if (!scope.active) throw new Error("Transaction scope has ended.");
					return value.apply(target, args);
				};
			},
		});
		const scope: TransactionScope = { database: proxy, owner, active: true };
		owners.set(proxy, owner);
		scopes.set(proxy, scope);
		try {
			await owner.withTransactionAsync(async () => {
				result = await work(scope);
			});
			return result as Result;
		} finally {
			scope.active = false;
		}
	});
}

export function assertScopeFor(
	scope: TransactionScope,
	db: SQLiteDatabase,
): void {
	if (scope.owner !== ownerOf(db))
		throw new TypeError(
			"Transaction scope belongs to a different database connection.",
		);
	if (!scope.active) throw new Error("Transaction scope has ended.");
}
