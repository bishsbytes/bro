# bro — component spec (Helm)

Each component: what it is, the library it's built on, tokens, and the rules
specific to it. "Keep" = behaviour/copy from the existing build that must
survive. Reference renders: `reference/helm-components-from-bro.html`.

Stack: **React Native + Unistyles 3** (`tokens/unistyles.ts`), **Lucide**
(`tokens/icons.ts`), and these libraries for native feel:

| Need | Library |
|---|---|
| Native tab bar (Liquid Glass on iOS 26/27, M3 on Android) | `react-native-bottom-tabs` (`@bottom-tabs/react-navigation`) or Expo Router native tabs |
| Large collapsing titles, native stack | `@react-navigation/native-stack` with `headerLargeTitle` |
| Sheets with detents (system glass on iOS) | `react-native-screens` `presentation: 'formSheet'` + `sheetAllowedDetents`; `@gorhom/bottom-sheet` where custom content needs it |
| Blur/glass for custom surfaces | `expo-blur` (`BlurView`) |
| Dial, Terrain, tailor's figure | `@shopify/react-native-skia` |
| The wheel (radar) | `react-native-svg` or Skia |
| Springs, tickers, scrub | `react-native-reanimated` |
| Haptics | `expo-haptics` |
| Long lists | `@shopify/flash-list` |
| Swipe actions | `react-native-gesture-handler` `Swipeable` / `ReanimatedSwipeable` |

---

## Navigation

### Tab bar
- `react-native-bottom-tabs` so the OS draws the bar (glass on iOS, M3 on Android). Lucide icons at 22, `strokeWidth 1.75`.
- Four items, in order: Journal, Intake, Body, Life. Active item tinted with
  `accent`. No FAB anywhere in the app.
- "+" lives as a trailing toolbar item on Journal; Intake exposes a sheet
  handle above the tab bar.

### Large title with date navigation
- `native-stack` screen options: `headerLargeTitle: true`, `headerTransparent`,
  `headerBlurEffect` on iOS; `headerLargeTitleStyle` uses `type.largeTitle`.
- Subtitle line (weekday + date) in `caption ink3` above the title; human
  dates only ("Thursday 3 September"), never ISO.
- Day nav: two 34pt `surface2` buttons trailing; horizontal swipe on content
  also changes day. Disable "next" at today (35% opacity).

### Segmented control
- `@react-native-segmented-control/segmented-control` (native on iOS) or a Unistyles-styled pair with a Reanimated sliding thumb (`surface3`, radius 9).
- Use for Summary/Logged, Week/Month/Year, Item/Recipe, Food/Drink.

### Week strip
- Seven pressable cells in a `FlatList` paged horizontally by week
  (`pagingEnabled`, `horizontal`).
- Each cell: weekday `caption ink3`, day number `mono 15 ink2`, up to 3 domain
  dots (5px) for what was logged. Today: `surface2` tile with hairline-strong
  border, number in `accent`. Future days at 40%.
- Tap the month title for the calendar sheet.

### Bottom sheet (glass)
- `react-native-screens` `presentation: 'formSheet'` with
  `sheetAllowedDetents: [0.5, 1]` and `sheetGrabberVisible` (system glass on iOS);
  `@gorhom/bottom-sheet` with a `BlurView` background when the sheet holds
  custom interactive content (quick-log).
- Radius 28, grab handle 36×4 `hairline-strong`, one ambient shadow. Content
  beneath stays visible and dims 35%.

---

## Readings

### Dial (custom, ours)
- Skia `Canvas`: `Path.addArc` for track/band, `Circle` for the marker, `BlurMask` or `Shadow` for glow; `useSharedValue` drives the marker angle.
- Geometry: arc −135°…+135°, radius 78 in a 200 box; track 8pt (mini 6)
  `hairline-strong`, round caps; ticks every 15° from r−9 to r−13 `ink3` 60%.
- Band: domain colour 28% at track width + 1.5pt edge at 90% with 5pt glow.
- Marker: 7pt domain fill with 8pt glow, 3pt `base` core (mini 5/2).
- Heading notch: 2pt `ink` line from r+8 to r+15.
- Centre: value `mono 44/600 −4%` (mini 20), unit `sans 16 ink3`, label
  `caption ink2`. Scale min/max in `mono 10 ink3` at the arc ends (full only).
- Animation: marker sweeps from arc start with `withSpring(target,
  theme.motion.spring)` on first appearance only; skip when
  `AccessibilityInfo.isReduceMotionEnabled()`.
- Never a closing ring, never a percent-complete.

### Measurement hero (rail)
- Used on detail screens and inside lists; the Dial is the tab-level hero.
- Value `mono 56/600 −5%`; label `caption ink2` with source trailing
  (`Health Connect · today`).
- Rail 18pt: hairline track, minor ticks (10% intervals) `ink3` 60%, band =
  domain 20% with 1pt edges and inner glow, marker = 2pt domain with diamond
  cap and glow, previous = 1pt dashed domain at 60%, heading = notch below rail.
- Scale labels `mono 11 ink3`. Read sentence `body ink2` with the band in
  `ink`: "Outside your usual **53–57**. 1 bpm up since yesterday."
- Keep: the read sentence structure exactly. Fix: domain colour must match the
  measurement's domain (RHR = body, never load).

### Terrain (custom, ours)
- Skia: `Path` for area and line, `LinearGradient` shader for the fade, a
  tiled hatch via `ImageShader` or a `RuntimeShader`, `BlurMask` glow on the line.
- 30-day default window. Corridor (usual range) in `surface3` 80%; area fill
  domain gradient 35%→0 plus 6pt −20° hatch at 22%; line 2pt with 5pt glow;
  no per-point dots; current point 4pt dot; heading 1pt dashed `ink` 80% with
  `mono 9` label; corridor bounds `mono 9 ink3`.
- Scrub: `Gesture.Pan()` from gesture-handler updates a shared value that
  drives both the hairline and the hero text (`useAnimatedProps` / `ReText`);
  `Haptics.selectionAsync()` on day change.

### Since-last-time row (dumbbell)
- List row: name `body ink`, meta `caption ink3` ("Health Connect · yesterday"),
  dumbbell (130pt max): hairline track, band 20% domain, hollow previous
  (8pt, 1.5pt domain, 70%), filled now (9pt domain with 6pt glow), delta
  `mono 13 ink` right-aligned, signed, absolute units.
- Keep: "○ then · ● now" legend once per list. Never colour the delta.

### Day summary list (past day)
- One inset list; per row name, sentence delta ("1.5 points higher than
  Tuesday"), value `mono 18/600 ink` right. Domain marker is the only colour.
- Never coloured change chips, never relative percentages, never arrows.
- Name the day ("than Tuesday"), not "previous day".

### History list
- Rows: value `mono 15/500`, meta `caption ink3` "Thu 3 Sep · Health Connect ·
  **used for this day**" (the marker in accent). Read-only note is a footer line.

### Summary readouts (Intake)
- Card with stacked readouts: label `caption ink2` + "so far today" `ink3`;
  value `mono 30/600` with unit `13 ink3`. Footer lines verbatim:
  "A usual range appears once a total has 14 logged days." and "Totals are
  stated without targets, allowances, or ratings."
- After 14 days a compact rail appears under each readout. Alcohol and
  cigarettes use the bimodal read.

---

## Logging

### Log sheet ("What would you like to log?")
- Glass sheet, title `19/600`, five rows Note / Food / Drink / Body / Check-in
  with 34pt icon tiles in the domain tint, one-line descriptions (keep copy).
- Long-press the "+" toolbar item to skip the sheet and repeat the last log.

### Quick-log sheet
- Recents as chips ranked by time of day (chip = `surface2`, selected = accent
  fill); stepper 52pt buttons `surface2` radius 16, value `mono 34/600` with
  unit; When: Now/Earlier segmented; primary "Log it" full width.
- "Or log it rough": single text field + secondary "Log roughly". Rough
  values render with `~` and propagate as a soft range band on gauges.

### Entry row with swipe
- Row: time `mono 12 ink3` (40pt), name `15/500`, meta `caption ink3`
  ("2 × pint"), values right `mono 12 ink2` on up to two lines.
- `ReanimatedSwipeable` with a leading "Again" action in accent. Logs the
  same item now; `Haptics.notificationAsync(Success)`.
- Repeat items at one sitting group into a single row.

### New library item form
- Inset grouped sections (`surface1`, radius 20) of inline rows; `TextInput` right-aligned inside the row, `inputMode="decimal"` for numbers.
- Section 1: Name (required), Kind (Food/Drink mini segmented), Brand
  (placeholder "Optional"), Portion (placeholder "serving, pot, tablet"),
  ABV `%` (drinks only). Section 2 "Per <portion>": Energy kcal, Protein g,
  Carbohydrate g, Fat g — inline rows, mono values right-aligned, placeholder
  "—". Footer: "Enter at least one value." and, for drinks, "Units: 2.6 per
  pint, worked out from ABV."
- Save is `headerRight` on the native stack header, never a bottom button.

### Recipe builder
- "Makes N <pots>" stepper at top; ingredients picked from the library as
  rows (name + quantity mono); per-portion readout recalculates on N change;
  roughness of any ingredient makes the per-portion value `~`. "Log 1 pot"
  primary.

---

## Check-ins

### Flow chrome
- Top bar: Close/Back `body ink2` leading, "1 of 3" `mono 12 ink3` centre,
  Finish `accent 600` trailing. Step dots 6pt (`accent` when done). Steps are
  pages in `react-native-pager-view`; Back/Finish remain for reach.
- Footer line "Nothing is saved until you finish." on multi-step reviews.
- Skip as quiet `ink3` text under the control.

### Mood scale (rising tiles)
- Five `Pressable` tiles, heights 56/70/84/98/112, `surface2`, radius 12,
  labels Low / Flat / Okay / Good / Sharp `15/500 ink2`; chosen = accent fill,
  `onAccent` text, glow via `shadowColor: accent, shadowRadius: 18` (iOS) /
  a Skia backdrop (Android); `Haptics.selectionAsync()`. End labels "Very bad / Very good"
  `caption ink3`.
- Height encodes value; never emoji, never faces.

### Numbered scale (1–5)
- Same rising tiles with `mono 18/600` numerals. End labels per question
  ("Not productive / Very productive"). Same selection treatment.

### 1–10 review step (Life)
- Large `mono 64/600 −6%` number in accent as the object; tick scale beneath
  with the chosen tick 3pt accent with glow; drag with haptic detents. Keep
  "1 is as low as it gets, 10 is as good as it gets."

### Check-in tiles (Journal)
- Two tiles Morning / Evening (`surface1` cards, radius 20). Pending: title,
  hint line, accent text action "Check in". Done: border tinted `mind` 40%,
  "Checked in 07:48", his words in serif ("Okay · rested"), action text `ink3`.

### Prompt cards (routine, take stock)
- `surface1` card; title `15/600`, body `caption ink2`, accent text action.
  At most one visible on Journal; dismissible; twice-dismissed never returns.
  Keep copy verbatim.

---

## Life

### The wheel (radar)
- `react-native-svg` `Polygon`s. Eight axes; rings at 2.5/5/7.5/10 `hairline-strong`;
  spokes `hairline`; previous review 1.5pt dashed `mind` 55%; this review
  2.5pt `mind` with 14% fill, 8pt glow, 3pt vertex dots; labels `caption ink3`
  or platform symbols at r×1.23.
- Animates from centre on first appearance (Reanimated spring on a scale
  shared value). Tap a vertex → scroll to that area's row. Legend: solid "This review", dashed "Previous".

### Life area row
- Card: 30pt icon tile `surface2`, name `15/500`, "Focus" tag (`accentDeep`
  pill), score `mono 22/600` with `/10` in `ink3`. Follow-ups as quiet
  `surface2` rows: **Set a heading for X**, Read "…", Add habit "…". Never a
  bordered button inside the card.

---

## Headings

### Heading card + sheet
- Card `surface1`: label "Heading" `caption ink3` + "your words"; sentence in
  serif 21 ("Resting under 49 *by the new year.*"); meta row `mono` Now /
  Heading / By; bearing line: "On the last 90 days you'd get there around
  mid-December."
- Tap opens a sheet: a text field (serif) that parses number and date, plus
  explicit number/date rows as fallback. Save in toolbar.
- Renders as a notch on the Dial/rail and a dashed line on Terrain. The app
  never colours it, moves it, or comments beyond bearing. UI word is
  "heading"; "goal" and "target" do not appear.

---

## Body

### Tailor's figure (custom, ours)
- Skia `Path` from the pattern-block SVG string (see reference): stroke 11
  `surface3`, round caps/joins. Sites: neck 86, chest 150, bicep 178 (left
  arm), waist 205, hip 262, thigh 345 in a 380×470 box. Leaders `hairline`,
  labels `caption ink3`, values `mono 11 ink2`; selected site: 2pt `body`
  tape with end ticks and 6pt glow, label `body 600`, value `ink`.
- Sites shown = sites ticked in the Measurement picker. Weight/body fat are
  not sites (mini Dials above the figure).
- Tap a site → its rail hero below; long-press → tape entry sheet.

### Measurement picker (sheet)
- Rows with trailing 22pt tick (`Check` icon on accent fill when on). Platform-supplied rows
  say "from Health Connect" inline and are locked on. Keep the rule copy.

---

## Settings

### Grouped settings list
- `SectionList` with section wrappers styled as inset groups (`surface1`, radius 20, hairline separators).
  Rows: title `15`, description `caption ink3`, trailing value (`ink2`, with a
  12pt accent swatch on Appearance: "Dark · Ice"), chevron `ink3`.
- Stream toggles: RN `Switch` with `trackColor.true = accent`. No "Open
  intake" button in settings.

### Account block
- `surface1` card: "Using bro without an account" `15/600`; "Your data stays
  on this device." `caption ink2`; the account caveat `footnote ink3`; two
  side-by-side buttons Sign in (primary) / Create account (secondary).

---

## Buttons and fields

- Primary: accent fill, `onAccent` text, radius 14, 13pt vertical padding,
  `15/600`. Secondary: `surface2` with hairline-strong border. Quiet: `ink2`
  text. Danger: `alert` text, used only for destructive actions.
- Text actions inside cards/tiles are `accent 600` text, not buttons.
- Fields: inline rows in grouped lists; label left, value right, mono for
  numbers, unit trailing in `mono 13 ink3`. Errors state how to fix, in
  `alert` text under the row; never just "Invalid".
- Stepper: 52pt `surface2` buttons radius 16 flanking a `mono 34/600` value.
- Chips: radius pill, `surface2` + hairline; selected = accent fill.
