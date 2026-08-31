import { defineConfig } from "drizzle-kit";

/**
 * Schema authoring and migration codegen. Runtime migrations use Drizzle's async
 * SQLite dialect over Expo; application queries remain in raw-SQL repositories.
 */
export default defineConfig({
	dialect: "sqlite",
	driver: "expo",
	schema: "./src/schema.ts",
	out: "./drizzle",
});
