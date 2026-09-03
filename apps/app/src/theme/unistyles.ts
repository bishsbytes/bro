import type { ThemeMode } from "@bro/database-app";
import { Platform, type TextStyle } from "react-native";
import {
	StyleSheet,
	UnistylesRuntime,
	useUnistyles,
} from "react-native-unistyles";

// Expo Router can evaluate route modules before the root layout, so Helm is
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
	section: 64,
	s1: 4,
	s2: 8,
	s3: 12,
	s4: 16,
	s5: 24,
	s6: 32,
	s7: 48,
	s8: 64,
	gutter: 16,
} as const;

const radius = {
	xs: 6,
	sm: 6,
	md: 12,
	lg: 20,
	pill: 999,
	chip: 6,
	control: 12,
	card: 20,
	sheet: 28,
	device: 44,
} as const;

const tabular = ["tabular-nums"] as TextStyle["fontVariant"];
const largeTitle = {
	fontFamily: "InstrumentSans_700Bold",
	fontSize: 32,
	lineHeight: 36,
	letterSpacing: -0.96,
};
const title = {
	fontFamily: "InstrumentSans_600SemiBold",
	fontSize: 26,
	lineHeight: 30,
	letterSpacing: -0.52,
};
const section = {
	fontFamily: "InstrumentSans_600SemiBold",
	fontSize: 19,
	lineHeight: 23,
};
const body = {
	fontFamily: "InstrumentSans_400Regular",
	fontSize: 15,
	lineHeight: 22,
};
const bodyMedium = {
	fontFamily: "InstrumentSans_500Medium",
	fontSize: 15,
	lineHeight: 22,
};
const caption = {
	fontFamily: "InstrumentSans_400Regular",
	fontSize: 12.5,
	lineHeight: 17,
};
const footnote = {
	fontFamily: "InstrumentSans_400Regular",
	fontSize: 12,
	lineHeight: 16,
};
const monoHero = {
	fontFamily: "GeistMono_600SemiBold",
	fontSize: 56,
	lineHeight: 58,
	letterSpacing: -2.8,
	fontVariant: tabular,
};
const monoDial = {
	fontFamily: "GeistMono_600SemiBold",
	fontSize: 44,
	lineHeight: 46,
	letterSpacing: -1.76,
	fontVariant: tabular,
};
const monoReadout = {
	fontFamily: "GeistMono_600SemiBold",
	fontSize: 30,
	lineHeight: 34,
	letterSpacing: -0.9,
	fontVariant: tabular,
};
const monoList = {
	fontFamily: "GeistMono_600SemiBold",
	fontSize: 18,
	lineHeight: 22,
	fontVariant: tabular,
};
const monoInline = {
	fontFamily: "GeistMono_500Medium",
	fontSize: 13,
	lineHeight: 16,
	fontVariant: tabular,
};
const serifQuote = {
	fontFamily: "InstrumentSerif_400Regular",
	fontSize: 21,
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
	label: bodyMedium,
	micro: footnote,
	face: { fontSize: 22, lineHeight: 28 },
	eyebrow: { letterSpacing: 0 },
} as const;

const shared = {
	spacing,
	radius,
	typography,
	fonts: {
		sans: "InstrumentSans_400Regular",
		mono: "GeistMono_400Regular",
		serif: "InstrumentSerif_400Regular",
	},
	control: {
		buttonMinHeight: 44,
		scoreMinHeight: 52,
		noteMinHeight: 112,
		avatarSize: 44,
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
	},
	terrain: {
		windowDays: 30,
		hatch: { size: 6, angle: -20, opacity: 0.22 },
		line: 2,
		currentDot: 4,
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

const palettes = {
	dark: {
		base: "#0B0F14",
		surface1: "#121820",
		surface2: "#1A222C",
		surface3: "#232D39",
		hairline: "rgba(255,255,255,0.08)",
		hairlineStrong: "rgba(255,255,255,0.14)",
		glass: "rgba(26,34,44,0.74)",
		ink: "#E8ECF0",
		ink2: "#9AA6B2",
		ink3: "#5F6B77",
		mind: "#7FB3D5",
		body: "#8FBF8A",
		sleep: "#A99BE0",
		load: "#E0B45A",
		alert: "#E07A6A",
	},
	light: {
		base: "#EEF1F4",
		surface1: "#F7F8FA",
		surface2: "#FFFFFF",
		surface3: "#E3E8ED",
		hairline: "rgba(10,20,30,0.08)",
		hairlineStrong: "rgba(10,20,30,0.14)",
		glass: "rgba(255,255,255,0.74)",
		ink: "#12181F",
		ink2: "#4F5B67",
		ink3: "#8B96A1",
		mind: "#3F7CA3",
		body: "#4E8B55",
		sleep: "#6E5FB8",
		load: "#A8791E",
		alert: "#B8483B",
	},
} as const;

export type DataDomain = "mind" | "body" | "sleep" | "load";

export function createTheme(
	scheme: "light" | "dark",
	hue = ACCENT_DEFAULT_HUE,
	_chroma = ACCENT_CHROMA,
) {
	const palette = palettes[scheme];
	const accent = deriveAccent(hue, scheme === "dark");
	const colors = {
		...palette,
		...accent,
		mindTint: `${palette.mind}38`,
		bodyTint: `${palette.body}38`,
		sleepTint: `${palette.sleep}38`,
		loadTint: `${palette.load}38`,
		alertTint: `${palette.alert}38`,
		accentTint: accent.accentDeep,
		accentLine: accent.accent,
		accentStrong: accent.accent,
		// Compatibility aliases: all legacy call sites now resolve to Helm materials.
		canvas: palette.base,
		surface: palette.surface1,
		surfaceSunk: palette.surface2,
		line: palette.hairline,
		lineStrong: palette.hairlineStrong,
		inkInvert: accent.onAccent,
		scrim: scheme === "dark" ? "rgba(11,15,20,0.65)" : "rgba(238,241,244,0.65)",
		background: palette.base,
		text: palette.ink,
		textMuted: palette.ink2,
		textSubtle: palette.ink3,
		border: palette.hairline,
		danger: palette.alert,
		onDanger: accent.onAccent,
		headerBackground: palette.base,
		headerBorder: palette.hairline,
		tabBackground: palette.glass,
		tabInactive: palette.ink2,
		tabIndicator: accent.accentDeep,
		brand: accent.accent,
		onBrand: accent.onAccent,
		selected: accent.accentDeep,
		onSelected: palette.ink,
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
		// edge-to-edge header. Keep the Helm glass treatment on iOS, where the
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
			fontFamily: "InstrumentSans_700Bold",
			fontSize: 32,
			fontWeight: "700" as const,
			color: theme.colors.ink,
		},
		headerTitleStyle: {
			fontFamily: "InstrumentSans_600SemiBold",
			fontWeight: "600" as const,
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
