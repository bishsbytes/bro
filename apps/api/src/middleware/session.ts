import type { Auth } from "@bro/auth-api";
import { createMiddleware } from "hono/factory";
import { auth } from "../env.js";

type SessionResult = Awaited<ReturnType<Auth["api"]["getSession"]>>;

export type SessionVariables = {
	session: NonNullable<SessionResult>["session"] | null;
	user: NonNullable<SessionResult>["user"] | null;
};

/**
 * Resolves the caller's session onto the context. Does not reject anonymous
 * requests — route handlers decide what requires a user.
 */
export const withSession = createMiddleware<{ Variables: SessionVariables }>(
	async (c, next) => {
		const result = await auth.api.getSession({ headers: c.req.raw.headers });

		c.set("session", result?.session ?? null);
		c.set("user", result?.user ?? null);

		await next();
	},
);
