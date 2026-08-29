import {
	type FoodCacheEntry,
	FoodCacheRepository,
	getLocalDb,
} from "@bro/database-app";
import {
	type FoodSearchResult,
	isFoodSearchResponse,
	isFoodSearchResult,
} from "@bro/domain/food-search";
import type { SQLiteDatabase } from "expo-sqlite";
import { i18n } from "../i18n";

export type FoodSearchSnapshot = {
	query: string;
	results: FoodSearchResult[];
	fromCache: boolean;
	offline: boolean;
	message: string | null;
};

type SearchFetch = typeof fetch;

type FoodSearchStoreOptions = {
	baseUrl?: string;
	fetch?: SearchFetch;
	timeoutMs?: number;
};

/**
 * Each outcome ends with the same reassurance, so the catalogue keeps it as
 * one sentence interpolated into the three, rather than three near-copies a
 * translator has to keep in step.
 */
function searchMessage(outcome: "offline" | "busy" | "unavailable"): string {
	return i18n.t(`food:search.${outcome}`, {
		rest: i18n.t("food:search.stillAvailable"),
	});
}

function normalizedQuery(query: string): string {
	const normalized = query.trim();
	if (normalized.length < 2 || normalized.length > 120) {
		throw new RangeError(i18n.t("food:search.queryLength"));
	}
	return normalized;
}

function validCachedResults(
	entries: FoodCacheEntry<unknown>[],
): FoodSearchResult[] {
	return entries.flatMap(({ payload }) =>
		isFoodSearchResult(payload) ? [payload] : [],
	);
}

export class FoodSearchStore {
	private readonly cache: FoodCacheRepository;
	private readonly baseUrl: string | null;
	private readonly fetch: SearchFetch;
	private readonly timeoutMs: number;

	constructor(localDb: SQLiteDatabase, options: FoodSearchStoreOptions = {}) {
		this.cache = new FoodCacheRepository(localDb);
		this.baseUrl = options.baseUrl?.replace(/\/$/, "") ?? null;
		this.fetch = options.fetch ?? globalThis.fetch;
		this.timeoutMs = options.timeoutMs ?? 5_000;
	}

	async loadCached(query = ""): Promise<FoodSearchSnapshot> {
		const normalized = query.trim();
		const entries = normalized
			? await this.cache.listByQuery<unknown>(normalized)
			: await this.cache.listRecent<unknown>();
		return {
			query,
			results: validCachedResults(entries),
			fromCache: true,
			offline: false,
			message: null,
		};
	}

	async search(query: string): Promise<FoodSearchSnapshot> {
		const normalized = normalizedQuery(query);
		if (!this.baseUrl) return await this.degraded(query, normalized, true);
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
		try {
			const params = new URLSearchParams({ q: normalized });
			const response = await this.fetch(
				`${this.baseUrl}/api/food/search?${params}`,
				{
					method: "GET",
					credentials: "omit",
					headers: { Accept: "application/json" },
					signal: controller.signal,
				},
			);
			// A reply — of any status — proves the connection is fine, so saying
			// "you are offline" here would be a lie the user can see through.
			if (!response.ok) {
				return await this.degraded(
					query,
					normalized,
					false,
					response.status === 429
						? searchMessage("busy")
						: searchMessage("unavailable"),
				);
			}
			const payload: unknown = await response.json();
			if (!isFoodSearchResponse(payload)) {
				return await this.degraded(
					query,
					normalized,
					false,
					searchMessage("unavailable"),
				);
			}
			await Promise.all(
				payload.results.map((result) =>
					this.cache.upsert({
						ref: result.ref,
						payload: result,
						query: normalized,
					}),
				),
			);
			return {
				query,
				results: payload.results,
				fromCache: false,
				offline: false,
				message:
					payload.results.length === 0 ? i18n.t("food:search.noResults") : null,
			};
		} catch {
			return await this.degraded(query, normalized, true);
		} finally {
			clearTimeout(timeout);
		}
	}

	async findByRef(ref: string): Promise<FoodSearchResult | null> {
		const cached = await this.cache.findByRef<unknown>(ref);
		if (cached && isFoodSearchResult(cached.payload)) return cached.payload;
		if (!this.baseUrl) return null;
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
		try {
			const response = await this.fetch(
				`${this.baseUrl}/api/food/${encodeURIComponent(ref)}`,
				{
					method: "GET",
					credentials: "omit",
					headers: { Accept: "application/json" },
					signal: controller.signal,
				},
			);
			if (!response.ok) return null;
			const payload: unknown = await response.json();
			if (!isFoodSearchResult(payload)) return null;
			await this.cache.upsert({ ref: payload.ref, payload, query: null });
			return payload;
		} catch {
			return null;
		} finally {
			clearTimeout(timeout);
		}
	}

	/**
	 * Every failure keeps the typed query and falls back to the exact-query
	 * cache. Only the honesty of the line differs: `offline` is reserved for a
	 * request that never reached the server.
	 */
	private async degraded(
		query: string,
		normalized: string,
		offline: boolean,
		message: string = searchMessage("offline"),
	): Promise<FoodSearchSnapshot> {
		const cached = await this.cache.listByQuery<unknown>(normalized);
		return {
			query,
			results: validCachedResults(cached),
			fromCache: true,
			offline,
			message,
		};
	}
}

export function createFoodSearchStore(): FoodSearchStore {
	return new FoodSearchStore(getLocalDb(), {
		baseUrl: process.env.EXPO_PUBLIC_API_URL,
	});
}
