import { type Auth, createAuth } from "@bro/auth-api";
import { type ApiDb, createApiDb } from "@bro/database-api";

function required(name: string): string {
	const value = process.env[name];

	if (!value) {
		throw new Error(
			`${name} must be set. Copy .env.example to .env and fill it in.`,
		);
	}

	return value;
}

export const env = {
	databaseUrl: required("DATABASE_URL"),
	betterAuthSecret: required("BETTER_AUTH_SECRET"),
	betterAuthUrl: required("BETTER_AUTH_URL"),
	corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:8081",
	port: Number(process.env.PORT ?? 3000),
} as const;

// Annotated rather than inferred: declaration emit can't name the deep
// generated types across the package boundary (TS2883).
export const db: ApiDb = createApiDb(env.databaseUrl);

export const auth: Auth = createAuth({
	db,
	secret: env.betterAuthSecret,
	baseURL: env.betterAuthUrl,
});
