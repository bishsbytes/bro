module.exports = {
	displayName: "@bro/database-app",
	preset: "jest-expo",
	setupFilesAfterEnv: ["<rootDir>/src/test-setup.ts"],
	moduleNameMapper: {
		"^expo-sqlite$": "<rootDir>/node_modules/expo-sqlite",
		"^expo-sqlite/kv-store$": "<rootDir>/node_modules/expo-sqlite/kv-store",
	},
	coverageDirectory: "test-output/jest/coverage",
};
