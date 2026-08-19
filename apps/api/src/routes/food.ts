import type { FoodSearchResponse } from "@bro/domain/food-search";
import { Hono } from "hono";
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
	) {}

	consume(bucket: string): { allowed: boolean; retryAfterSeconds: number } {
		const now = this.now();
		let bucketKey = bucket;
		let current = this.buckets.get(bucketKey);
		if (!current && this.buckets.size >= 999) {
			for (const [key, value] of this.buckets) {
				if (value.resetsAt <= now) this.buckets.delete(key);
			}
			if (this.buckets.size >= 999) bucketKey = "overflow";
			current = this.buckets.get(bucketKey);
		}
		if (!current || current.resetsAt <= now) {
			current = { count: 0, resetsAt: now + this.windowMs };
			this.buckets.set(bucketKey, current);
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
}

function coarseIpBucket(value: string | undefined): string {
	const address = value?.split(",", 1)[0]?.trim();
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

type FoodRoutesOptions = {
	provider: FoodProvider;
	rateLimiter?: InMemoryFoodRateLimiter;
	observe?: FoodRouteObserver;
	now?: () => number;
};

export function createFoodRoutes({
	provider,
	rateLimiter = new InMemoryFoodRateLimiter(),
	observe = () => undefined,
	now = Date.now,
}: FoodRoutesOptions) {
	const app = new Hono();

	app.use("/api/food/*", async (c, next) => {
		c.header("Cache-Control", "no-store");
		const rate = rateLimiter.consume(
			coarseIpBucket(
				c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for"),
			),
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
			return c.json({ results } satisfies FoodSearchResponse);
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

	app.get("/api/food/:ref", async (c) => {
		const ref = c.req.param("ref");
		if (!/^off:\d+$/.test(ref))
			return c.json({ error: "Food not found." }, 404);
		const startedAt = now();
		try {
			const result = await provider.findByRef(ref);
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
	});

	return app;
}
