import type { ThemeMode } from "@bro/database-app";
import { Platform, type TextStyle } from "react-native";
import {
	StyleSheet,
	UnistylesRuntime,
	useUnistyles,
} from "react-native-unistyles";

// Expo Router can evaluate route modules before the root layout, so the theme is
// configured in the module every component imports rather than in App itself.
export { StyleSheet, useUnistyles };

const scale = {
	xs: 4,
	sm: 8,
	md: 12,
	lg: 16,
	xl: 24,
	xxl: 32,
	huge: 64,
} as const;

const spacing = {
	...scale,
	/** Page inset. Aliased so it can never drift from the scale step it is. */
	gutter: scale.xl,
} as const;

const radiusScale = {
	xs: 6,
	md: 12,
	lg: 16,
	pill: 999,
} as const;

const radius = {
	...radiusScale,
	chip: radiusScale.xs,
	control: radiusScale.md,
	card: radiusScale.lg,
	sheet: 24,
} as const;

const tabular = ["tabular-nums"] as TextStyle["fontVariant"];
const sans = Platform.select({
	ios: "System",
	android: "sans-serif",
	default: "system-ui",
});
const largeTitle = {
	fontFamily: "Caladea_400Regular",
	fontSize: 34,
	lineHeight: 40,
	letterSpacing: -0.4,
};
const title = {
	fontFamily: "Caladea_400Regular",
	fontSize: 30,
	lineHeight: 36,
	letterSpacing: -0.3,
};
const section = {
	fontFamily: sans,
	fontWeight: "600" as const,
	fontSize: 20,
	lineHeight: 26,
};
const body = {
	fontFamily: sans,
	fontSize: 16,
	lineHeight: 24,
};
const bodyMedium = {
	fontFamily: sans,
	fontWeight: "500" as const,
	fontSize: 16,
	lineHeight: 24,
};
const caption = {
	fontFamily: sans,
	fontSize: 14,
	lineHeight: 20,
};
const footnote = {
	fontFamily: sans,
	fontSize: 12,
	lineHeight: 16,
};
const monoHero = {
	fontFamily: sans,
	fontWeight: "600" as const,
	fontSize: 56,
	lineHeight: 58,
	letterSpacing: -1.2,
	fontVariant: tabular,
};
const monoDial = {
	fontFamily: sans,
	fontWeight: "600" as const,
	fontSize: 44,
	lineHeight: 46,
	letterSpacing: -0.8,
	fontVariant: tabular,
};
const monoReadout = {
	fontFamily: sans,
	fontWeight: "600" as const,
	fontSize: 30,
	lineHeight: 34,
	letterSpacing: -0.4,
	fontVariant: tabular,
};
const contentTitle = {
	fontFamily: sans,
	fontWeight: "600" as const,
	fontSize: 18,
	lineHeight: 22,
};
const monoList = {
	...contentTitle,
	fontVariant: tabular,
};
const monoInline = {
	fontFamily: sans,
	fontWeight: "500" as const,
	fontSize: 13,
	lineHeight: 16,
	fontVariant: tabular,
};
const serifQuote = {
	fontFamily: "Caladea_400Regular",
	fontSize: 20,
	lineHeight: 26,
};

const typography = {
	largeTitle,
	title,
	section,
	sectionCompact: { ...section, fontSize: 16, lineHeight: 22 },
	contentTitle,
	body,
	caption,
	footnote,
	monoHero,
	monoDial,
	monoReadout,
	monoList,
	monoInline,
	serifQuote,
	lead: { ...serifQuote, fontFamily: sans },
	label: { ...bodyMedium, fontSize: 14, lineHeight: 20 },
	eyebrow: {
		...footnote,
		fontWeight: "500",
		letterSpacing: 0.6,
		textTransform: "uppercase",
	},
} as const;

const buttonMinHeight = 52;

const shared = {
	spacing,
	radius,
	typography,
	fonts: {
		sans,
		mono: sans,
		serif: "Caladea_400Regular",
	},
	control: {
		buttonMinHeight,
		minHitArea: 48,
		headerActionVisualSize: 40,
		headerActionIconSize: 18,
		/**
		 * Scroll padding that keeps the last row clear of the floating log action,
		 * which sits a gutter above the tab bar. Derived so the two cannot drift.
		 */
		fabClearance: buttonMinHeight + scale.xl + scale.lg,
		factorChipVisualHeight: 40,
		scoreMinHeight: 56,
		noteMinHeight: 112,
		avatarSize: 48,
		avatarIconSize: 20,
		focusIconSize: 20,
		areaPromptIconSize: 32,
	},
	opacity: { disabled: 0.4, pressed: 0.72, domainTint: 0.22 },
	motion: {
		duration: 160,
		tap: { duration: 160 },
		spring: { damping: 18, stiffness: 120, mass: 1 },
	},
	dial: {
		arcStart: -135,
		arcEnd: 135,
		sweep: 270,
		radius: 78,
		box: 200,
		track: 8,
		trackMini: 6,
		tickEvery: 15,
		marker: 7,
		markerMini: 5,
		bandFill: 0.28,
		bandEdge: 1.5,
		bandGlow: 5,
		markerGlow: 8,
	},
	terrain: {
		windowDays: 30,
		hatch: { size: 6, angle: -20, opacity: 0.22 },
		line: 2,
		lineGlow: 5,
		currentDot: 4,
		currentDotGlow: 6,
	},
	readingMarker: {
		glow: 6,
	},
	figure: {
		stroke: 11,
		box: [380, 470] as const,
		sites: {
			neck: 86,
			chest: 150,
			bicep: 178,
			waist: 205,
			hip: 262,
			thigh: 345,
		},
	},
} as const;

// Grounded Editorial, design/mens-health-design-tokens.json.
const palettes = {
	light: {
		base: "#FFFDFA",
		surface1: "#F4F1EB",
		// The guide's light appearance defined no raised step, so cards, controls
		// and pressed rows all collapsed onto surface1. These two carry that scale.
		surface2: "#EDE9E1",
		surfaceSunk: "#E2DCD0",
		surface3: "#E0ECE7",
		field: "#FFFDFA",
		hairline: "#D8DDD6",
		hairlineStrong: "#78847D",
		glass: "#FFFDFA",
		ink: "#202725",
		ink2: "#626B65",
		brand: "#174F4A",
		onBrand: "#FFFFFF",
		accent: "#A14F36",
		onAccent: "#FFFFFF",
		selectedSoft: "#E0ECE7",
		historyFill: "#DDE5DD",
		interactiveBorder: "#78847D",
		mind: "#174F4A",
		body: "#174F4A",
		sleep: "#174F4A",
		load: "#174F4A",
		alert: "#A33932",
	},
	dark: {
		base: "#171D1A",
		surface1: "#202923",
		surface2: "#29352D",
		surfaceSunk: "#313F37",
		surface3: "#304B3E",
		field: "#29352D",
		hairline: "#39483F",
		hairlineStrong: "#7D9183",
		glass: "#202923",
		ink: "#F2F0E9",
		ink2: "#B3BDB5",
		brand: "#A8CDBE",
		onBrand: "#14261D",
		accent: "#D99A78",
		onAccent: "#281B14",
		selectedSoft: "#304B3E",
		historyFill: "#344C40",
		interactiveBorder: "#7D9183",
		mind: "#A8CDBE",
		body: "#A8CDBE",
		sleep: "#A8CDBE",
		load: "#A8CDBE",
		alert: "#F2ABA0",
	},
} as const;

export type DataDomain = "mind" | "body" | "sleep" | "load";

export function createTheme(scheme: "light" | "dark") {
	const palette = palettes[scheme];

	const colors = {
		...palette,
		hairlineSoft: `${palette.hairline}80`,
		mindTint: `${palette.mind}38`,
		// Grounded Editorial defines a single secondary ink; subtle and muted text
		// share it rather than each owning a copy of the same hex.
		ink3: palette.ink2,
		canvas: palette.base,
		surface: palette.surface1,
		line: palette.hairline,
		lineStrong: palette.hairlineStrong,
		scrim: scheme === "dark" ? "rgba(23,29,26,0.65)" : "rgba(32,39,37,0.4)",
		background: palette.base,
		text: palette.ink,
		textMuted: palette.ink2,
		textSubtle: palette.ink2,
		border: palette.hairline,
		headerBackground: palette.base,
		tabIndicator: palette.selectedSoft,
		// The Android press ripple, tinted to settle into the indicator it sits under.
		tabRipple: `${palette.selectedSoft}38`,
		selected: palette.selectedSoft,
		onSelected: palette.brand,
		// Rows carry secondary metadata even during a press. This surface keeps
		// that text readable; surfaceSunk is reserved for primary-ink controls.
		rowPressed: palette.surface2,
	};
	return {
		...shared,
		name: scheme,
		isDark: scheme === "dark",
		colors,
		tint: (hex: string, alpha = 0.22) =>
			`${hex}${Math.round(Math.max(0, Math.min(1, alpha)) * 255)
				.toString(16)
				.padStart(2, "0")}`,
		domain: (domain: DataDomain | "alert") => colors[domain],
	};
}

export const lightTheme = createTheme("light");
export const darkTheme = createTheme("dark");

export function applyAppearance(themeMode: ThemeMode) {
	if (themeMode === "system") {
		UnistylesRuntime.setAdaptiveThemes(true);
		return;
	}
	UnistylesRuntime.setAdaptiveThemes(false);
	UnistylesRuntime.setTheme(themeMode);
}

export function stackScreenOptions(
	theme: typeof lightTheme | typeof darkTheme,
) {
	const glassHeader = Platform.OS === "ios";
	return {
		headerStyle: { backgroundColor: theme.colors.base },
		headerTintColor: theme.colors.ink,
		headerShadowVisible: false,
		// Native-stack does not inset Android content beneath a transparent
		// edge-to-edge header. Keep the native translucent treatment on iOS, where the
		// scroll inset participates in large-title collapse, and use the native
		// opaque material boundary on Android/web so page tops remain visible.
		headerTransparent: glassHeader,
		headerBlurEffect: glassHeader
			? theme.isDark
				? ("systemUltraThinMaterialDark" as const)
				: ("systemUltraThinMaterialLight" as const)
			: undefined,
		headerLargeTitle: true,
		headerLargeTitleShadowVisible: false,
		headerLargeTitleStyle: {
			...theme.typography.largeTitle,
			fontWeight: "400" as const,
			color: theme.colors.ink,
		},
		headerTitleStyle: {
			fontFamily: theme.typography.title.fontFamily,
			fontWeight: "400" as const,
			color: theme.colors.ink,
		},
		contentStyle: { backgroundColor: theme.colors.base },
	};
}

type AppThemes = { light: typeof lightTheme; dark: typeof darkTheme };
type AppBreakpoints = { xs: 0; sm: 380; md: 600 };

declare module "react-native-unistyles" {
	export interface UnistylesThemes extends AppThemes {}
	export interface UnistylesBreakpoints extends AppBreakpoints {}
}

StyleSheet.configure({
	themes: { light: lightTheme, dark: darkTheme },
	breakpoints: { xs: 0, sm: 380, md: 600 },
	settings: { adaptiveThemes: true },
});
