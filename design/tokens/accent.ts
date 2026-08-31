/**
 * bro — accent utilities.
 *
 * The user's accent is a HUE (integer 0–360), never a hex. All rendered
 * accent colors derive in CSS (tokens.css) with lightness and chroma fixed,
 * so any hue is guaranteed muted and contrast-safe in both themes.
 *
 * Persist `accentHue` (and `accentChroma` only if Graphite) on the user
 * record. Do not persist derived colors.
 */

export interface AccentPreset {
  name: string;
  hue: number;
  chroma: number;
}

export const ACCENT_DEFAULT_HUE = 235;
export const ACCENT_DEFAULT_CHROMA = 0.055;

export const ACCENT_PRESETS: readonly AccentPreset[] = [
  { name: 'Harbour', hue: 235, chroma: 0.055 },
  { name: 'Moss', hue: 145, chroma: 0.055 },
  { name: 'Brass', hue: 85, chroma: 0.055 },
  { name: 'Clay', hue: 40, chroma: 0.055 },
  { name: 'Plum', hue: 318, chroma: 0.055 },
  { name: 'Teal', hue: 195, chroma: 0.055 },
  { name: 'Graphite', hue: 250, chroma: 0.006 },
] as const;

/** Clamp any incoming value (including from old/bad persisted state). */
export function normalizeHue(hue: unknown): number {
  const n = Number(hue);
  if (!Number.isFinite(n)) return ACCENT_DEFAULT_HUE;
  return ((Math.round(n) % 360) + 360) % 360;
}

/**
 * Apply the accent to the document. Call once on boot and again whenever
 * the user changes it. Theme (light/dark) needs no re-application — the
 * dark derivations key off the same two variables.
 */
export function applyAccent(
  hue: number,
  chroma: number = ACCENT_DEFAULT_CHROMA,
  root: HTMLElement = document.documentElement,
): void {
  root.style.setProperty('--accent-h', String(normalizeHue(hue)));
  root.style.setProperty('--accent-c', String(chroma));
}

/** Find the preset matching a stored value, if any (for settings UI). */
export function matchPreset(hue: number, chroma: number): AccentPreset | undefined {
  return ACCENT_PRESETS.find((p) => p.hue === hue && p.chroma === chroma);
}
