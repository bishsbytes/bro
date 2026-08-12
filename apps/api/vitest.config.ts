import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["src/**/*.test.ts"],
		// The suite owns a PostgreSQL container: starting it is a setup cost, not
		// a test that is allowed to take this long, so the hook timeout carries it
		// and each test keeps a tight budget of its own.
		testTimeout: 15_000,
		hookTimeout: 120_000,
	},
});
