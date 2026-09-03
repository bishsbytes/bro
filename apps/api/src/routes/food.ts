import type { ExternalConsumableResponse } from "@bro/domain/food-search";
import { type Context, Hono } from "hono";
import {
	type FoodProvider,
	FoodProviderUnavailableError,
} from "../food/open-food-facts.js";

export type FoodRouteEvent =
	| "food_lookup_hit"
	| "food_lookup_miss"
	| "food_lookup_rate_limited"
	| "food_lookup_upstream_error";

export type FoodRouteObserver = (
	event: FoodRouteEvent,
	values: { durationMs?: number; resultCount?: number },
) => void;

type Bucket = { count: number; resetsAt: number };

export class InMemoryFoodRateLimiter {
	private readonly buckets = new Map<string, Bucket>();

	constructor(
		private readonly limit = 30,
		private readonly windowMs = 60_000,
		private readonly now: () => number = Date.now,
		private readonly maxBuckets = 10_000,
	) {}

	consume(bucket: string): { allowed: boolean; retryAfterSeconds: number } {
		const now = this.now();
		let current = this.buckets.get(bucket);
		if (!current) this.evictFor(now);
		if (!current || current.resetsAt <= now) {
			current = { count: 0, resetsAt: now + this.windowMs };
			this.buckets.set(bucket, current);
		}
		current.count += 1;
		return {
			allowed: current.count <= this.limit,
			retryAfterSeconds: Math.max(
				1,
				Math.ceil((current.resetsAt - now) / 1_000),
			),
		};
	}

	/**
	 * Keeps the map bounded before admitting a new bucket. Expired windows go
	 * first; if the map is still full, the window closest to expiring is dropped.
	 * Never collapses callers into a shared bucket — one caller's traffic must
	 * not be able to rate limit anybody else.
	 */
	private evictFor(now: number): void {
		if (this.buckets.size < this.maxBuckets) return;
		for (const [key, value] of this.buckets) {
			if (value.resetsAt <= now) this.buckets.delete(key);
		}
		while (this.buckets.size >= this.maxBuckets) {
			let oldestKey: string | undefined;
			let oldestResetsAt = Number.POSITIVE_INFINITY;
			for (const [key, value] of this.buckets) {
				if (value.resetsAt < oldestResetsAt) {
					oldestResetsAt = value.resetsAt;
					oldestKey = key;
				}
			}
			if (oldestKey === undefined) return;
			this.buckets.delete(oldestKey);
		}
	}
}

/** Exported for tests: the only thing ever derived from a caller's address. */
export function coarseBucketOf(value: string | undefined): string {
	const forwarded = value?.split(",", 1)[0]?.trim();
	// Node reports an IPv4 peer on a dual-stack socket as ::ffff:a.b.c.d, which
	// is an IPv4 address wearing an IPv6 costume — unwrap it, or every IPv4
	// caller lands in one bucket and rate limits every other IPv4 caller.
	const address = forwarded?.replace(/^::ffff:(?=\d{1,3}(\.\d{1,3}){3}$)/i, "");
	if (!address) return "unknown";
	const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(address);
	if (
		ipv4?.slice(1).every((octet) => Number(octet) >= 0 && Number(octet) <= 255)
	) {
		return `v4:${ipv4[1]}.${ipv4[2]}.${ipv4[3]}`;
	}
	const ipv6 = address.toLowerCase().split("%", 1)[0];
	if (!ipv6?.includes(":")) return "unknown";
	const halves = ipv6.split("::");
	if (halves.length > 2) return "unknown";
	const head = halves[0]?.split(":").filter(Boolean) ?? [];
	const tail = halves[1]?.split(":").filter(Boolean) ?? [];
	const missing = halves.length === 2 ? 8 - head.length - tail.length : 0;
	const groups = [...head, ...Array(Math.max(0, missing)).fill("0"), ...tail];
	if (
		groups.length !== 8 ||
		groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))
	) {
		return "unknown";
	}
	return `v6:${groups
		.slice(0, 4)
		.map((group) => Number.parseInt(group, 16).toString(16))
		.join(":")}`;
}

/**
 * The peer address of the TCP connection, mirroring @hono/node-server's
 * getConnInfo without importing it — that helper throws when a test drives the
 * app through `app.request()`, where there is no incoming socket at all.
 */
function socketAddress(c: Context): string | undefined {
	const env = c.env as
		| { server?: unknown; incoming?: { socket?: { remoteAddress?: unknown } } }
		| undefined;
	if (!env) return undefined;
	const bindings = (env.server ?? env) as {
		incoming?: { socket?: { remoteAddress?: unknown } };
	};
	const address = bindings.incoming?.socket?.remoteAddress;
	return typeof address === "string" ? address : undefined;
}

/**
 * Forwarded-for headers are client-supplied and trivially spoofed, so they are
 * only consulted when the deployment guarantees a proxy overwrites them.
 * Untrusted, the connection's own peer address is the only honest identifier —
 * and it is still coarsened to a /24 or /64 before anything is counted.
 */
function clientAddress(
	c: Context,
	trustProxyHeaders: boolean,
): string | undefined {
	if (!trustProxyHeaders) return socketAddress(c);
	return (
		c.req.header("cf-connecting-ip") ??
		c.req.header("x-forwarded-for") ??
		socketAddress(c)
	);
}

type FoodRoutesOptions = {
	provider: FoodProvider;
	rateLimiter?: InMemoryFoodRateLimiter;
	observe?: FoodRouteObserver;
	now?: () => number;
	trustProxyHeaders?: boolean;
};

export function createFoodRoutes({
	provider,
	rateLimiter = new InMemoryFoodRateLimiter(),
	observe = () => undefined,
	now = Date.now,
	trustProxyHeaders = false,
}: FoodRoutesOptions) {
	const app = new Hono();

	app.use("/api/food/*", async (c, next) => {
		c.header("Cache-Control", "no-store");
		const rate = rateLimiter.consume(
			coarseBucketOf(clientAddress(c, trustProxyHeaders)),
		);
		if (!rate.allowed) {
			observe("food_lookup_rate_limited", {});
			c.header("Retry-After", String(rate.retryAfterSeconds));
			return c.json(
				{ error: "Too many food lookups. Try again shortly." },
				429,
			);
		}
		return await next();
	});

	app.get("/api/food/search", async (c) => {
		const query = c.req.query("q")?.trim() ?? "";
		if (query.length < 2 || query.length > 120) {
			return c.json({ error: "Enter between 2 and 120 characters." }, 400);
		}
		const startedAt = now();
		try {
			const results = await provider.search(query);
			observe("food_lookup_hit", {
				durationMs: now() - startedAt,
				resultCount: results.length,
			});
			return c.json({ results } satisfies ExternalConsumableResponse);
		} catch (error) {
			observe("food_lookup_upstream_error", { durationMs: now() - startedAt });
			return c.json(
				{ error: "Food search is temporarily unavailable." },
				error instanceof FoodProviderUnavailableError &&
					error.reason === "timeout"
					? 504
					: 502,
			);
		}
	});

	/**
	 * One product by ref or by barcode. A lookup, not a scan: the camera is a
	 * later native batch, and when it lands it calls this route.
	 */
	async function lookup(
		c: Context,
		find: () => Promise<Awaited<ReturnType<FoodProvider["findByRef"]>>>,
	) {
		const startedAt = now();
		try {
			const result = await find();
			observe(result ? "food_lookup_hit" : "food_lookup_miss", {
				durationMs: now() - startedAt,
				resultCount: result ? 1 : 0,
			});
			return result
				? c.json(result)
				: c.json({ error: "Food not found." }, 404);
		} catch (error) {
			observe("food_lookup_upstream_error", { durationMs: now() - startedAt });
			return c.json(
				{ error: "Food lookup is temporarily unavailable." },
				error instanceof FoodProviderUnavailableError &&
					error.reason === "timeout"
					? 504
					: 502,
			);
		}
	}

	app.get("/api/food/barcode/:code", async (c) => {
		const code = c.req.param("code");
		if (!/^\d{8,14}$/.test(code)) {
			return c.json({ error: "Enter a barcode of 8 to 14 digits." }, 400);
		}
		return await lookup(c, () => provider.findByBarcode(code));
	});

	app.get("/api/food/:ref", async (c) => {
		const ref = c.req.param("ref");
		if (!/^off:\d+$/.test(ref))
			return c.json({ error: "Food not found." }, 404);
		return await lookup(c, () => provider.findByRef(ref));
	});

	return app;
}
