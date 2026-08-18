import nx from "@nx/eslint-plugin";
import tseslint from "typescript-eslint";

export default [
	...nx.configs["flat/base"],
	{
		ignores: ["**/dist/**", "**/node_modules/**", "**/.expo/**"],
	},
	{
		files: ["**/*.{ts,tsx,cts,mts,js,jsx,cjs,mjs}"],
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				ecmaFeatures: { jsx: true },
				sourceType: "module",
			},
		},
		rules: {
			"@nx/enforce-module-boundaries": [
				"error",
				{
					enforceBuildableLibDependency: true,
					allow: [],
					depConstraints: [
						{
							sourceTag: "scope:app",
							onlyDependOnLibsWithTags: ["scope:app", "scope:shared"],
						},
						{
							sourceTag: "scope:api",
							onlyDependOnLibsWithTags: ["scope:api", "scope:shared"],
						},
						{
							sourceTag: "scope:shared",
							onlyDependOnLibsWithTags: ["scope:shared"],
						},
					],
				},
			],
		},
	},
];
