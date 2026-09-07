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

export const ACCENT_DEFAULT_HUE = 212;
export const ACCENT_CHROMA = 0.12;

export type AccentOption = {
	value: string;
	labelKey: string;
	hue: number;
	chroma: number;
};

export const ACCENT_OPTIONS = [
	{
		value: "ice",
		labelKey: "appearance.accentIce",
		hue: 212,
		chroma: ACCENT_CHROMA,
	},
	{
		value: "lichen",
		labelKey: "appearance.accentLichen",
		hue: 140,
		chroma: ACCENT_CHROMA,
	},
	{
		value: "amber",
		labelKey: "appearance.accentAmber",
		hue: 80,
		chroma: ACCENT_CHROMA,
	},
	{
		value: "ember",
		labelKey: "appearance.accentEmber",
		hue: 35,
		chroma: ACCENT_CHROMA,
	},
	{
		value: "violet",
		labelKey: "appearance.accentViolet",
		hue: 300,
		chroma: ACCENT_CHROMA,
	},
	{
		value: "teal",
		labelKey: "appearance.accentTeal",
		hue: 190,
		chroma: ACCENT_CHROMA,
	},
] as const satisfies readonly AccentOption[];

export function normalizeAccentHue(value: unknown): number {
	const hue = Number(value);
	if (!Number.isFinite(hue)) return ACCENT_DEFAULT_HUE;
	return ((Math.round(hue) % 360) + 360) % 360;
}

export function matchingAccentOption(hue: number, _chroma?: number) {
	return ACCENT_OPTIONS.find(
		(option) => option.hue === normalizeAccentHue(hue),
	);
}

const toHex = (value: number): string => {
	const bounded = Math.max(0, Math.min(1, value));
	const encoded =
		bounded <= 0.0031308
			? 12.92 * bounded
			: 1.055 * bounded ** (1 / 2.4) - 0.055;
	return Math.round(encoded * 255)
		.toString(16)
		.padStart(2, "0")
		.toUpperCase();
};

/** Converts Helm's user-owned OKLCH accent into React Native-compatible sRGB. */
export function oklchToHex(
	lightness: number,
	chroma: number,
	hue: number,
): string {
	const radians = (normalizeAccentHue(hue) * Math.PI) / 180;
	const a = chroma * Math.cos(radians);
	const b = chroma * Math.sin(radians);
	const lRoot = lightness + 0.3963377774 * a + 0.2158037573 * b;
	const mRoot = lightness - 0.1055613458 * a - 0.0638541728 * b;
	const sRoot = lightness - 0.0894841775 * a - 1.291485548 * b;
	const l = lRoot ** 3;
	const m = mRoot ** 3;
	const s = sRoot ** 3;
	return `#${toHex(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)}${toHex(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)}${toHex(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)}`;
}

export function deriveAccent(hue: number, dark: boolean) {
	const normalized = normalizeAccentHue(hue);
	return dark
		? {
				accent: oklchToHex(0.74, ACCENT_CHROMA, normalized),
				accentDeep: oklchToHex(0.36, ACCENT_CHROMA * 0.7, normalized),
				onAccent: oklchToHex(0.16, 0.04, normalized),
			}
		: {
				accent: oklchToHex(0.5, ACCENT_CHROMA, normalized),
				accentDeep: oklchToHex(0.9, ACCENT_CHROMA * 0.45, normalized),
				onAccent: oklchToHex(0.98, 0.02, normalized),
			};
}

const spacing = {
	xs: 4,
	sm: 8,
	md: 12,
	lg: 16,
	xl: 24,
	xxl: 32,
	xxxl: 48,
	huge: 64,
	section: 32,
	s1: 4,
	s2: 8,
	s3: 12,
	s4: 16,
	s5: 24,
	s6: 32,
	s7: 48,
	s8: 64,
	gutter: 24,
} as const;

const radius = {
	xs: 6,
	sm: 6,
	md: 12,
	lg: 16,
	pill: 999,
	chip: 6,
	control: 12,
	card: 16,
	sheet: 24,
	device: 44,
} as const;

const tabular = ["tabular-nums"] as TextStyle["fontVariant"];
const sans = Platform.select({
	ios: "System",
	android: "sans-serif",
	default: "system-ui",
});
const largeTitle = {
	fontFamily: "InstrumentSerif_400Regular",
	fontSize: 32,
	lineHeight: 38,
	letterSpacing: -0.4,
};
const title = {
	fontFamily: "InstrumentSerif_400Regular",
	fontSize: 28,
	lineHeight: 34,
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
const monoList = {
	fontFamily: sans,
	fontWeight: "600" as const,
	fontSize: 18,
	lineHeight: 22,
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
	fontFamily: sans,
	fontSize: 20,
	lineHeight: 26,
};

const typography = {
	largeTitle,
	title,
	section,
	body,
	bodyMedium,
	caption,
	footnote,
	monoHero,
	monoDial,
	monoReadout,
	monoList,
	monoInline,
	serifQuote,
	// Compatibility roles used throughout the existing component API.
	metric: monoHero,
	display: largeTitle,
	score: monoList,
	lead: serifQuote,
	label: { ...bodyMedium, fontSize: 14, lineHeight: 20 },
	micro: footnote,
	face: { fontSize: 22, lineHeight: 28 },
	eyebrow: { letterSpacing: 0 },
} as const;

const shared = {
	spacing,
	radius,
	typography,
	fonts: {
		sans,
		mono: sans,
		serif: "InstrumentSerif_400Regular",
	},
	control: {
		buttonMinHeight: 52,
		minHitArea: 48,
		scoreMinHeight: 56,
		noteMinHeight: 112,
		avatarSize: 48,
		avatarIconSize: 20,
		focusIconSize: 20,
		areaPromptIconSize: 32,
	},
	opacity: { disabled: 0.4, domainTint: 0.22 },
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
		surface2: "#F4F1EB",
		surface3: "#E0ECE7",
		hairline: "#D8DDD6",
		hairlineStrong: "#78847D",
		glass: "#FFFDFA",
		ink: "#202725",
		ink2: "#626B65",
		ink3: "#626B65",
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
		surface3: "#304B3E",
		hairline: "#39483F",
		hairlineStrong: "#7D9183",
		glass: "#202923",
		ink: "#F2F0E9",
		ink2: "#B3BDB5",
		ink3: "#B3BDB5",
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

export function createTheme(
	scheme: "light" | "dark",
	hue = ACCENT_DEFAULT_HUE,
	_chroma = ACCENT_CHROMA,
) {
	const palette = palettes[scheme];

	const colors = {
		...palette,
		mindTint: `${palette.mind}38`,
		bodyTint: `${palette.body}38`,
		sleepTint: `${palette.sleep}38`,
		loadTint: `${palette.load}38`,
		alertTint: `${palette.alert}38`,
		accentTint: palette.selectedSoft,
		accentLine: palette.brand,
		accentStrong: palette.brand,
		// Compatibility roles keep existing forms and records on the same theme.
		accentDeep: palette.selectedSoft,
		canvas: palette.base,
		surface: palette.surface1,
		surfaceSunk: palette.surface2,
		line: palette.hairline,
		lineStrong: palette.hairlineStrong,
		inkInvert: palette.onBrand,
		scrim: scheme === "dark" ? "rgba(23,29,26,0.65)" : "rgba(32,39,37,0.4)",
		background: palette.base,
		text: palette.ink,
		textMuted: palette.ink2,
		textSubtle: palette.ink3,
		border: palette.hairline,
		danger: palette.alert,
		onDanger: palette.onBrand,
		headerBackground: palette.base,
		headerBorder: palette.hairline,
		tabBackground: palette.glass,
		tabInactive: palette.ink2,
		tabIndicator: palette.selectedSoft,
		// The Android press ripple, tinted to settle into the indicator it sits under.
		tabRipple: `${palette.selectedSoft}38`,
		selected: palette.selectedSoft,
		onSelected: palette.brand,
	};
	return {
		...shared,
		name: scheme,
		isDark: scheme === "dark",
		accentHue: normalizeAccentHue(hue),
		colors,
		tint: (hex: string, alpha = 0.22) =>
			`${hex}${Math.round(alpha * 255)
				.toString(16)
				.padStart(2, "0")}`,
		domain: (domain: DataDomain | "alert") => colors[domain],
	};
}

export const lightTheme = createTheme("light");
export const darkTheme = createTheme("dark");

export function applyAppearance(
	themeMode: ThemeMode,
	accentHue: number,
	_accentChroma = ACCENT_CHROMA,
) {
	UnistylesRuntime.updateTheme("light", () => createTheme("light", accentHue));
	UnistylesRuntime.updateTheme("dark", () => createTheme("dark", accentHue));
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
			fontFamily: theme.fonts.serif,
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
