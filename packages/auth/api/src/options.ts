import { expo } from "@better-auth/expo";
import type { BetterAuthOptions } from "better-auth";

/** Matches `scheme` in apps/app/app.json — the deep link target for auth redirects. */
export const APP_SCHEME = "app";

/**
 * Every option that influences the generated database schema lives here so the
 * runtime instance (server.ts) and the schema-generation entry point
 * (better-auth.config.ts) can never drift apart.
 */
export const authOptions = {
	emailAndPassword: { enabled: true },
	// External account-owned resources must be removed through a beforeDelete
	// hook before they ship. Phase 2 owns only the Better Auth rows, whose
	// foreign keys cascade from the user record.
	user: { deleteUser: { enabled: true } },
	plugins: [expo()],
} satisfies Partial<BetterAuthOptions>;

/** `exp://*` covers Expo Go, whose host/port vary per machine and session. */
export const defaultTrustedOrigins = [`${APP_SCHEME}://`, "exp://*"];
