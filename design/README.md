# bro — design package (Helm)

Drop this `design/` folder into the repo root. Reference `design/DESIGN.md`
from your `CLAUDE.md` / `AGENTS.md` so it loads for every UI task. Product
name is **bro** for now; the design language is **Helm**. If the product is
renamed later, `brand/` regenerates from the same recipe (Instrument Sans Bold,
−4% tracking, accent full stop) and two copy lines change.

```
design/
├── README.md
├── DESIGN.md                 the rulebook — read first, overrides everything
├── COMPONENTS.md             every component, with RN library mappings and keep/change notes
├── tokens/
│   ├── tokens.json           canonical, machine-readable
│   ├── helm.ts               theme objects, type scale, dial/terrain/figure geometry, OKLCH accent
│   ├── unistyles.ts          StyleSheet.configure + setAccentHue() + setAppearance()
│   ├── icons.ts              Lucide defaults and the canonical icon map
│   └── tokens.css            web / marketing / reference sheets
├── brand/                    logotype: Instrument Sans Bold, outlined, accent full stop
│   ├── bro-icon-dark.svg     PRIMARY app icon (= dark-ice)
│   ├── bro-icon-dark-{ice,lichen,amber,ember,violet,teal}.svg   alternate icons per accent preset
│   ├── bro-icon-light.svg    light-mode icon, plus the same six presets
│   ├── bro-icon-tinted.svg   iOS tinted / Android monochrome basis
│   ├── bro-glyph.svg         circular b. — notifications, favicon, watch
│   ├── bro-wordmark.svg      outlined wordmark; dot takes var(--accent), Ice fallback
│   ├── bro-lockup-dark.svg / bro-lockup-light.svg   marketing lockup (≥300px wide)
│   └── drawn-mark-archive/   the earlier geometric mark — reference only, not in use
└── reference/
    ├── helm-design-language.html      the language: rationale, landscape, three screens
    ├── helm-components-from-bro.html  25 components rebuilt in Helm with keep/change notes
    ├── bro-intake-proposal.html       intake v2 (library-first, rough entries, substances)
    ├── bro-measurements-proposal.html tailor's diagram, measurement rules
    └── bro-icon-sheet.html            the earlier drawn-mark exploration — historical; see brand/ for the logotype in use
```

## Wiring (React Native + Unistyles 3)

1. Copy `tokens/` into the app. `import './design/tokens/unistyles'` once, before
   any `StyleSheet.create` (top of `App.tsx` / root `_layout.tsx`).
2. Bundle Instrument Sans (400/500/600/700), Geist Mono (400/500/600) and
   Instrument Serif (400/italic) — all OFL — and make the `fontFamily` strings in
   `helm.ts` match your asset names (`expo-font` or `react-native-asset`).
3. On boot, after loading the user record: `setAccentHue(user.accentHue)`. Persist
   only the integer.
4. Chrome from the OS: `react-native-bottom-tabs` for the tab bar, native-stack
   `headerLargeTitle` for titles, `react-native-screens` form sheets for sheets.
   See the library table at the top of `COMPONENTS.md`.
5. Skia for Dial, Terrain and the tailor's figure; `react-native-svg` for the
   wheel; Reanimated for springs; `expo-haptics` for confirmation.
6. Icons: import from `tokens/icons.ts` only.

**Web / reference.** `tokens.css` + the three Google Fonts families.

## The rule most likely to be broken

Colour has three separate jobs: **domain** = what it measures (data only,
constant per measurement), **accent** = you touched this (interaction only),
**alert** = risk (once per screen, never personalised). A PR that mixes them is
wrong regardless of how it looks. Second most likely: coloured deltas. There
are none — change is a signed number in ink, in a sentence.

## Migrating from Baseline

Baseline tokens (bone canvas, Archivo, `--line`-bordered cards, "lines before
shadows") are retired. Search the codebase for `#E9E9E4`, `Archivo`, and
1px-border card patterns; replace with `surface1` inset lists and Helm type.
Everything about *behaviour* — bands, no verdicts, no streaks, rough entries,
no intake↔exercise coupling — carries over unchanged.
