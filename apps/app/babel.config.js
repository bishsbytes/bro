module.exports = (api) => {
	api.cache(true);

	return {
		presets: ["babel-preset-expo"],
		plugins: [
			// Rewrites StyleSheet.create/useUnistyles call sites so theme changes
			// update styles natively instead of re-rendering the React tree.
			["react-native-unistyles/plugin", { root: "src" }],
		],
	};
};
