import type { Auth } from "@bro/auth-api";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
	type FoodProvider,
	OpenFoodFactsProvider,
} from "./food/open-food-facts.js";
import { createAuthRoutes } from "./routes/auth.js";
import {
	createFoodRoutes,
	type FoodRouteObserver,
	type InMemoryFoodRateLimiter,
} from "./routes/food.js";
import { health } from "./routes/health.js";

export type CreateAppOptions = {
	auth: Pick<Auth, "handler">;
	corsOrigin: string;
	foodProvider?: FoodProvider;
	foodRateLimiter?: InMemoryFoodRateLimiter;
	observeFoodRoute?: FoodRouteObserver;
};

/**
 * Builds the Hono app. Exported separately from the server entry point so tests
 * can drive it via `app.request(...)` without binding a port.
 */
export function createApp({
	auth,
	corsOrigin,
	foodProvider = new OpenFoodFactsProvider({
		userAgent:
			process.env.OPEN_FOOD_FACTS_USER_AGENT ??
			"bro/0.1 (https://github.com/bishsbytes/bro)",
	}),
	foodRateLimiter,
	observeFoodRoute,
}: CreateAppOptions) {
	const app = new Hono();

	app.use(
		"/api/auth/*",
		cors({
			origin: corsOrigin,
			allowHeaders: ["Content-Type", "Authorization"],
			allowMethods: ["GET", "POST", "OPTIONS"],
			credentials: true,
		}),
	);
	app.use(
		"/api/food/*",
		cors({
			origin: corsOrigin,
			allowHeaders: ["Content-Type"],
			allowMethods: ["GET", "OPTIONS"],
			credentials: false,
		}),
	);

	app.route("/", health);
	app.route(
		"/",
		createFoodRoutes({
			provider: foodProvider,
			rateLimiter: foodRateLimiter,
			observe: observeFoodRoute,
		}),
	);
	app.route("/", createAuthRoutes(auth));

	return app;
}

export type App = ReturnType<typeof createApp>;
