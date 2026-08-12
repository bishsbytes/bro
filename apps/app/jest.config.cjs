module.exports = {
	displayName: "@bro/app",
	preset: "jest-expo",
	setupFilesAfterEnv: ["<rootDir>/src/test-setup.ts"],
	testMatch: ["<rootDir>/src/**/*.test.ts", "<rootDir>/src/**/*.test.tsx"],
	moduleNameMapper: {
		"^react$": "<rootDir>/node_modules/react",
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
