import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./env.js";
import { authRoutes } from "./routes/auth.js";
import { health } from "./routes/health.js";

/**
 * Builds the Hono app. Exported separately from the server entry point so tests
 * can drive it via `app.request(...)` without binding a port.
 */
export function createApp() {
	const app = new Hono();

	app.use(
		"/api/auth/*",
		cors({
			origin: env.corsOrigin,
			allowHeaders: ["Content-Type", "Authorization"],
			allowMethods: ["GET", "POST", "OPTIONS"],
			credentials: true,
		}),
	);

	app.route("/", health);
	app.route("/", authRoutes);

	return app;
}

export type App = ReturnType<typeof createApp>;
