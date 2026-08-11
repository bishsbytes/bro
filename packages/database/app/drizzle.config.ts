import { defineConfig } from "drizzle-kit";

/**
 * Schema authoring and migration codegen only. Nothing in this package uses the
 * Drizzle client at runtime — queries go through the raw-SQL repositories in
 * src/repositories.
 */
export default defineConfig({
	dialect: "sqlite",
	driver: "expo",
	schema: "./src/schema.ts",
	out: "./drizzle",
});
