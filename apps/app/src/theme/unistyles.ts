import { StyleSheet, useUnistyles } from "react-native-unistyles";

// Import themed APIs from this module rather than directly from Unistyles. Expo
// Router can evaluate route modules before the root layout, so this module must
// finish configuring the theme before a route creates a themed stylesheet.
export { StyleSheet, useUnistyles };

/**
 * The product's visual system. The palette deliberately stays neutral: hierarchy
 * comes from type, spacing, and the contrast between the canvas and raised white
 * surfaces rather than from decorative colour.
 *
 * Every colour in the app comes from here — a hardcoded hex in a screen is a bug,
 * because it cannot follow the device's colour scheme.
 */
const shared = {
	spacing: {
		xs: 4,
		sm: 8,
		md: 12,
		lg: 16,
		xl: 24,
		xxl: 32,
		xxxl: 48,
	},
	radius: {
		xs: 8,
		sm: 12,
		md: 18,
		lg: 24,
		pill: 999,
	},
	typography: {
		display: {
			fontSize: 34,
			lineHeight: 41,
			fontWeight: "700",
			letterSpacing: -0.8,
		},
		title: {
			fontSize: 28,
			lineHeight: 34,
			fontWeight: "700",
			letterSpacing: -0.4,
		},
		section: {
			fontSize: 22,
			lineHeight: 28,
			fontWeight: "700",
			letterSpacing: -0.2,
		},
		score: { fontSize: 20, lineHeight: 25, fontWeight: "600" },
		body: { fontSize: 17, lineHeight: 25 },
		label: { fontSize: 16, lineHeight: 22 },
		caption: { fontSize: 14, lineHeight: 20 },
		micro: { fontSize: 12, lineHeight: 16 },
		face: { fontSize: 22, lineHeight: 28 },
		eyebrow: { letterSpacing: 1.1 },
	},
	control: {
		buttonMinHeight: 52,
		scoreMinHeight: 64,
		noteMinHeight: 112,
		avatarSize: 36,
		avatarIconSize: 20,
	},
	opacity: {
		disabled: 0.45,
	},
} as const;

export const lightTheme = {
	...shared,
	colors: {
		background: "#f3f2f0",
		text: "#1b1d1a",
		textMuted: "#686b67",
		textSubtle: "#94928f",
		border: "#dfdedb",
		surface: "#ffffff",
		selected: "#e9e8e5",
		onSelected: "#1b1d1a",
		brand: "#1b1d1a",
		onBrand: "#ffffff",
		danger: "#b42318",
		onDanger: "#fff8f7",
		headerBackground: "#f3f2f0",
		headerBorder: "#e5e3e0",
		tabBackground: "#ffffff",
		tabInactive: "#9a9c99",
		tabIndicator: "#eeedea",
	},
} as const;

export const darkTheme = {
	...shared,
	colors: {
		background: "#141512",
		text: "#f2f2ee",
		textMuted: "#b8bab5",
		textSubtle: "#8f918c",
		border: "#383a36",
		surface: "#20211e",
		selected: "#343630",
		onSelected: "#f5f5f0",
		brand: "#efefe9",
		onBrand: "#181916",
		danger: "#ff8a80",
		onDanger: "#25110f",
		headerBackground: "#151613",
		headerBorder: "#32332f",
		tabBackground: "#1e1f1c",
		tabInactive: "#90928d",
		tabIndicator: "#30322d",
	},
} as const;

/** Keeps native stack headers in the same visual system as app-owned headers. */
export function stackScreenOptions(
	theme: typeof lightTheme | typeof darkTheme,
) {
	return {
		headerStyle: { backgroundColor: theme.colors.headerBackground },
		headerTintColor: theme.colors.text,
		headerShadowVisible: false,
		headerTitleStyle: { fontWeight: "700" as const },
		contentStyle: { backgroundColor: theme.colors.background },
	};
}

type AppThemes = {
	light: typeof lightTheme;
	dark: typeof darkTheme;
};

declare module "react-native-unistyles" {
	export interface UnistylesThemes extends AppThemes {}
}

StyleSheet.configure({
	themes: { light: lightTheme, dark: darkTheme },
	settings: {
		// Follows the OS, which is what app.json's `userInterfaceStyle: automatic`
		// has been promising all along.
		adaptiveThemes: true,
	},
});
