import type { Auth } from "@bro/auth-api";
import { Hono } from "hono";

/**
 * Better Auth owns every route under /api/auth/* and works directly off the
 * standard Request, so the whole subtree is handed to its handler.
 */
export function createAuthRoutes(auth: Pick<Auth, "handler">) {
	return new Hono().on(["POST", "GET"], "/api/auth/*", (c) =>
		auth.handler(c.req.raw),
	);
}
