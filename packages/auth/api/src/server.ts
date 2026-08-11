import { type ApiDb, schema } from "@bro/database-api";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { authOptions, defaultTrustedOrigins } from "./options.js";

export type CreateAuthOptions = {
	db: ApiDb;
	secret: string;
	baseURL: string;
	/** Defaults to the app scheme plus an Expo Go wildcard. */
	trustedOrigins?: string[];
};

export type Auth = ReturnType<typeof createAuth>;

/**
 * Builds the Better Auth instance. The database and secrets are injected by the
 * caller (apps/api) so this package never touches process.env.
 */
export function createAuth({
	db,
	secret,
	baseURL,
	trustedOrigins,
}: CreateAuthOptions) {
	return betterAuth({
		...authOptions,
		database: drizzleAdapter(db, { provider: "pg", schema }),
		secret,
		baseURL,
		trustedOrigins: trustedOrigins ?? defaultTrustedOrigins,
	});
}
