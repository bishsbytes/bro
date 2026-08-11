import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

export type ApiDb = ReturnType<typeof createApiDb>;

/**
 * Builds the Drizzle client for the API's Postgres database. Callers own the
 * connection string so this package never reads the environment itself.
 */
export function createApiDb(
	connectionString: string,
): ReturnType<typeof drizzle<typeof schema>> {
	const client = postgres(connectionString);
	return drizzle(client, { schema });
}
