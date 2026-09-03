// bro — Unistyles 3 setup for Helm
// Import this file once, before any StyleSheet.create call (e.g. at the top of App.tsx / _layout.tsx).

import { StyleSheet, UnistylesRuntime } from 'react-native-unistyles';
import { darkTheme, lightTheme, deriveAccent, normalizeHue, type HelmTheme } from './helm';

type AppThemes = { dark: HelmTheme; light: HelmTheme };
type AppBreakpoints = { xs: 0; sm: 380; md: 600 };

declare module 'react-native-unistyles' {
  export interface UnistylesThemes extends AppThemes {}
  export interface UnistylesBreakpoints extends AppBreakpoints {}
}

StyleSheet.configure({
  themes: { dark: darkTheme, light: lightTheme },
  breakpoints: { xs: 0, sm: 380, md: 600 },
  settings: {
    // Follow the OS, but the app *defaults* to dark on first run (see DESIGN.md rule 2).
    adaptiveThemes: true,
    initialTheme: 'dark',
  },
});

/**
 * Apply the user's accent hue to both themes without re-rendering components.
 * Call on boot (after loading the user record) and whenever the user changes it.
 * Persist only the integer hue.
 */
export function setAccentHue(hue: number) {
  const h = normalizeHue(hue);
  UnistylesRuntime.updateTheme('dark', (t) => ({ ...t, accentHue: h, colors: { ...t.colors, ...deriveAccent(h, true) } }));
  UnistylesRuntime.updateTheme('light', (t) => ({ ...t, accentHue: h, colors: { ...t.colors, ...deriveAccent(h, false) } }));
}

/** Manual override (Settings → Appearance). Pass undefined to return to following the OS. */
export function setAppearance(mode?: 'dark' | 'light') {
  if (mode) {
    UnistylesRuntime.setAdaptiveThemes(false);
    UnistylesRuntime.setTheme(mode);
  } else {
    UnistylesRuntime.setAdaptiveThemes(true);
  }
}

/* Usage in a component:

import { StyleSheet } from 'react-native-unistyles';

const styles = StyleSheet.create((theme) => ({
  card: {
    backgroundColor: theme.colors.surface1,
    borderRadius: theme.radius.card,
    padding: theme.space.s4,
  },
  value: { ...theme.type.monoReadout, color: theme.colors.ink },
  primary: { backgroundColor: theme.colors.accent, borderRadius: 14, paddingVertical: 13 },
  primaryLabel: { ...theme.type.bodyMedium, color: theme.colors.onAccent, textAlign: 'center' },
}));
*/
