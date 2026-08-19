import { defineConfig } from "vitest/config";

/** Catalogues, units, and calendar rules: pure data and arithmetic, no runtime. */
export default defineConfig({
	test: {
		include: ["src/**/*.test.ts"],
		globals: true,
	},
});
