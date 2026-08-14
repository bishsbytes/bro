import { StyleSheet } from "react-native-unistyles";

/**
 * Design tokens. Every colour in the app comes from here — a hardcoded hex in a
 * screen is a bug, because it cannot follow the device's colour scheme.
 */
const shared = {
	spacing: {
		xs: 4,
		sm: 8,
		md: 12,
		lg: 16,
		xl: 24,
		xxl: 28,
	},
	radius: {
		sm: 8,
		md: 10,
	},
	typography: {
		display: { fontSize: 36, lineHeight: 42, fontWeight: "700" },
		title: { fontSize: 32, fontWeight: "600" },
		section: { fontSize: 22, lineHeight: 28, fontWeight: "600" },
		score: { fontSize: 20, lineHeight: 24, fontWeight: "600" },
		body: { fontSize: 17, lineHeight: 26 },
		label: { fontSize: 16, lineHeight: 23 },
		caption: { fontSize: 14, lineHeight: 21 },
		micro: { fontSize: 12, lineHeight: 16 },
		face: { fontSize: 22, lineHeight: 28 },
		eyebrow: { letterSpacing: 1.2 },
	},
	control: {
		scoreMinHeight: 58,
		noteMinHeight: 90,
	},
	opacity: {
		disabled: 0.45,
	},
} as const;

export const lightTheme = {
	...shared,
	colors: {
		background: "#ffffff",
		text: "#111827",
		textMuted: "#4b5563",
		textSubtle: "#6b7280",
		border: "#d1d5db",
		surface: "#f3f4f6",
		selected: "#dbeafe",
		onSelected: "#143055",
		brand: "#143055",
		onBrand: "#ffffff",
		danger: "#b91c1c",
		onDanger: "#ffffff",
	},
} as const;

export const darkTheme = {
	...shared,
	colors: {
		background: "#0d1117",
		text: "#f3f4f6",
		textMuted: "#b6bec9",
		textSubtle: "#9aa4b2",
		border: "#2b3440",
		surface: "#161b22",
		selected: "#264b73",
		onSelected: "#f3f4f6",
		// The light brand is unreadable on a dark ground, so it lightens rather
		// than carrying the same hex across both themes.
		brand: "#8fb3dd",
		onBrand: "#0d1117",
		// The light danger red is unreadable on a dark ground, so it lightens —
		// which flips what can legibly sit on top of it.
		danger: "#f87171",
		onDanger: "#0d1117",
	},
} as const;

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
