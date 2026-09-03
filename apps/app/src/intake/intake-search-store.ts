import {
	type FoodCacheEntry,
	FoodCacheRepository,
	getLocalDb,
} from "@bro/database-app";
import {
	type ExternalConsumable,
	isExternalConsumable,
	isExternalConsumableResponse,
} from "@bro/domain/food-search";
import type { SQLiteDatabase } from "expo-sqlite";
import { i18n } from "../i18n";

export type IntakeSearchSnapshot = {
	query: string;
	results: ExternalConsumable[];
	fromCache: boolean;
	offline: boolean;
	message: string | null;
};

type SearchFetch = typeof fetch;

type IntakeSearchStoreOptions = {
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
	return i18n.t(`intake:log.${outcome}`, {
		rest: i18n.t("intake:log.stillAvailable"),
	});
}

function normalizedQuery(query: string): string {
	const normalized = query.trim();
	if (normalized.length < 2 || normalized.length > 120) {
		throw new RangeError(i18n.t("intake:log.queryLength"));
	}
	return normalized;
}

function validCachedResults(
	entries: FoodCacheEntry<unknown>[],
): ExternalConsumable[] {
	return entries.flatMap(({ payload }) =>
		isExternalConsumable(payload) ? [payload] : [],
	);
}

/**
 * The only thing in the app that needs a connection. Results are cached in
 * the disposable local store as seen; logging one is what writes the
 * replicating library row, and that is the intake store's job.
 */
export class IntakeSearchStore {
	private readonly cache: FoodCacheRepository;
	private readonly baseUrl: string | null;
	private readonly fetch: SearchFetch;
	private readonly timeoutMs: number;

	constructor(localDb: SQLiteDatabase, options: IntakeSearchStoreOptions = {}) {
		this.cache = new FoodCacheRepository(localDb);
		this.baseUrl = options.baseUrl?.replace(/\/$/, "") ?? null;
		this.fetch = options.fetch ?? globalThis.fetch;
		this.timeoutMs = options.timeoutMs ?? 5_000;
	}

	async loadCached(query = ""): Promise<IntakeSearchSnapshot> {
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

	async search(query: string): Promise<IntakeSearchSnapshot> {
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
			if (!isExternalConsumableResponse(payload)) {
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
					payload.results.length === 0 ? i18n.t("intake:log.noResults") : null,
			};
		} catch {
			return await this.degraded(query, normalized, true);
		} finally {
			clearTimeout(timeout);
		}
	}

	async findByRef(ref: string): Promise<ExternalConsumable | null> {
		const cached = await this.cache.findByRef<unknown>(ref);
		if (cached && isExternalConsumable(cached.payload)) return cached.payload;
		return await this.lookup(`/api/food/${encodeURIComponent(ref)}`);
	}

	/** A lookup, not a scan: the camera is a later native batch. */
	async lookupBarcode(barcode: string): Promise<ExternalConsumable | null> {
		const code = barcode.trim();
		if (!/^\d{8,14}$/.test(code)) return null;
		const cached = await this.cache.findByRef<unknown>(`off:${code}`);
		if (cached && isExternalConsumable(cached.payload)) return cached.payload;
		return await this.lookup(`/api/food/barcode/${code}`);
	}

	private async lookup(path: string): Promise<ExternalConsumable | null> {
		if (!this.baseUrl) return null;
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
		try {
			const response = await this.fetch(`${this.baseUrl}${path}`, {
				method: "GET",
				credentials: "omit",
				headers: { Accept: "application/json" },
				signal: controller.signal,
			});
			if (!response.ok) return null;
			const payload: unknown = await response.json();
			if (!isExternalConsumable(payload)) return null;
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
	): Promise<IntakeSearchSnapshot> {
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

export function createIntakeSearchStore(): IntakeSearchStore {
	return new IntakeSearchStore(getLocalDb(), {
		baseUrl: process.env.EXPO_PUBLIC_API_URL,
	});
}
