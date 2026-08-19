import { defineConfig } from "vitest/config";

/**
 * Every module here is pure computation over already-loaded records, so the
 * suite needs no React Native or expo runtime and runs under plain vitest.
 *
 * Globals are on because these specs moved over from the app's jest suite and
 * read the same either way; keeping them means a spec can move back without
 * being rewritten.
 */
export default defineConfig({
	test: {
		include: ["src/**/*.test.ts"],
		globals: true,
	},
});
