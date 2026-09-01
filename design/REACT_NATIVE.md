# Baseline on React Native

`DESIGN.md` remains authoritative. This file records how its browser-oriented
delivery notes map to the Expo app.

## Runtime tokens

`apps/app/src/theme/unistyles.ts` is the React Native adapter for
`tokens/tokens.json`. It exposes the canonical canvas, surface, line, ink,
domain, alert, and accent roles to Unistyles. Older property names remain as
temporary aliases for feature styles, but new code should use canonical names.

React Native does not need CSS custom properties. The app stores `accentHue`
and the optional Graphite chroma, then converts the canonical OKLCH formulas to
sRGB at theme creation. Derived colors are never stored.

## Type

Archivo and Source Serif 4 are bundled with the app through Expo Font. Theme
variants own their font family as well as their size, line height, tracking,
and numeric style. Use `AppText` rather than a raw `Text` in product UI:

- `metric`, `display`, `title`, `section`, `score`, `body`, `label`, `caption`,
  and `micro` are Archivo.
- `lead` is Source Serif 4 and is reserved for reflective or user-authored
  words. Multiline `FormField` input uses it automatically.

The root layout keeps the native splash visible until both storage and fonts
are ready.

## Native interaction

- A native press is the equivalent of hover/active. Tap feedback uses the
  160ms motion token where animation is useful; opacity feedback remains for
  controls that do not animate.
- Touch targets use a 44px minimum.
- Selected controls use accent tint and accent border. Data marks never use
  accent.
- System accessibility roles and states replace ARIA (`accessibilityRole`,
  `accessibilityState`, and grouped container roles).
- Platform screen-reader and reduced-motion preferences are read through React
  Native APIs when a component animates. Static components need no motion
  branch.

## Elevation and safe areas

`Screen` renders the canvas. `Card`, list rows, sheets, and the tab bar render
surface with a one-pixel line. Product UI does not use shadow or Android
elevation. Safe-area boundaries belong to `Screen` variants and the navigator,
not individual cards.

## Data domains

Charts receive or infer one of `mind`, `body`, `sleep`, or `load`. The wheel is
mind data; check-in marks are mind data; habit completion marks are body data.
Accent remains reserved for selection and navigation.

## Assets

Expo consumes raster files, so the checked-in PNG app, splash, and favicon
assets are deterministic exports of `design/brand/*.svg`. Light and dark splash
variants use their matching Baseline neutral backgrounds. Do not redraw the mark
in React Native.

After changing a brand SVG:

```sh
pnpm brand                     # re-export apps/app/assets/images/*
pnpm nx run app:prebuild       # push them into apps/app/ios and apps/app/android
pnpm brand:check               # geometry + freshness, exits non-zero on failure
```

`pnpm brand:check` is the authority on where each mark may sit — it measures the
rendered ink rather than trusting the SVG transform, so an edit to the paths is
caught as well as an edit to the scale. It enforces that every mark is centred,
that the square app icons hold the 83%-of-canvas rule, and that both Android
adaptive layers stay inside the 66dp safe zone. That last one matters: adaptive
icons are a 108dp layer, launchers mask it to 72dp, and only the middle 66dp is
guaranteed visible whatever mask shape the launcher chooses. A layer that
overruns it is clipped on real devices while looking correct in the SVG.

Android adaptive icons use separate transparent layers: the foreground carries
the wordmark, while the Android 13+ monochrome layer uses the compact `b.` glyph
so themed launchers have a meaningful alpha mask. Backgrounds in the icon SVGs
are tagged `id="bg"` so the checker can measure the mark alone; keep that
attribute if you add a new plate.

`bro-icon-tinted.svg` is currently reference-only — `app.json` configures no iOS
dark or tinted icon variants, so nothing exports it.
