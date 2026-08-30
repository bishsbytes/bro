import type { AccentColor, ThemeMode } from "@bro/database-app";
import {
	StyleSheet,
	UnistylesRuntime,
	useUnistyles,
} from "react-native-unistyles";

// Import themed APIs from this module rather than directly from Unistyles. Expo
// Router can evaluate route modules before the root layout, so this module must
// finish configuring the theme before a route creates a themed stylesheet.
export { StyleSheet, useUnistyles };

/** `labelKey` is a key in the `settings` catalogue, not copy. */
export const ACCENT_OPTIONS = [
	{ value: "neutral", labelKey: "appearance.accentNeutral" },
	{ value: "emerald", labelKey: "appearance.accentEmerald" },
	{ value: "sky", labelKey: "appearance.accentSky" },
	{ value: "rose", labelKey: "appearance.accentRose" },
	{ value: "amber", labelKey: "appearance.accentAmber" },
	{ value: "amethyst", labelKey: "appearance.accentAmethyst" },
] as const satisfies readonly { value: AccentColor; labelKey: string }[];

/**
 * The product's visual system. Most of the palette deliberately stays neutral:
 * an accent adds identity to actions, selections, charts, and navigation without
 * washing the calm canvas or raised surfaces in decorative colour.
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
		/** Life-area icons, sized to match the ones ringing the wheel. */
		focusIconSize: 20,
		/** The same icons standing alone above an area's name, not beside it. */
		areaPromptIconSize: 32,
	},
	opacity: {
		disabled: 0.45,
	},
} as const;

const schemeColors = {
	light: {
		background: "#f3f2f0",
		text: "#1b1d1a",
		textMuted: "#686b67",
		textSubtle: "#94928f",
		border: "#dfdedb",
		scrim: "#0000008c",
		surface: "#ffffff",
		danger: "#b42318",
		onDanger: "#fff8f7",
		headerBackground: "#f3f2f0",
		headerBorder: "#e5e3e0",
		tabBackground: "#ffffff",
		tabInactive: "#9a9c99",
		tabIndicator: "#eeedea",
	},
	dark: {
		background: "#141512",
		text: "#f2f2ee",
		textMuted: "#b8bab5",
		textSubtle: "#8f918c",
		border: "#383a36",
		scrim: "#00000073",
		surface: "#20211e",
		danger: "#ff8a80",
		onDanger: "#25110f",
		headerBackground: "#151613",
		headerBorder: "#32332f",
		tabBackground: "#1e1f1c",
		tabInactive: "#90928d",
		tabIndicator: "#30322d",
	},
} as const;

const accents = {
	neutral: {
		light: {
			brand: "#1b1d1a",
			onBrand: "#ffffff",
			selected: "#e9e8e5",
			onSelected: "#1b1d1a",
		},
		dark: {
			brand: "#efefe9",
			onBrand: "#181916",
			selected: "#343630",
			onSelected: "#f5f5f0",
		},
	},
	emerald: {
		light: {
			brand: "#167553",
			onBrand: "#ffffff",
			selected: "#dceee7",
			onSelected: "#123d30",
		},
		dark: {
			brand: "#72d6ad",
			onBrand: "#10271e",
			selected: "#244b3b",
			onSelected: "#dff8ed",
		},
	},
	sky: {
		light: {
			brand: "#316db1",
			onBrand: "#ffffff",
			selected: "#dfeaf7",
			onSelected: "#183754",
		},
		dark: {
			brand: "#83b9f2",
			onBrand: "#10253b",
			selected: "#29435f",
			onSelected: "#e4f1ff",
		},
	},
	rose: {
		light: {
			brand: "#ad3d62",
			onBrand: "#ffffff",
			selected: "#f4e0e7",
			onSelected: "#572236",
		},
		dark: {
			brand: "#ee91ad",
			onBrand: "#35131e",
			selected: "#583141",
			onSelected: "#ffe7ee",
		},
	},
	amber: {
		light: {
			brand: "#7b5707",
			onBrand: "#ffffff",
			selected: "#f2e7ca",
			onSelected: "#3e2d08",
		},
		dark: {
			brand: "#e6bd68",
			onBrand: "#2d220c",
			selected: "#4d3e20",
			onSelected: "#f9edcf",
		},
	},
	amethyst: {
		light: {
			brand: "#74519d",
			onBrand: "#ffffff",
			selected: "#ebe2f2",
			onSelected: "#3d2854",
		},
		dark: {
			brand: "#c4a0e6",
			onBrand: "#2b173d",
			selected: "#49365a",
			onSelected: "#f3e7ff",
		},
	},
} as const satisfies Record<
	AccentColor,
	Record<"light" | "dark", Record<string, string>>
>;

export function createTheme(
	scheme: "light" | "dark",
	accentColor: AccentColor,
) {
	return {
		...shared,
		colors: {
			...schemeColors[scheme],
			...accents[accentColor][scheme],
		},
	};
}

export const lightTheme = createTheme("light", "neutral");
export const darkTheme = createTheme("dark", "neutral");

/** Applies one preference consistently to every themed surface in the app. */
export function applyAppearance(
	themeMode: ThemeMode,
	accentColor: AccentColor,
) {
	UnistylesRuntime.updateTheme("light", () =>
		createTheme("light", accentColor),
	);
	UnistylesRuntime.updateTheme("dark", () => createTheme("dark", accentColor));

	if (themeMode === "system") {
		UnistylesRuntime.setAdaptiveThemes(true);
		return;
	}

	UnistylesRuntime.setAdaptiveThemes(false);
	UnistylesRuntime.setTheme(themeMode);
}

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
		adaptiveThemes: true,
	},
});
