import { defineConfig } from "drizzle-kit";

/**
 * Schema authoring and migration codegen. Runtime migrations use Drizzle's Expo
 * adapter; application queries still go through the raw-SQL repositories.
 */
export default defineConfig({
	dialect: "sqlite",
	driver: "expo",
	schema: "./src/schema.ts",
	out: "./drizzle",
});
