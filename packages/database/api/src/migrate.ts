import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createApiDb } from "./client.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error("DATABASE_URL must be set to run migrations.");
}

const migrationsFolder = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../drizzle",
);

await migrate(createApiDb(connectionString), { migrationsFolder });

console.log(`Applied migrations from ${migrationsFolder}`);
process.exit(0);
