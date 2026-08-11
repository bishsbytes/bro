import { Hono } from "hono";
import { auth } from "../env.js";

/**
 * Better Auth owns every route under /api/auth/* and works directly off the
 * standard Request, so the whole subtree is handed to its handler.
 */
export const authRoutes = new Hono().on(["POST", "GET"], "/api/auth/*", (c) =>
	auth.handler(c.req.raw),
);
