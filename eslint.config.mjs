import nx from "@nx/eslint-plugin";
import i18next from "eslint-plugin-i18next";
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
	{
		// User-facing copy in these paths has to come from a catalogue in
		// `apps/app/src/i18n`. The list is a ratchet rather than a blanket rule:
		// add each feature's directory as it is migrated, so the rule stays an
		// error everywhere it applies instead of a warning nobody reads.
		files: [
			"apps/app/src/app/**/*.tsx",
			"apps/app/src/components/**/*.tsx",
			"apps/app/src/screens/auth/**/*.tsx",
			"apps/app/src/screens/body/**/*.tsx",
			"apps/app/src/screens/challenges/**/*.tsx",
			"apps/app/src/screens/check-in/**/*.tsx",
			"apps/app/src/screens/drinks/**/*.tsx",
			"apps/app/src/screens/food/**/*.tsx",
			"apps/app/src/screens/habits/**/*.tsx",
			"apps/app/src/screens/history/**/*.tsx",
			"apps/app/src/screens/home/**/*.tsx",
			"apps/app/src/screens/insights/**/*.tsx",
			"apps/app/src/screens/life/**/*.tsx",
			"apps/app/src/screens/log/**/*.tsx",
			"apps/app/src/screens/privacy/**/*.tsx",
			"apps/app/src/screens/review/**/*.tsx",
			"apps/app/src/screens/settings/**/*.tsx",
		],
		ignores: ["**/*.test.tsx"],
		plugins: { i18next },
		rules: {
			"i18next/no-literal-string": [
				"error",
				{
					mode: "jsx-text-only",
					"should-validate-template": true,
					message:
						"Move this copy into apps/app/src/i18n/locales/en and read it with useTranslation().",
				},
			],
		},
	},
];
