import { BaseRepository } from "./base-repository";

export type FoodCacheEntry<Payload = unknown> = {
	ref: string;
	payload: Payload;
	query: string | null;
	fetchedAt: number;
};

export type UpsertFoodCacheEntry<Payload = unknown> = Pick<
	FoodCacheEntry<Payload>,
	"ref" | "payload" | "query"
>;

type FoodCacheRow = {
	ref: string;
	payload: string;
	query: string | null;
	fetched_at: number;
};

const SELECT_COLUMNS = "ref, payload, query, fetched_at";

function normalizedRef(ref: string): string {
	const normalized = ref.trim();
	if (!/^[^:\s]+:.+$/.test(normalized)) {
		throw new TypeError("Food cache ref must use a provider namespace.");
	}
	return normalized;
}

function normalizedQuery(query: string | null): string | null {
	return query?.trim() || null;
}

function serializedPayload(payload: unknown): string {
	let serialized: string | undefined;
	try {
		serialized = JSON.stringify(payload);
	} catch {
		throw new TypeError("Food cache payload must be JSON serializable.");
	}
	if (serialized === undefined) {
		throw new TypeError("Food cache payload must be JSON serializable.");
	}
	return serialized;
}

function toEntry<Payload>(row: FoodCacheRow): FoodCacheEntry<Payload> {
	let payload: Payload;
	try {
		payload = JSON.parse(row.payload) as Payload;
	} catch {
		throw new TypeError(`Food cache payload is invalid JSON: ${row.ref}`);
	}
	return {
		ref: row.ref,
		payload,
		query: row.query,
		fetchedAt: row.fetched_at,
	};
}

function assertLimit(limit: number): void {
	if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
		throw new RangeError("Food cache limit must be from 1 through 100.");
	}
}

export class FoodCacheRepository extends BaseRepository {
	async upsert<Payload>(
		input: UpsertFoodCacheEntry<Payload>,
	): Promise<FoodCacheEntry<Payload>> {
		const entry: FoodCacheEntry<Payload> = {
			ref: normalizedRef(input.ref),
			payload: input.payload,
			query: normalizedQuery(input.query),
			fetchedAt: this.now(),
		};
		await this.run(
			`INSERT INTO food_cache (ref, payload, query, fetched_at)
			 VALUES (?, ?, ?, ?)
			 ON CONFLICT (ref) DO UPDATE SET
				payload = excluded.payload,
				query = excluded.query,
				fetched_at = excluded.fetched_at`,
			[
				entry.ref,
				serializedPayload(entry.payload),
				entry.query,
				entry.fetchedAt,
			],
		);
		return entry;
	}

	async findByRef<Payload = unknown>(
		ref: string,
	): Promise<FoodCacheEntry<Payload> | null> {
		const row = await this.first<FoodCacheRow>(
			`SELECT ${SELECT_COLUMNS} FROM food_cache WHERE ref = ?`,
			[normalizedRef(ref)],
		);
		return row ? toEntry<Payload>(row) : null;
	}

	async listByQuery<Payload = unknown>(
		query: string,
		limit = 20,
	): Promise<FoodCacheEntry<Payload>[]> {
		const normalized = normalizedQuery(query);
		if (!normalized) {
			return [];
		}
		assertLimit(limit);
		const rows = await this.all<FoodCacheRow>(
			`SELECT ${SELECT_COLUMNS} FROM food_cache
			 WHERE query = ? COLLATE NOCASE
			 ORDER BY fetched_at DESC, ref ASC LIMIT ?`,
			[normalized, limit],
		);
		return rows.map(toEntry<Payload>);
	}

	async listRecent<Payload = unknown>(
		limit = 20,
	): Promise<FoodCacheEntry<Payload>[]> {
		assertLimit(limit);
		const rows = await this.all<FoodCacheRow>(
			`SELECT ${SELECT_COLUMNS} FROM food_cache
			 ORDER BY fetched_at DESC, ref ASC LIMIT ?`,
			[limit],
		);
		return rows.map(toEntry<Payload>);
	}

	async pruneFetchedBefore(timestamp: number): Promise<number> {
		if (!Number.isInteger(timestamp)) {
			throw new TypeError("Food cache prune time must be epoch milliseconds.");
		}
		const result = await this.run(
			"DELETE FROM food_cache WHERE fetched_at < ?",
			[timestamp],
		);
		return result.changes;
	}

	async delete(ref: string): Promise<boolean> {
		const result = await this.run("DELETE FROM food_cache WHERE ref = ?", [
			normalizedRef(ref),
		]);
		return result.changes > 0;
	}
}
