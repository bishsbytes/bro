import type { ThemeMode } from "@bro/database-app";
import type { TextStyle } from "react-native";
import {
	StyleSheet,
	UnistylesRuntime,
	useUnistyles,
} from "react-native-unistyles";

// Import themed APIs from this module rather than directly from Unistyles. Expo
// Router can evaluate route modules before the root layout, so this module must
// finish configuring the theme before a route creates a themed stylesheet.
export { StyleSheet, useUnistyles };

const DEFAULT_ACCENT_HUE = 235;
const DEFAULT_ACCENT_CHROMA = 0.055;
const GRAPHITE_ACCENT_CHROMA = 0.006;

function normalizeAccentHue(value: unknown): number {
	const hue = Number(value);
	if (!Number.isFinite(hue)) return DEFAULT_ACCENT_HUE;
	return ((Math.round(hue) % 360) + 360) % 360;
}

export type AccentOption = {
	value: string;
	labelKey: string;
	hue: number;
	chroma: number;
};

/** Presets from design/tokens/tokens.json. The persisted value remains a hue. */
export const ACCENT_OPTIONS = [
	{
		value: "harbour",
		labelKey: "appearance.accentHarbour",
		hue: 235,
		chroma: DEFAULT_ACCENT_CHROMA,
	},
	{
		value: "moss",
		labelKey: "appearance.accentMoss",
		hue: 145,
		chroma: DEFAULT_ACCENT_CHROMA,
	},
	{
		value: "brass",
		labelKey: "appearance.accentBrass",
		hue: 85,
		chroma: DEFAULT_ACCENT_CHROMA,
	},
	{
		value: "clay",
		labelKey: "appearance.accentClay",
		hue: 40,
		chroma: DEFAULT_ACCENT_CHROMA,
	},
	{
		value: "plum",
		labelKey: "appearance.accentPlum",
		hue: 318,
		chroma: DEFAULT_ACCENT_CHROMA,
	},
	{
		value: "teal",
		labelKey: "appearance.accentTeal",
		hue: 195,
		chroma: DEFAULT_ACCENT_CHROMA,
	},
	{
		value: "graphite",
		labelKey: "appearance.accentGraphite",
		hue: 250,
		chroma: GRAPHITE_ACCENT_CHROMA,
	},
] as const satisfies readonly AccentOption[];

export function matchingAccentOption(hue: number, chroma: number) {
	return ACCENT_OPTIONS.find(
		(option) => option.hue === hue && option.chroma === chroma,
	);
}

const shared = {
	spacing: {
		xs: 4,
		sm: 8,
		md: 12,
		lg: 16,
		xl: 24,
		xxl: 32,
		xxxl: 48,
		huge: 64,
		section: 96,
	},
	radius: {
		xs: 3,
		sm: 3,
		md: 6,
		lg: 10,
		pill: 999,
	},
	typography: {
		metric: {
			fontFamily: "Archivo_600SemiBold",
			fontSize: 56,
			lineHeight: 60,
			letterSpacing: -1.96,
			fontVariant: ["tabular-nums"] as TextStyle["fontVariant"],
		},
		display: {
			fontFamily: "Archivo_600SemiBold",
			fontSize: 40,
			lineHeight: 44,
			letterSpacing: -0.8,
		},
		title: {
			fontFamily: "Archivo_600SemiBold",
			fontSize: 27,
			lineHeight: 32,
			letterSpacing: -0.4,
		},
		section: {
			fontFamily: "Archivo_600SemiBold",
			fontSize: 21,
			lineHeight: 27,
		},
		score: {
			fontFamily: "Archivo_600SemiBold",
			fontSize: 21,
			lineHeight: 27,
			fontVariant: ["tabular-nums"] as TextStyle["fontVariant"],
		},
		lead: {
			fontFamily: "SourceSerif4_400Regular",
			fontSize: 17,
			lineHeight: 27,
		},
		body: {
			fontFamily: "Archivo_400Regular",
			fontSize: 15,
			lineHeight: 23,
		},
		label: {
			fontFamily: "Archivo_500Medium",
			fontSize: 15,
			lineHeight: 22,
		},
		caption: {
			fontFamily: "Archivo_400Regular",
			fontSize: 13,
			lineHeight: 18,
		},
		micro: {
			fontFamily: "Archivo_400Regular",
			fontSize: 12,
			lineHeight: 16,
		},
		face: { fontSize: 22, lineHeight: 28 },
		// Kept at zero while call sites transition from legacy eyebrow props.
		eyebrow: { letterSpacing: 0 },
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
	opacity: {
		disabled: 0.45,
		domainTint: 0.16,
	},
	motion: {
		duration: 160,
	},
} as const;

const schemeColors = {
	light: {
		canvas: "#E9E9E4",
		surface: "#F5F5F1",
		surfaceSunk: "#E1E2DC",
		line: "#D3D5CD",
		lineStrong: "#B9BCB2",
		ink: "#23282B",
		ink2: "#5C6469",
		ink3: "#8B9297",
		inkInvert: "#F5F5F1",
		mind: "#4E6473",
		mindTint: "#DDE4E8",
		body: "#667F5B",
		bodyTint: "#E0E6DC",
		sleep: "#6F6A85",
		sleepTint: "#E2E0E8",
		load: "#A0803F",
		loadTint: "#EBE4D3",
		alert: "#93564A",
		alertTint: "#EEDFDB",
		scrim: "#E9E9E48C",
	},
	dark: {
		canvas: "#191C1E",
		surface: "#212528",
		surfaceSunk: "#141719",
		line: "#313739",
		lineStrong: "#454C4F",
		ink: "#E4E5E1",
		ink2: "#A0A7AA",
		ink3: "#767D81",
		inkInvert: "#191C1E",
		mind: "#86A3B5",
		mindTint: "#26333A",
		body: "#98AF8B",
		bodyTint: "#2A332A",
		sleep: "#A29BBB",
		sleepTint: "#2E2C39",
		load: "#C7A96C",
		loadTint: "#332E22",
		alert: "#C08375",
		alertTint: "#382723",
		scrim: "#191C1E8C",
	},
} as const;

function toHex(value: number): string {
	const bounded = Math.max(0, Math.min(1, value));
	const encoded =
		bounded <= 0.0031308
			? 12.92 * bounded
			: 1.055 * bounded ** (1 / 2.4) - 0.055;
	return Math.round(encoded * 255)
		.toString(16)
		.padStart(2, "0")
		.toUpperCase();
}

/** React Native-compatible sRGB rendering of Baseline's canonical OKLCH. */
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
	const red = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
	const green = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
	const blue = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
	return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

function accentColors(scheme: "light" | "dark", hue: number, chroma: number) {
	if (scheme === "light") {
		return {
			accent: oklchToHex(0.48, chroma, hue),
			accentStrong: oklchToHex(0.41, chroma, hue),
			accentTint: oklchToHex(0.92, chroma * 0.42, hue),
			accentLine: oklchToHex(0.78, chroma * 0.7, hue),
			onAccent: oklchToHex(0.97, chroma * 0.15, hue),
		};
	}
	return {
		accent: oklchToHex(0.78, chroma * 1.15, hue),
		accentStrong: oklchToHex(0.85, chroma * 1.15, hue),
		accentTint: oklchToHex(0.3, chroma * 0.75, hue),
		accentLine: oklchToHex(0.45, chroma * 0.9, hue),
		onAccent: oklchToHex(0.18, chroma * 0.3, hue),
	};
}

export function createTheme(
	scheme: "light" | "dark",
	hue = DEFAULT_ACCENT_HUE,
	chroma = DEFAULT_ACCENT_CHROMA,
) {
	const neutral = schemeColors[scheme];
	const accent = accentColors(scheme, normalizeAccentHue(hue), chroma);
	return {
		...shared,
		colors: {
			...neutral,
			...accent,
			// Compatibility aliases keep feature styles semantic while components
			// move to the canonical Baseline names above.
			background: neutral.canvas,
			text: neutral.ink,
			textMuted: neutral.ink2,
			textSubtle: neutral.ink3,
			border: neutral.line,
			danger: neutral.alert,
			onDanger: neutral.alertTint,
			headerBackground: neutral.canvas,
			headerBorder: neutral.line,
			tabBackground: neutral.surface,
			tabInactive: neutral.ink3,
			tabIndicator: neutral.surfaceSunk,
			brand: accent.accent,
			onBrand: accent.onAccent,
			selected: accent.accentTint,
			onSelected: neutral.ink,
		},
	};
}

export const lightTheme = createTheme("light");
export const darkTheme = createTheme("dark");

/** Applies one preference consistently to every themed surface in the app. */
export function applyAppearance(
	themeMode: ThemeMode,
	accentHue: number,
	accentChroma = DEFAULT_ACCENT_CHROMA,
) {
	UnistylesRuntime.updateTheme("light", () =>
		createTheme("light", accentHue, accentChroma),
	);
	UnistylesRuntime.updateTheme("dark", () =>
		createTheme("dark", accentHue, accentChroma),
	);

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
		headerStyle: { backgroundColor: theme.colors.canvas },
		headerTintColor: theme.colors.ink,
		headerShadowVisible: false,
		headerTitleStyle: {
			fontFamily: "Archivo_600SemiBold",
			fontWeight: "600" as const,
		},
		contentStyle: { backgroundColor: theme.colors.canvas },
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
