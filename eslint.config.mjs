import nx from "@nx/eslint-plugin";
import tseslint from "typescript-eslint";

export default [
	...nx.configs["flat/base"],
	{
		ignores: [
			"**/dist/**",
			"**/out-tsc/**",
			"**/node_modules/**",
			"**/.expo/**",
			"**/vitest.config.*.timestamp*",
		],
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
						{
							sourceTag: "layer:domain",
							onlyDependOnLibsWithTags: ["layer:domain"],
						},
						{
							sourceTag: "layer:model",
							onlyDependOnLibsWithTags: ["layer:domain"],
						},
						{
							sourceTag: "layer:data-access",
							onlyDependOnLibsWithTags: ["layer:domain", "layer:model"],
						},
						{
							sourceTag: "layer:application",
							onlyDependOnLibsWithTags: ["layer:domain", "layer:model"],
						},
						{
							sourceTag: "layer:integration",
							onlyDependOnLibsWithTags: [
								"layer:domain",
								"layer:model",
								"layer:data-access",
							],
						},
						{
							sourceTag: "layer:app",
							onlyDependOnLibsWithTags: [
								"layer:domain",
								"layer:model",
								"layer:data-access",
								"layer:application",
								"layer:integration",
							],
						},
					],
				},
			],
		},
	},
];
