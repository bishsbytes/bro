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
		// All user-facing JSX text and copy-bearing props in the app have to come
		// from a catalogue in `apps/app/src/i18n`. Keeping this app-wide ensures a
		// newly added route, provider, or feature directory is protected by default.
		files: ["apps/app/src/**/*.tsx"],
		ignores: ["**/*.test.tsx"],
		plugins: { i18next },
		rules: {
			"i18next/no-literal-string": [
				"error",
				{
					mode: "jsx-only",
					"jsx-attributes": {
						include: [
							"accessibilityHint",
							"accessibilityLabel",
							"actionLabel",
							"body",
							"cancelText",
							"confirmText",
							"description",
							"detail",
							"eyebrow",
							"headerTitle",
							"label",
							"message",
							"placeholder",
							"title",
						],
					},
					"object-properties": {
						exclude: ["[A-Z_-]+", "hour", "minute"],
					},
					"should-validate-template": true,
					message:
						"Move this copy into apps/app/src/i18n/locales/en and read it with useTranslation().",
				},
			],
		},
	},
	{
		// App services and stores may still own presentation models. Guard the
		// known copy-bearing fields app-wide without treating invariant diagnostics,
		// slugs, SQL, or the catalogues themselves as copy violations.
		files: ["apps/app/src/**/*.{ts,tsx}"],
		ignores: ["**/*.test.{ts,tsx}", "apps/app/src/i18n/**"],
		rules: {
			"no-restricted-syntax": [
				"error",
				{
					selector:
						"Property[key.name=/^(action|dayTitle|detail|progressLabel)$/]:not(:has(CallExpression)) Literal[value=/./]",
					message:
						"Move presentation copy into apps/app/src/i18n/locales/en and resolve it before returning the model.",
				},
				{
					selector:
						"Property[key.name=/^(action|dayTitle|detail|progressLabel)$/]:not(:has(CallExpression)) TemplateLiteral",
					message:
						"Move presentation copy into apps/app/src/i18n/locales/en and resolve it before returning the model.",
				},
			],
		},
	},
];
