module.exports = {
	displayName: "@bro/app",
	preset: "jest-expo",
	setupFilesAfterEnv: ["<rootDir>/src/test-setup.ts"],
	testMatch: ["<rootDir>/src/**/*.test.ts", "<rootDir>/src/**/*.test.tsx"],
	moduleNameMapper: {
		"^react$": "<rootDir>/node_modules/react",
		// pnpm can resolve the same expo-sqlite version to different store paths
		// for this app and for @bro/database-app. When that happens a
		// `jest.mock("expo-sqlite")` here never reaches the database package,
		// which then loads the real module and fails deep inside Expo's dev-server
		// plumbing. Pinning both entry points keeps one instance under test.
		// `pnpm dedupe` is the fix if the app bundle ever splits the same way.
		"^expo-sqlite$": "<rootDir>/node_modules/expo-sqlite",
		"^expo-sqlite/kv-store$": "<rootDir>/node_modules/expo-sqlite/kv-store",
	},
	transformIgnorePatterns: [
		"/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|@better-auth|better-auth|@better-fetch|better-call|@noble|jose|nanostores|rou3|zod))",
		"/node_modules/react-native-reanimated/plugin/",
		"/node_modules/@react-native/babel-preset/",
	],
	transform: {
		"^.+\\.mjs$": [
			"babel-jest",
			{ plugins: ["@babel/plugin-transform-modules-commonjs"] },
		],
	},
	coverageDirectory: "test-output/jest/coverage",
};
