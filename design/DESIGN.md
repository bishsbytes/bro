# bro — design rules (Helm)

Product name: **bro** (lowercase, always; the full stop appears only in the drawn
logotype where it carries the user's accent). Design language: **Helm**. Stack:
React Native, Unistyles 3, Lucide. This file is the authority for all UI work
and overrides framework defaults, component library defaults, and instinct.
Tokens live in `tokens/` (`helm.ts`, `unistyles.ts`, `icons.ts`).
Component-by-component specs live in `COMPONENTS.md`. The living reference is
`reference/`.

Helm supersedes the earlier "Baseline" system. Where you find Baseline rules or
tokens in the codebase (bone-grey canvas, "lines before shadows", Archivo), they
are retired and should be migrated.

## Intent

bro is a mental and physical health tracker for men who want control of their
own numbers. The interface is **the bridge of a ship at night**: dim surfaces,
luminous instruments, a chart table, and one man who has decided where he's
going. It is dark-first, built from native materials, and visual enough that a
glance tells the whole story. It describes and reports bearing; it never
cheers, scolds, or coaches.

## Hard rules

1. **Native surfaces first.** React Native, but the chrome is the OS's: the tab
   bar via `react-native-bottom-tabs` (Liquid Glass on iOS 26/27, Material 3 on
   Android), large collapsing titles via the native stack, sheets via
   `react-native-screens` form sheets with detents. Custom drawing (Skia) is
   reserved for exactly three things that are ours: the **Dial**, **Terrain**,
   and the **tailor's figure**. Styling is Unistyles 3 from `tokens/`; icons are
   Lucide from `tokens/icons.ts` only.
2. **Dark is the default.** Light mode is a deliberate day mode with its own
   token set; it is never a tinted copy of dark.
3. **Depth by material, not border.** Three elevation steps by luminance
   (`base` → `surface1` → `surface2`), glass for navigation and sheets. No 1px
   bordered cards for list items — items live in inset grouped lists.
4. **Glow is for data only.** A marker, a band edge, a selected tape line, a
   chosen tile may glow. Chrome never glows.
5. **Colour has three separate jobs, never mixed.**
   - **Domain** (`mind`, `body`, `sleep`, `load`): *what this measures.* Data
     surfaces only — dials, bands, terrain, row markers, tape lines. Green means
     body, not good. Amber means load, not warning. A measurement's domain never
     changes per screen (resting heart rate is `body` everywhere).
   - **Accent** (user-chosen hue): *you touched this.* Primary actions, selected
     states, focus, active tab, the chosen check-in tile, the Finish action,
     the logotype dot. Never on data.
   - **Alert**: genuine health risk, at most once per screen, never
     personalisable, never for a missed log.
6. **No verdict UI.** No scores out of 100 on the user's behalf, no grades, no
   traffic lights, no red/green deltas, no coloured change chips, no streaks,
   no confetti, no badges, no praise. A missed day renders as an absence, never
   a broken chain.
7. **Readings against the user's own usual.** Every metric shows its band (the
   user's usual range) and a marker for now; the read sentence states fact:
   "Outside your usual 53–57. 1 bpm up since yesterday." Deltas are absolute,
   in ink, with a sign; never relative percentages of a percentage.
8. **Headings, not goals.** Ambition is expressed as a **Heading**: the user's
   own sentence with a number and an optional date. The app plots it (notch on
   the Dial/rail, dashed line on Terrain) and reports bearing as fact: "On the
   last 90 days you'd get there around mid-December." The app never moves,
   colours, or comments on a heading beyond stating it. The word "goal" does
   not appear in UI.
9. **One hero per screen.** One Dial or one 56px readout. If two compete, split
   the screen.
10. **Logging never blocks.** Defaults everywhere, nothing required beyond a
    name, rough entries are first-class ("about 600 kcal"), a half-finished
    entry saves.
11. **Sentence case everywhere.** No ALL CAPS, no letter-spaced eyebrows, no
    Title Case Buttons.
12. **Motion responds to touch.** Needles sweep in with a spring on first
    appearance; numbers tick; a log confirms with a haptic and a chip settling
    into the timeline; sheets use platform springs. Everything honours reduced
    motion.
13. **The user's accent is a hue (0–360), never a hex.** All accent colours
    derive in OKLCH with lightness and chroma fixed by the system
    (`deriveAccent` in `tokens/helm.ts`). Store `accentHue` on the user record
    and apply with `setAccentHue()` from `tokens/unistyles.ts`; components never
    re-render for it.

## Colour

Dark (default): base `#0B0F14`, surface1 `#121820`, surface2 `#1A222C`,
surface3 `#232D39`, hairline `white 8%`, hairline-strong `white 14%`,
ink `#E8ECF0`, ink2 `#9AA6B2`, ink3 `#5F6B77`.
Domains: mind `#7FB3D5`, body `#8FBF8A`, sleep `#A99BE0`, load `#E0B45A`,
alert `#E07A6A`.

Light: base `#EEF1F4`, surface1 `#F7F8FA`, surface2 `#FFFFFF`, surface3
`#E3E8ED`, hairline `#0A141E 8%`, hairline-strong `#0A141E 14%`, ink `#12181F`,
ink2 `#4F5B67`, ink3 `#8B96A1`. Domains: mind `#3F7CA3`, body `#4E8B55`,
sleep `#6E5FB8`, load `#A8791E`, alert `#B8483B`.

Accent (OKLCH, hue H from user, chroma 0.12):
- dark: accent `L 0.74`, accentDeep `L 0.36 C×0.7`, onAccent `L 0.16 C 0.04`
- light: accent `L 0.50`, accentDeep `L 0.90 C×0.45`, onAccent `L 0.98 C 0.02`
Presets: Ice 212 (default), Lichen 140, Amber 80, Ember 35, Violet 300, Teal 190.

Text: `ink` primary, `ink2` secondary (≥4.5:1), `ink3` only for 12px labels and
never the sole carrier of meaning. Domain colour as text only on its own tint
or on surface.

Glass: `surface2` at 72–74% with 18–24px blur, hairline-strong edge.

## Type

- **Instrument Sans** — all interface text. 400/500/600/700.
- **Geist Mono** — every readout and every number that is data: dials, rails,
  deltas, times in timelines, scale labels. Tabular. Fallback JetBrains Mono /
  SF Mono / Roboto Mono.
- **Instrument Serif** — the user's own words only: headings (the ambition
  object), check-in notes, journal text, intentions.

Scale (px / weight): large title 32/700 (−3%), title 26/600, section 19/600,
body 15/400, caption 12.5/400, footnote 12. Mono readouts: hero 56/600
(−5%), dial 44/600, readout 30/600, list value 18/600, inline 13/500.
Line length ≤ 68ch sans, ≤ 74ch serif.

## Space, shape, elevation

- Spacing: 4, 8, 12, 16, 24, 32, 48, 64. Screen gutter 16. Inset list padding
  12–14 vertical, 14 horizontal.
- Radius: 6 (chips, ticks), 12 (buttons, tiles, list rows), 20 (cards, lists),
  28 (sheets), 44 (device-shaped hero surfaces). Never one radius everywhere.
- Elevation: base → surface1 → surface2 by luminance. Glass for nav and sheets.
  No drop shadows on cards; a sheet may cast one soft ambient shadow.
- Touch targets ≥ 44×44. Focus: 2px accent ring, 2px offset (keyboard/TV).

## Native patterns (do these, not the web equivalents)

| Web habit in the old build | Helm |
|---|---|
| Bordered card per list item | Inset grouped list, one surface, swipe actions |
| Static page header + back arrow | Large title that collapses into a glass bar |
| New screen per action | Bottom sheet keeping context beneath |
| Full-width button mid-page + header action | One quick-log FAB pinned above the native tab bar |
| Numbers in body text | One hero Dial/readout, drawn large, mono, with glow |
| Label-over-box form fields | Inline rows (label left, value right) in grouped lists; save in title bar |
| No motion | Springs, tickers, haptics, sheet physics |
| Same layout light/dark | Dark default; light is its own token set |

## The three custom components

**Dial** — 270° open arc (−135° to +135°). Hairline track, minor ticks every
15°, the user's band as a domain-colour segment (28% fill + 1.5px bright edge
with glow), a domain-colour marker for now (7px, dark core), an optional
heading notch outside the arc. Value in mono at centre; label below. Open,
never a closing ring — nothing "completes". Mini variant: 6px track, 20px value.

**Terrain** — trend area with contour hatching (6px, −20°, 22% domain
colour), gradient fade to zero, 2px glowing line, the usual range drawn as a
`surface3` corridor, heading as a 1px dashed ink line, current point as a 4px
dot. No data-point dots along the line. Scrubbable; scrubbing updates the hero.

**Tailor's figure** — neutral pattern block in `surface3` stroke (11 units,
round caps). Tape sites at neck, chest, bicep, waist, hip, thigh. Unselected:
1.2px dashed ink3. Selected: 2px `body` with end ticks and glow. Never
resembles the user, never reshaped by his numbers, never renders fat or muscle.
Never a radar of body measurements.

## Voice

Describe, don't judge. Ask, don't cheer. Assume an adult who already knows he
skipped three days. No exclamation marks or emoji in UI copy. No moralised food
language (cheat, clean, guilt-free). Pattern lines across domains are past
tense and hedged: "On days with 3+ drinks, your sleep has averaged 55 minutes
shorter." Never causal, never advice.

Lines that must survive any redesign (verbatim):
- Totals are stated without targets, allowances, or ratings.
- A usual range appears once a total has 14 logged days.
- Outside your usual 6h 47m – 8h 3m. 2h 3m down since yesterday. *(template)*
- Nothing is saved until you finish.
- 1 is as low as it gets, 10 is as good as it gets.
- How you feel as the day ends.
- Log what you take. Nothing is scheduled or reminded.
- Food and drink are always on. Anything else appears only once you switch it on here.
- A measurement your health platform supplies stays here either way.
- Every reading is measured against itself.

Crisis or self-harm content is out of scope for generated copy: surface the
clinician-approved flow; never improvise; never deliver it as an alert chip or
push.

## Lines that don't move

- Never "calories remaining", never exercise offsetting intake, never
  compensation prompts. Intake ↔ exercise coupling is banned.
- Never a smoke-free streak, day counter, or milestone celebration.
- Population ranges (BMI, NHS units, reference intakes) are opt-in, one caption
  line, never a coloured zone. Clinically meaningful sustained patterns are the
  alert component's job — once, factual, route to a GP.
- Never nag a rough entry toward precision.

## Accessibility (ship-blocking)

Contrast: primary text ≥ 7:1, secondary ≥ 4.5:1 in both themes. Meaning never
rides on colour alone — every domain is labelled, every mood tile has height
and a word, every band has numbers. All controls switch- and screen-reader-
operable; groups carry `accessibilityRole` and `accessibilityLabel`; toggles
expose `accessibilityState`. Reduced motion disables sweeps, tickers and
glow animation. ~1 in 12 men has a colour-vision deficiency: test every new
screen with a deuteranopia simulation before merge.

## Icons

Lucide, and only via the map in `tokens/icons.ts`. `strokeWidth 1.75`,
`absoluteStrokeWidth`, sizes 22 (tab) / 20 (tile) / 16 (inline). Chrome icons
in `ink2`; active tab in accent; icon tiles draw the icon in its domain colour
on a 22% tint of that colour. No filled variants, no emoji, no icons from
other sets. (If two-tone tiles are ever wanted, Phosphor duotone is the only
set worth the switch; not now.)

## Brand

The logotype is **"bro." set in Instrument Sans Bold** — the same face as the
app's large titles — at −4% tracking, with the full stop in the user's accent.
It ships outlined (no font dependency) in `brand/`. **`bro-icon-dark.svg` is
the primary app icon** (base `#0B0F14`, letters `ink`, dot Ice); the six
`bro-icon-dark-<preset>.svg` files are alternate icons, switched when the user
changes accent (`expo-alternate-app-icons`). Light variants exist for forced
light mode; the tinted variant is the monochrome basis; `bro-glyph.svg` is the
circular "b." for notifications and watch. The mark occupies 78% of the icon
width. Never recolour the letters, never re-set the name in another weight or
face, never add glow, outlines, shadows, gradients or taglines — glow is for
data, not brand. If the product is renamed, regenerate from the same recipe:
Instrument Sans Bold, −4% tracking, accent period.

The earlier drawn geometric mark is kept in `brand/drawn-mark-archive/` for
reference only; it is not in use.

## PR checklist

- [ ] Native tab bar / stack / sheets; Skia only for Dial, Terrain, figure; icons only from `tokens/icons.ts`.
- [ ] Zero hard-coded colours; accent only on interaction; domain only on data; domain constant per measurement.
- [ ] No verdict UI: no scores, streaks, coloured deltas, relative-percent chips, praise.
- [ ] Every metric shows band + marker + factual read; deltas absolute, in ink, signed.
- [ ] "Heading" not "goal"; heading rendered as notch/line and reported as fact.
- [ ] One hero per screen; one alert max.
- [ ] Lists are inset groups, not bordered cards; one quick-log FAB above the tab bar; save actions in title bars.
- [ ] Copy passes voice rules; protected lines intact.
- [ ] Reduced motion, contrast, deuteranopia checked in both themes.
