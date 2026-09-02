# bro — design rules

Design system name: **Baseline**. Product name: **bro** (always lowercase, no full
stop in text; the full stop appears only in the drawn logotype, where it carries the
user's accent colour).

This file is the authority for all UI work. When it conflicts with a component
library default, a framework convention, or your own instinct, this file wins.
Tokens live in `tokens/tokens.css` and `tokens/tokens.json`; use tokens, never
hard-coded values.

## Intent

bro is a mental and physical health tracker for men. The interface is **a quiet
instrument, not a coach**. It describes and asks; it never praises, scolds,
motivates, or celebrates. Every number is shown against the range that is normal
for this user, never against a target, a rival, or a streak.

## Hard rules (never break these)

1. **No hard-coded colors.** Every color comes from a token. Pure `#fff` and
   `#000` never appear anywhere, in either theme.
2. **Color has three separate jobs, never mixed:**
   - **Domain colors** (`--mind`, `--body`, `--sleep`, `--load`) say *what this
     measures*. They appear ONLY on data: gauge bands, chart series, row markers,
     status chips. Green means body, not good. Amber means load, not warning.
   - **Accent** (`--accent` family) says *you touched this*. It appears ONLY on
     interaction: primary buttons, selected states, focus rings, links, active
     tab. It NEVER appears on data, charts, or gauges.
   - **Alert** (`--alert`) appears at most once per screen, only for genuine
     health risk. Never for a missed log, a failed sync, or a validation error's
     decoration. It is never available as an accent.
3. **No judgement UI.** No scores out of 100, no grades, no traffic lights, no
   streaks, no confetti, no badges, no "great job". A missed day renders as a
   dashed outline, never a gap or a red mark.
4. **One big number per screen.** The 56px metric size appears at most once per
   screen. If two numbers compete for it, split the screen.
5. **Lines before shadows.** Elevation is exactly two levels — canvas and
   surface — separated by a 1px `--line` border. No drop shadows, no gradients,
   no glassmorphism, no blur decoration. Modals use a scrim of canvas at 55%.
6. **Logging never blocks.** Every input has a default, nothing is required, a
   half-finished entry saves. Never gate a save on a missing field.
7. **Serif for their words, sans for our numbers.** Anything the user writes or
   reads reflectively (journal entries, notes, check-in prose) is Source Serif 4
   at 17px. Anything measured or interactive is Archivo. Never swap them.
8. **Sentence case everywhere** — buttons, labels, headings, tabs. No ALL CAPS,
   no letter-spaced eyebrow labels, no Title Case Buttons.
9. **Motion is 160ms `cubic-bezier(.2,.6,.3,1)` and only responds to a tap.**
   The single exception: the gauge marker may slide to position on first load.
   Everything respects `prefers-reduced-motion`.
10. **The user's accent is a hue, not a hex.** See "Accent" below. Never store or
    accept a hex value for it.

## Color tokens

Neutrals (light): canvas `#E9E9E4`, surface `#F5F5F1`, surface-sunk `#E1E2DC`,
line `#D3D5CD`, line-strong `#B9BCB2`, ink `#23282B`, ink-2 `#5C6469`,
ink-3 `#8B9297`.

Neutrals (dark): canvas `#191C1E`, surface `#212528`, surface-sunk `#141719`,
line `#313739`, line-strong `#454C4F`, ink `#E4E5E1`, ink-2 `#A0A7AA`,
ink-3 `#767D81`.

Domains (light / dark):
- mind  `#4E6473` / `#86A3B5` — mood, stress, check-ins
- body  `#667F5B` / `#98AF8B` — heart, weight, movement
- sleep `#6F6A85` / `#A29BBB` — duration, timing, quality
- load  `#A0803F` / `#C7A96C` — training volume, strain
- alert `#93564A` / `#C08375` — genuine risk only

Each domain has a matching `-tint` for fills behind text (see tokens.css).
Domain color text is only placed on its own tint or on surface.

Text hierarchy: `--ink` for primary, `--ink-2` for secondary (passes 4.5:1),
`--ink-3` ONLY for 12px non-essential labels and never as the sole carrier of
meaning.

## Accent (user-chosen)

The user chooses a **hue** (integer 0–360, stored as `accentHue` on the user
record; default 235). Optionally a chroma for the Graphite preset. All accent
colors derive in OKLCH with lightness and chroma fixed by the system, so no
possible choice breaks contrast or leaves the muted range:

```css
/* light */
--accent:        oklch(48% var(--accent-c) var(--accent-h));
--accent-strong: oklch(41% var(--accent-c) var(--accent-h));  /* hover/pressed */
--accent-tint:   oklch(92% calc(var(--accent-c) * .42) var(--accent-h));
--accent-line:   oklch(78% calc(var(--accent-c) * .70) var(--accent-h));
--on-accent:     oklch(97% calc(var(--accent-c) * .15) var(--accent-h));
```

Dark mode flips lightness (78% base); see tokens.css. Presets: Harbour 235,
Moss 145, Brass 85, Clay 40, Plum 318, Teal 195, Graphite 250 with c=0.006.
All non-Graphite presets use c=0.055. To apply:
`document.documentElement.style.setProperty('--accent-h', hue)`.

Never: derive accent from a hex, offer a free color picker without the OKLCH
clamp, use accent on data, or allow a second accent.

## Typography

Families: `Archivo` (UI, weights 400/500/600/700) and `Source Serif 4`
(reflective text, 400/500). Fallbacks: system sans / Georgia.

Scale (px / weight / letter-spacing):
- metric 56 / 600 / -3.5% — tabular numerals, one per screen
- h1 40 / 600 / -2%
- h2 27 / 600 / -1.5%
- h3 21 / 600
- lead 17 serif / 400 — user words only, line-height 1.6
- body 15 / 400 — interface default, line-height 1.55
- small 13 / 400 — secondary detail
- caption 12 / 400 — units, axes, timestamps

All numerals displaying data use `font-variant-numeric: tabular-nums`.
Line length ≤ 68ch sans, ≤ 74ch serif.

## Space, shape, elevation

- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96. Nothing in between.
  Inside a component 4–16; between components 16–32; between sections 48–96.
- Radius is hierarchical: 3px chips/inputs/ticks, 6px buttons/fields,
  10px panels, pill only for switch-like toggles. Never one radius everywhere.
- Touch targets ≥ 44×44px.
- Focus ring: 2px solid `--accent`, 2px offset, both themes.

## Components

**Baseline gauge** (signature — default for any single metric):
value in metric type, unit in caption ink-3, a 1px rail with minor ticks, the
user's usual range as a band (domain color at 16% opacity with 1px solid domain
edges), a 2px domain-color marker with a diamond cap, min/max scale labels in
caption, and a one-line plain-language read, e.g. "Inside your usual range of
50–60 for the last 90 days." The read states fact, not verdict. If fewer than
~14 days of data exist, render the empty state instead of a fake band.

**Mood scale:** five buttons of increasing height (52→108px), labels
Low / Flat / Okay / Good / Sharp. Height encodes value so it works without
color; selection uses accent tint + border. Never emoji, never faces.

**Metric row:** 3px×22px domain-color bar on the left is the only color; name
in body, meta in small ink-3, value right-aligned tabular in ink. Rows separate
with 1px `--line`, hover fills `--surface-sunk`.

**Week strip:** 7 columns, bars in domain color on `--surface-sunk` tracks;
a day with no data is a dashed `--line-strong` outline, never red, never empty.

**Buttons:** primary = accent bg + on-accent text; secondary = 1px line-strong
border; quiet = ink-2 text only; danger = alert border + text, alert-tint on
hover (destructive actions only). Labels say what happens: "Save entry", not
"Submit". No arrows or icons appended to labels.

**Fields:** 1px line-strong border, 6px radius, focus = accent border + 3px
18%-accent ring. Helper text in caption. Error = alert border + alert helper
that says how to fix it ("Use a 24-hour time between 00:00 and 23:59"), never
just "Invalid". Free-text entry ("Anything worth remembering") is serif,
placeholder "Optional. One line is enough."

**Empty states:** dashed border panel, plain statement of what's missing and
why, one secondary button. Never apologetic, never cute.

**Alert callout:** 2px alert left border, alert-tint fill, factual sentence plus
possible causes plus a route to a real person (GP). Max one per screen.

**Body:** organise review by what a signal means, capture by how it is taken,
and treat manual/connected sources as provenance rather than navigation. The
overview uses compact baseline-change rows rather than promoting weight as the
definition of the body domain: Measurements contains weight, body fat, and tape
sites; Health & fitness contains sleep, steps, and resting heart rate. Each group
presents its rows inside one surface card. Tapping any row opens that metric's
detail screen. The detail screen uses the full baseline gauge inside its hero
card, with the one permitted 56px value.

- Measurements and Health & fitness each own their management action. Manage
  measurements controls weight, body fat, and tape sites; Manage health data
  controls manual tracking for resting heart rate and whether imported sleep
  and steps appear on Body. The latter is only a visibility choice: it never
  changes platform access or deletes imported data.
- Untracking a metric a connected platform supplies stops manual entry for it;
  the row stays, because the readings still arrive. Say so in the management
  sheet rather than leaving the control looking broken.
- Each group carries its own ink so the two cards are not one colour by
  accident: Measurements is `--body` throughout, and the Health & fitness
  signals take `--sleep` and `--load`. Body metrics are grouped in the registry,
  so state the domain from the group rather than inferring it from the slug.

- The shared quick-log FAB is available on the Body tab and offers Body as a
  destination. Its Body action replaces the content inside that same sheet with
  standalone weight, a measurement session, and standalone resting heart rate
  when each is tracked; sub-navigation never swaps to a second sheet. Do not put
  entry fields or a separate log button on the overview or beside every metric.
- A measurement session holds all tracked tape sites and body fat, with weight
  available when tracked. Every field is optional and one save writes whichever
  readings were taken at a shared capture time. Weight also remains available
  on its own because its cadence commonly differs.
- Manual and connected readings share one history. Always show source as
  secondary metadata. A deliberate manual reading supplies that day's value
  when an import for the same metric and day also exists; retain both readings
  and their provenance.
- Resting heart rate, not generic instantaneous heart rate, is the current
  fitness signal. It supports both manual entry in bpm and health-platform
  imports.
- A future progress photo may attach to a measurement session. It remains the
  user's record: never analyse it into a body score, reshape a figure from it,
  or use it as judgement UI.

**Measurements (tape sites):** tape sites join the compact baseline-change list,
never a selected-site hero, radar, polygon, or spider chart. Different units on
shared spokes manufacture a score, which is judgement UI.

- The measurements screen draws no body. A figure on the screen a man reads his
  own numbers on invites him to see a shape being scored, which is the trap the
  whole product avoids.
- Every tape-site row carries a compact baseline gauge: a hairline track, band
  tint, hollow `--body` circle for the previous reading, and filled circle for
  the current reading. Its signed delta is right-aligned in tabular `--ink`, and
  the comparison date stays on the row because sites may be taped on different
  schedules. Tapping the row opens that site's detail screen; overview taps
  never select or replace a separate hero. Deltas are never red/green and never
  carry praise or concern.
- The marks appear only once the metric has a usual range. The rail is scaled
  from the metric's own readings, so with two of them the marks land on the same
  two spots whatever the change was — a full-width traverse for a millimetre.
  The compact row carries no rail labels to correct that reading, so until there
  is a range, the row shows the bare track and states the change in figures.
  The full gauge, which prints its rail ends, has no such restriction.
- The hollow/filled legend is stated once per screen, on the first card that
  draws marks, and not at all when no row does. Repeating it per card makes two
  sibling groups read as two unrelated widgets.
- Row columns are proportional, never fixed pixel widths: a name, a compound
  delta ("+1 st 2 lb") and a scaled-up system font all have to survive. Only an
  imported reading names its source on a row — "you" is the assumption already,
  and spending the second line on it pushes out the comparison date, which is
  the part that differs per site. Full provenance belongs on the detail screen.
- Untracked sites do not render at all: no empty rows, no grey prompts, no
  "complete your profile". A site that is tracked but not yet taped keeps its
  row so it is included in the next measurement session.
- Weight and body fat are not tape sites. They use the same compact
  baseline-change row as tape sites; body fat still joins the measurement
  session.
- Population reference ranges (BMI, waist-to-height) are off by default,
  enabled only by explicit setting, rendered as a caption line of context and
  never as a colored zone on any gauge. A trend crossing a clinically
  meaningful threshold is the alert component's job (once, factual, route to
  a GP), not this screen's.
- Copy follows the Write/Never table; the trap specific to this screen is
  praise or concern disguised as neutrality. Write "1.5 cm down since
  3 August", never "Great progress!" or "You're in the healthy zone".

**Measuring guide (tailor's diagram):** the pattern-block figure lives on its own
"how to measure" page, reached from the measurement session's own link and from
the top-right ruler action on any tape-site detail page, which opens the guide on
that site. The session link is the one that matters: it is the moment the tape is
about to go round. It answers where the tape goes and nothing else — it carries
no readings, so no number a man has recorded is ever pinned to a drawing of a
body.

- The figure draws in `--line-strong` (it is chart paper, like the wheel's
  grid). It is the same fixed block for every user: never reshaped by his
  numbers, never resembling him, never rendering fat or muscle.
- Tape sites are horizontal lines at neck, chest, bicep, waist, hip, thigh, and
  every site is shown whether or not the user tracks it — this is reference, not
  his data. Unselected: 1.2px dashed `--ink-3` with `--ink-3` label. Selected:
  2px solid `--body` with end ticks and `--body` label. Tap targets ≥ 44px tall.
- Selecting a site states, in plain sentences, where to put the tape and how to
  hold it. Instructions, never technique coaching or a reason to measure.

## Voice

Describe, don't judge. Ask, don't cheer. Assume an adult who already knows he
skipped three days.

| Write | Never |
|---|---|
| An hour under your usual. | Poor sleep score: 41/100 |
| No entry for Tuesday. | You broke your 12-day streak! |
| How are you today? | Let's crush today's check-in 💪 |
| Save entry | Submit |
| That can follow illness, alcohol, or hard training. | You might be overtraining — take it easy, champ. |

No exclamation marks in UI copy. No emoji in UI copy. The product name is "bro",
lowercase, even at the start of a sentence; never "Bro.", "BRO", or "bro." in
prose.

Anything touching crisis or self-harm is out of scope for generated copy:
surface the clinician-approved flow, never improvise wording, never deliver it
as an alert chip or push notification.

## Accessibility (ship-blocking)

- Contrast: primary text ≥ 7:1, secondary ≥ 4.5:1, ink-3 restricted as above.
- Meaning never rides on color alone: every domain is labelled, every mood has
  height + word, every band has numbers beneath it.
- All controls keyboard-operable with visible focus; groups get `role="group"`
  and an `aria-label`; toggles use `aria-pressed`.
- `prefers-reduced-motion` disables the gauge entry animation and all
  transitions.
- Around 1 in 12 men has a color vision deficiency. Test every new screen with
  a deuteranopia simulation before merging.

## Brand assets (`brand/`)

- `bro-icon-light.svg`, `bro-icon-dark.svg`, `bro-icon-tinted.svg` — 1024
  app icons; draw on the plain square, the OS applies corner masking. Ship
  alternate icons per accent preset by recoloring only the dot.
- `bro-glyph.svg` — circular monochrome `b.` for notifications, favicon,
  watch.
- `bro-wordmark.svg` — the drawn wordmark; dot fill accepts
  `var(--accent, #4E6473)`.
- `bro-lockup.svg` — marketing lockup (wordmark over gauge rail). Needs
  ≥ 300px width; below that use the wordmark.
- Never recolor the letters, never typeset "bro" in Archivo in place of the
  drawn mark, never add outlines/shadows/gradients/taglines to the icon.
- Clear space around the mark = one bowl width (100 units) on all sides.

## For agents: checklist before opening a PR

- [ ] Zero hard-coded colors; all values are tokens.
- [ ] Accent appears only on interaction; domain colors only on data.
- [ ] No score/grade/streak/celebration UI introduced.
- [ ] At most one 56px metric and at most one alert per screen.
- [ ] New copy passes the Write/Never table; no exclamation marks or emoji.
- [ ] Spacing and radius values are on-scale.
- [ ] Keyboard + focus + reduced-motion verified; contrast checked both themes.
- [ ] No radar/polygon of body measurements; deltas uncolored; no population zones on gauges.
- [ ] No body figure on a screen that shows the user's own readings.
