import type { Auth } from "@bro/auth-api";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createAuthRoutes } from "./routes/auth.js";
import { health } from "./routes/health.js";

export type CreateAppOptions = {
	auth: Pick<Auth, "handler">;
	corsOrigin: string;
};

/**
 * Builds the Hono app. Exported separately from the server entry point so tests
 * can drive it via `app.request(...)` without binding a port.
 */
export function createApp({ auth, corsOrigin }: CreateAppOptions) {
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

	app.route("/", health);
	app.route("/", createAuthRoutes(auth));

	return app;
}

export type App = ReturnType<typeof createApp>;
