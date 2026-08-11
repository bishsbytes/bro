import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { authOptions, defaultTrustedOrigins } from "./src/options.js";

/**
 * Schema-generation entry point for `@better-auth/cli generate` only — never
 * imported at runtime. The CLI reads plugins and options to derive the Drizzle
 * schema and never opens a connection, so the adapter gets a stub database.
 */
export const auth = betterAuth({
	...authOptions,
	database: drizzleAdapter({}, { provider: "pg" }),
	secret: "schema-generation-only",
	baseURL: "http://localhost:3000",
	trustedOrigins: defaultTrustedOrigins,
});
