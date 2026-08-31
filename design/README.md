# bro — design package

Everything an agent or a person needs to build UI that belongs to bro.
Read **DESIGN.md first** — it is the authority and overrides framework
defaults and personal instinct. Add it to your agent context (e.g. reference
it from the repo's CLAUDE.md / AGENTS.md) so it loads for every UI task.

```
design/
├── README.md                  this file
├── DESIGN.md                  the rulebook — read before any UI work
├── tokens/
│   ├── tokens.css             runtime tokens (light, dark, accent derivation)
│   ├── tokens.json            canonical machine-readable tokens
│   ├── tailwind.css           Tailwind v4 @theme bridge onto tokens.css
│   └── accent.ts              accent presets + applyAccent()/normalizeHue()
├── brand/
│   ├── bro-icon-light.svg     app icon, light  (1024, OS applies corner mask)
│   ├── bro-icon-dark.svg      app icon, dark
│   ├── bro-icon-tinted.svg    app icon, iOS tinted / Android monochrome basis
│   ├── bro-glyph.svg          circular b. glyph — notifications, favicon, watch
│   ├── bro-wordmark.svg       drawn wordmark; dot takes var(--accent)
│   └── bro-lockup.svg         marketing lockup (wordmark + gauge rail), ≥300px wide
└── reference/
    ├── baseline-design-system.html   living style guide — open in a browser
    └── bro-icon-sheet.html           identity sheet: concepts, sizes, usage rules
```

## Wiring it up

Plain CSS: link `tokens/tokens.css` before app styles; set `data-theme="dark"`
on `<html>` for dark mode; call `applyAccent()` from `tokens/accent.ts` on boot.

Tailwind v4:

```css
@import "tailwindcss";
@import "./design/tokens/tokens.css";
@import "./design/tokens/tailwind.css";
```

Then `bg-surface text-ink border-line rounded-md p-4 text-body font-sans`
resolve to system values, and `bg-accent text-on-accent` gives a compliant
primary button.

## Fonts

Archivo (400/500/600/700) and Source Serif 4 (400/500), e.g.:

```html
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,500&display=swap" rel="stylesheet">
```

Self-host for production.

## The three color jobs (the rule most likely to be broken)

- **Domain** (mind/body/sleep/load): what the data measures. Data surfaces only.
- **Accent** (user's hue): what the user is touching. Interaction surfaces only.
- **Alert**: genuine health risk. Max once per screen. Never decorative.

If a PR mixes these, it is wrong regardless of how it looks.
