// bro — Helm tokens for React Native + Unistyles 3
// Canonical source: tokens.json. Rules: ../DESIGN.md.
// Do not hard-code colours or sizes elsewhere; use theme.* inside StyleSheet.create.

// ---------- OKLCH → sRGB hex (for the user-owned accent) ----------

const gamma = (x: number) => {
  const v = Math.min(Math.max(x, 0), 1);
  return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
};

/** l 0–1, c ≈ 0–0.4, h degrees → "#RRGGBB" */
export function oklchToHex(l: number, c: number, h: number): string {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr), b = c * Math.sin(hr);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const L = l_ ** 3, M = m_ ** 3, S = s_ ** 3;
  const r = 4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S;
  const g = -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S;
  const bl = -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S;
  const to255 = (x: number) => Math.round(gamma(x) * 255).toString(16).padStart(2, '0');
  return `#${to255(r)}${to255(g)}${to255(bl)}`.toUpperCase();
}

// ---------- Accent ----------

export const ACCENT_DEFAULT_HUE = 212;
export const ACCENT_CHROMA = 0.12;
export const ACCENT_PRESETS = [
  { name: 'Ice', hue: 212 },
  { name: 'Lichen', hue: 140 },
  { name: 'Amber', hue: 80 },
  { name: 'Ember', hue: 35 },
  { name: 'Violet', hue: 300 },
  { name: 'Teal', hue: 190 },
] as const;

export const normalizeHue = (h: unknown): number => {
  const n = Number(h);
  if (!Number.isFinite(n)) return ACCENT_DEFAULT_HUE;
  return ((Math.round(n) % 360) + 360) % 360;
};

/** Persist only accentHue (0–360). Never a hex. */
export function deriveAccent(hue: number, dark: boolean) {
  const h = normalizeHue(hue);
  return dark
    ? { accent: oklchToHex(0.74, ACCENT_CHROMA, h), accentDeep: oklchToHex(0.36, ACCENT_CHROMA * 0.7, h), onAccent: oklchToHex(0.16, 0.04, h) }
    : { accent: oklchToHex(0.5, ACCENT_CHROMA, h), accentDeep: oklchToHex(0.9, ACCENT_CHROMA * 0.45, h), onAccent: oklchToHex(0.98, 0.02, h) };
}

// ---------- Shared scales ----------

export const space = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 24, s6: 32, s7: 48, s8: 64, gutter: 16 } as const;
export const radius = { chip: 6, control: 12, card: 20, sheet: 28, device: 44 } as const;

export const fonts = {
  sans: 'InstrumentSans',       // InstrumentSans-Regular/Medium/SemiBold/Bold
  mono: 'GeistMono',            // GeistMono-Regular/Medium/SemiBold
  serif: 'InstrumentSerif',     // InstrumentSerif-Regular/Italic
} as const;

/** Text styles. fontFamily strings assume PostScript-style names; adjust to your asset names. */
export const type = {
  largeTitle: { fontFamily: 'InstrumentSans-Bold', fontSize: 32, letterSpacing: -0.96, lineHeight: 36 },
  title: { fontFamily: 'InstrumentSans-SemiBold', fontSize: 26, letterSpacing: -0.52, lineHeight: 30 },
  section: { fontFamily: 'InstrumentSans-SemiBold', fontSize: 19, lineHeight: 23 },
  body: { fontFamily: 'InstrumentSans-Regular', fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: 'InstrumentSans-Medium', fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: 'InstrumentSans-Regular', fontSize: 12.5, lineHeight: 17 },
  footnote: { fontFamily: 'InstrumentSans-Regular', fontSize: 12, lineHeight: 16 },
  monoHero: { fontFamily: 'GeistMono-SemiBold', fontSize: 56, letterSpacing: -2.8, lineHeight: 58, fontVariant: ['tabular-nums'] },
  monoDial: { fontFamily: 'GeistMono-SemiBold', fontSize: 44, letterSpacing: -1.76, lineHeight: 46, fontVariant: ['tabular-nums'] },
  monoReadout: { fontFamily: 'GeistMono-SemiBold', fontSize: 30, letterSpacing: -0.9, lineHeight: 34, fontVariant: ['tabular-nums'] },
  monoList: { fontFamily: 'GeistMono-SemiBold', fontSize: 18, lineHeight: 22, fontVariant: ['tabular-nums'] },
  monoInline: { fontFamily: 'GeistMono-Medium', fontSize: 13, lineHeight: 16, fontVariant: ['tabular-nums'] },
  serifQuote: { fontFamily: 'InstrumentSerif-Regular', fontSize: 21, lineHeight: 26 },
} as const;

export const motion = {
  spring: { damping: 18, stiffness: 120, mass: 1 },     // Reanimated withSpring — needle sweep, sheet settle
  tap: { duration: 160 },                                 // withTiming + Easing.bezier(0.2, 0.6, 0.3, 1)
} as const;

export const dial = {
  arcStart: -135, arcEnd: 135, sweep: 270,
  radius: 78, box: 200, track: 8, trackMini: 6, tickEvery: 15,
  marker: 7, markerMini: 5, bandFill: 0.28, bandEdge: 1.5,
} as const;

export const terrain = { windowDays: 30, hatch: { size: 6, angle: -20, opacity: 0.22 }, line: 2, currentDot: 4 } as const;

export const figure = {
  stroke: 11, box: [380, 470] as const,
  sites: { neck: 86, chest: 150, bicep: 178, waist: 205, hip: 262, thigh: 345 },
} as const;

// ---------- Palettes ----------

const paletteDark = {
  base: '#0B0F14', surface1: '#121820', surface2: '#1A222C', surface3: '#232D39',
  hairline: 'rgba(255,255,255,0.08)', hairlineStrong: 'rgba(255,255,255,0.14)', glass: 'rgba(26,34,44,0.74)',
  ink: '#E8ECF0', ink2: '#9AA6B2', ink3: '#5F6B77',
  mind: '#7FB3D5', body: '#8FBF8A', sleep: '#A99BE0', load: '#E0B45A', alert: '#E07A6A',
};
const paletteLight = {
  base: '#EEF1F4', surface1: '#F7F8FA', surface2: '#FFFFFF', surface3: '#E3E8ED',
  hairline: 'rgba(10,20,30,0.08)', hairlineStrong: 'rgba(10,20,30,0.14)', glass: 'rgba(255,255,255,0.74)',
  ink: '#12181F', ink2: '#4F5B67', ink3: '#8B96A1',
  mind: '#3F7CA3', body: '#4E8B55', sleep: '#6E5FB8', load: '#A8791E', alert: '#B8483B',
};

export type Domain = 'mind' | 'body' | 'sleep' | 'load' | 'alert';

/** Which colour each measurement belongs to. A measurement's domain never changes per screen. */
export const domainOf: Record<string, Domain> = {
  mood: 'mind', stress: 'mind', energy: 'mind', productivity: 'mind', checkin: 'mind', wheel: 'mind',
  weight: 'body', bodyFat: 'body', restingHeartRate: 'body', steps: 'body', tape: 'body', energyIntake: 'body',
  sleep: 'sleep',
  trainingLoad: 'load', alcohol: 'load', caffeine: 'load', cigarettes: 'load', nicotine: 'load',
};

export function createTheme(scheme: 'dark' | 'light', accentHue: number = ACCENT_DEFAULT_HUE) {
  const dark = scheme === 'dark';
  return {
    name: scheme,
    isDark: dark,
    colors: { ...(dark ? paletteDark : paletteLight), ...deriveAccent(accentHue, dark) },
    accentHue: normalizeHue(accentHue),
    space, radius, type, fonts, motion, dial, terrain, figure,
    /** 22% tint of a domain colour for icon tiles and bands. */
    tint: (hex: string, alpha = 0.22) => `${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`,
    domain: (d: Domain) => (dark ? paletteDark : paletteLight)[d],
  };
}

export type HelmTheme = ReturnType<typeof createTheme>;
export const darkTheme = createTheme('dark');
export const lightTheme = createTheme('light');
