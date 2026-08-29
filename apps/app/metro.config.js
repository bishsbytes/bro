const { withNxMetro } = require("@nx/expo");
const { dirname } = require("node:path");
// Expo SDK 55+ ships Metro via `@expo/metro`. `getDefaultConfig` and
// `mergeConfig` must come from the Expo-provided Metro instance.
const { getDefaultConfig } = require("expo/metro-config");
const { mergeConfig } = require("@expo/metro/metro-config");
const expoSqliteRoot = dirname(require.resolve("expo-sqlite/package.json"));

const defaultConfig = getDefaultConfig(__dirname);
const { assetExts, sourceExts } = defaultConfig.resolver;

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const customConfig = {
	cacheVersion: "app-babel-config-v1",
	server: {
		enhanceMiddleware: (metroMiddleware) => (request, response, next) => {
			// Match the Expo Router document policy configured in app.json so
			// SQLite's worker and Metro assets are cross-origin isolated too.
			response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
			response.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
			return metroMiddleware(request, response, next);
		},
	},
	transformer: {
		// Preserve Expo's Babel pipeline when adding SVG support, and pin the app's
		// config so Metro does not silently fall back to the preset-only default.
		babelTransformerPath: require.resolve("react-native-svg-transformer/expo"),
		enableBabelRCLookup: true,
		extendsBabelConfigPath: require.resolve("./babel.config.js"),
	},
	resolver: {
		assetExts: [...assetExts.filter((ext) => ext !== "svg"), "wasm"],
		sourceExts: [...sourceExts, "cjs", "mjs", "svg"],
	},
};

module.exports = withNxMetro(mergeConfig(defaultConfig, customConfig), {
	// Change this to true to see debugging info.
	// Useful if you have issues resolving modules
	debug: false,
	// all the file extensions used for imports other than 'ts', 'tsx', 'js', 'jsx', 'json'
	extensions: [],
	// Specify folders to watch, in addition to Nx defaults (workspace libraries and node_modules)
	// Metro resolves Expo SQLite's web WASM through pnpm's real package path.
	watchFolders: [expoSqliteRoot],
});
