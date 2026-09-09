# Grounded Editorial in the Expo app

Use the September 2026 guide and JSON tokens, with the current component contracts below taking precedence over the original screen studies. Runtime styles come from `apps/app/src/theme/unistyles.ts`. Components import that module so Unistyles is configured before route evaluation. Use bundled Caladea Regular for display and page titles and Caladea Regular for notes (both editing and reading), with bold and italic for note formatting, and platform sans for section headings, interface text and tabular readings. Bundle Caladea regular, italic and bold; Instrument Serif, Instrument Sans and Geist Mono are retired. The `mono*` roles resolve to tabular sans. The palette is fixed, so the user-selectable OKLCH accent and its stored hue are gone; the brand and Log colours are the only accents.

System / Light / Dark resolves through `DeviceSettingsProvider`, before the splash hides. Native tab and stack navigation remains in place. Picker and sheet styles resolve from the same theme. Do not remount screens to change appearance.

Sub-screen navigation headers use a centred uppercase `eyebrow` title: platform sans, 12/16 medium with 0.6-point letter spacing. `stackScreenOptions` applies this to every native stack, with large-title expansion disabled; routes supply only their translated or dynamic title and contextual actions. Keep source strings naturally cased and let typography apply uppercase. `FormSheet` uses the same title role and centres it between balanced action slots. These titles announce a heading. Main tabs retain their editorial page titles, and check-in/review step flows retain their purpose-built progress headers and question headings.

Light appearance uses an off-white canvas (`#FFFDFA`) and darker warm stone cards (`#F4F1EB`), matching the screen studies. Choices, option rows and header actions resting on a card take `surface2` (`#EDE9E1`) and primary-ink pressed controls take `surfaceSunk` (`#E2DCD0`). Rows with metadata use `rowPressed` (aliased to `surface2`) so secondary text remains readable throughout a press. The separate surface steps prevent controls from disappearing into the card beneath them. Muted text may rest on `surface2`, never on `surfaceSunk`. Each tab owns its header through `components/tab-screen.tsx`, so the title and actions switch with the native page. Custom app headers use 24-point horizontal insets and 8-point vertical padding on every tab, inside the top safe area. Check-in headers use 24-point horizontal insets, 16 points above and 12 below. Keep header action touch targets at least 48 points and allow editorial titles the full width below the date/action row. Both header layouts announce their title as a heading. Scroll content on the four tabs clears the floating log action through `theme.control.fabClearance`, which is derived from the button height rather than repeated per screen.

Day tiles have subtle borders inside their spacing; the full tile area remains tappable. Header action surfaces are borderless 40-point circles inside 48-point touch targets. Factor chips have 12-point corners and a 40-point visual height inside a minimum 48-point touch target; allow growth for larger text. Unselected chips are transparent with faint outlines; selected chips use the soft selection tint and a checkmark without a contrasting border.

Check-in choices are borderless surfaces with a brand fill and checkmark for selection. The mood question leads directly into the choices without a supporting caption.

The header date, check-in card sitting names and check-in screen sitting label use the shared uppercase eyebrow style: 12-point type, 16-point line height and light letter spacing. Apply casing through typography so the translated source text retains its natural casing.

## Component contracts

Bottom sheets use left-aligned, sentence-case `SectionHeader` titles (20/26 semibold sans). Compact pickers and management sheets share this treatment; full-height forms retain their centred uppercase navigation header. `ModalSheet` uses the same 24-point handle area, 16-point content top/horizontal padding and 16-point section gaps on native and web, with bottom safe-area padding. Picker titles and supporting copy are grouped with an 8-point gap.

`OptionSheet` and `OptionRow` provide the shared outlined choices: 52-point minimum height, 12-point corners and padding, 8-point gaps, raised neutral fill, and soft selection tint with a brand outline and indicator. Radios mean one choice; checkboxes mean multiple choices; immediate on/off settings retain switches. Single-choice selection dismisses the sheet. Multiple-choice changes apply immediately and keep it open; Done dismisses without saving again and is disabled during a write. Unit pickers select the effective unit and label an inherited value as Device default or Default, without writing an override merely by opening the picker.

Buttons use fully rounded ends (`theme.radius.pill`) across primary, secondary, destructive and text variants. Secondary buttons use the app background (`theme.colors.background`) in both appearances, with the strong outline and neutral label. Reuse `components/button.tsx` for labelled actions and inherit its radius instead of overriding it per screen. Custom compact action buttons use the same pill token; square icon actions are circular. Cards, fields, selectable rows and factor chips retain their own shape tokens.

Use `Button` for submissions, cancellation, destructive actions and state-changing commands; use `TextAction` for quiet navigation and disclosures. Both use the 14/20 medium label role. Buttons keep their 52-point minimum; quiet links and icon actions keep a 48-point minimum. `opacity.pressed` is shared action feedback, distinct from `opacity.disabled`.

The featured Journal `CheckInCard` and Intake’s “Add to your day” invitation are each one tappable card. Both reuse `CardActionCue` for the inset label and chevron: stone fill, brand text, pill ends and a 48-point minimum height. The cue is decorative; the whole card owns the action and its accessibility label. Do not add a nested button or a second accessibility action. Intake’s invitation keeps its Today-only visibility and carries the displayed day into logging.

`Card` groups standalone content on a stone surface (`surface1`) without a border. Body's lead measurement and Life's wheel use this same treatment. Featured invitations may use the brand fill. Continuous lists use dividers instead of a surface per record. `ListRow` chooses `layout` (`stacked` / `inline`), `variant` (`filled` / `plain` / `outlined`), `density` (`regular` / `compact`) and `separator` independently. The last row omits its separator. Row presses use `rowPressed`; selection tint is reserved for persistent selection or named status.

Use `SegmentedControl` for fixed single-value choices and chart ranges. Its visible track and selected segment share FactorChip’s 40-point minimum height (`factorChipVisualHeight`), centred inside 48-point touch targets. Let both grow for wrapping labels and larger text. Its `role="tab"` mode changes content with tab semantics; ordinary choices use radios. Use `FactorChip` for wrapping filters and optional/multiple choices, including habit areas and weekdays. Preserve each screen's existing selection logic. Chips grow or wrap for long labels and larger text, with at least 48-point touch targets and a selected checkmark.

Sibling sections use `SectionHeader` with 20/26 semibold sans, or the explicit compact 16/22 semibold variant for dense Body sections. `contentTitle` is the 18/22 semibold sans role for practice names and other content titles; numeric `mono*` roles are for readings. Measurement and Intake quantity inputs share `monoList` (18/22 semibold tabular sans), including every part of compound units. Readout size comes from the selected typography role rather than a local font-size override. Form boundaries use `interactiveBorder`, focus uses brand, and errors use alert in both appearances and on web.

Paths below are relative to `apps/app/src`.

| Contract | Implementation |
| --- | --- |
| C01 AppScaffold | `components/screen.tsx`, `app/(tabs)/_layout.tsx` |
| C02 ScreenHeader | `components/app-header.tsx` for tabs; `theme/unistyles.ts`’s `stackScreenOptions` for centred uppercase sub-screen titles; `components/form-sheet.tsx` for full-height forms; `components/section-header.tsx` for content sections |
| C03 DateStrip | `components/week-strip.tsx` for Journal; Intake uses its day switcher |
| C04 BottomNavigation | `app/(tabs)/_layout.tsx`, Expo native tabs |
| C05 LogAction | `components/quick-log-fab.tsx`, `components/log-date-context.tsx` |
| C06 Button | `components/button.tsx` |
| C07 IconButton | `components/header-icon-button.tsx` and existing named row actions |
| C08 SelectableRow | `components/score-row.tsx`; five equally sized options, borderless on `surface2` |
| C09 FactorChip | `components/factor-chip.tsx`; Journal factors, Intake filters, habit areas and weekdays |
| C10 SegmentedControl | `components/segmented-control.tsx`; Body and Insights ranges, Intake day tabs and item types |
| C11 FormField | `components/form-field.tsx`, date/time and markdown fields |
| C12 QuantityField | `components/measurement-field.tsx`, `screens/intake/intake-quantity-field.tsx` |
| C13 DetailRow | `components/list-row.tsx`, `screens/intake/intake-rows.tsx` |
| C14 FeedbackBanner | `components/log-confirmation-toast.tsx` and inline errors |
| C15 CheckInCard | `components/check-in-card.tsx`; Journal sittings compose it |
| C16 CheckInStepper | `screens/check-in/check-in-screen.tsx`; device-local drafts are separate from observations |
| C17 IntakeRow | `screens/intake/intake-rows.tsx`, `screens/intake/recent-intake-row.tsx` |
| C18 SourceStamp | Body reading metadata and exact history rows; Intake entry details |
| C19 MeasurementCard | `screens/body/body-baseline-gauge.tsx` and Body overview/detail cards |
| C20 RecentRange | `components/baseline-gauge.tsx`; existing middle-half calculation retained |
| C21 TrendChart | `components/trend-chart.tsx`; SVG from actual series, missing-day gaps and readings list |
| C22 LifeWheel | `components/wheel-chart.tsx`; actual snapshot order/labels, current solid and previous dashed |
| C23 LifeAreaRow | `components/life-area-row.tsx`; the wheel's named-value alternative on Life and `screens/review/review-result-screen.tsx` |
| C24 HeadingCard | `screens/life/heading-card.tsx`; `screens/life/heading-detail-screen.tsx`; existing Body Heading cards |
| C25 PracticeRow | `components/practice-row.tsx`, `screens/habits/`, a heading's own practices |
| C26 ReadingsList | Body history and TrendChart's text alternative |
| C27 ManagementRow | Existing Body management and `screens/life/life-areas-screen.tsx` |
| C28 ActionSheet | `components/modal-sheet.tsx`, quick log and existing option sheets |

## Data and interaction boundaries

The current five-point mood labels remain Low / Flat / Okay / Good / Very good. Energy and Motivation retain their numeric points and existing endpoint descriptions; the image board's intermediate words are not used to relabel historical answers. Optional metrics remain configurable rather than forcing exactly three steps.

A check-in draft is stored per sitting on this device, with its date and existing record ID. Choosing a score advances after the shared motion duration (immediately with reduced motion), with selection fill, checkmark and haptic feedback. Back and Close cancel a pending advance. Skip moves past an optional category while retaining any existing answer. Finishing the last category writes the existing atomic check-in transaction; a failed write keeps the draft and offers retry. The done page contains the optional dated journal-note action. Discard removes only the draft; deletion of local product data removes drafts as well. Partial status derives from unanswered configured dimensions, without introducing a new record schema.

Recent intake rows edit on tap and repeat via a separate named plus action. The displayed quantity and portion are the repeat amount. Local write success is retained if refreshing the list fails. Undo removes the event just created, without deleting its reusable item. Existing mass/volume/portion conversion and unknown-nutrition rules remain authoritative.

The ten supporting screen studies are mapped onto existing destinations and forms. Illustrative custom-metric schemas, reusable-item switches and new archive models are not inferred from the boards. The existing storage and supported actions remain authoritative.

Heading fields were confirmed in September 2026 and the record now carries them. A heading has a name, an optional intent, an optional life area, a start date, an optional target date and an optional reason. It is measurable or qualitative and never half of each: a measurable heading carries `metricSlug`, `direction` and `targetValue` together and reads its progress from that metric's own records; a qualitative one carries none of the three and only its owner says how it is going. Editing changes the words, the area and the dates; what a heading is measured against is fixed where it is created — from a review focus area, a body measurement or an intake metric — so an edit cannot move the target the recorded progress was measured towards. Archive and remove keep the record and both say what they do before they are pressed; neither deletes anything.

## Verification

Run the app and database-app Nx tests, relevant typecheck/lint targets, and repo-wide `pnpm biome check .`. Check a narrow viewport and both appearances; validate large text, keyboard exposure, VoiceOver/TalkBack and native picker/sheet behaviour on devices before release.

Intake opens on the daily entries, with totals available under Summary. Search keeps its custom-entry action above the bottom safe area. Amount and custom-entry forms use full-height modals with a Close header, scrolling content and pinned actions above the keyboard and bottom safe area. They reuse decimal quantity fields with inline units; supported portion/mass/volume changes use the existing composition metadata and preserve the consumed amount. Date and time appear as detail rows backed by native pickers (browser inputs on web); saving uses the displayed timestamp. Custom nutrition remains explicitly per portion and requires at least one known value under the current store contract; reusable items remain managed through Your library.

Food artwork lives in `apps/app/assets/intake/`, with the generation prompts and mapping policy in its README. Transparent illustrations are bundled for offline use, matched to stable system keys or exact unbranded local dish names, and never supply nutrition. Other items keep a neutral icon.

Life leads with the wheel as one dated card, carrying its own Open latest review action, with Manage life areas as a quiet link beneath it. Focus areas and the review detail share `LifeAreaRow`, so a score is always readable as a named value beside its bar. The review detail keeps the chart for reviews the Life tab no longer leads with, and drops the chart's own value toggle where the rows below already list them. Its title names whether the review is the latest one, and it links back to the review before it rather than only to the list.

A heading opens its own screen from the Life tab and from the review index: its name, state, aim, dates and reason, the practices filed under its life area with their recent completions, and the edit, archive and remove actions. Editing and creating share one full-height form sheet. The practices and their activity are the same habit records the habit surfaces show, and marking one done there writes the same completion.

Intake places the day switcher at the top, with no week strip. The “Add to your day” invitation card appears only on Today, below the switcher.

Body uses the shared `FormSheet`, `EventWhenFields`, `MeasurementField`, `SourceStamp`, `SegmentedControl` and `ListRow`. The overview leads with an available reading, complete units and source; the overview previews the last seven days, and measurement details offer Week / Month / Year windows and a pinned Add reading action. Compact history rows open manual records for editing and imported records for source details; imported daily values remain read-only and show their day rather than an invented sensor time. The recent-range explanation retains the middle-half calculation over 180 days and reports the valid reading count. Management switches preserve the existing tracking/import visibility policy and link to the existing unit preferences. Notes, custom metric creation and reordering are not added by this visual pass.

Body uses `ListRow`’s inline layout, compact section headers and `TextAction` for quiet navigation links. The stone-filled, borderless overview card places the reading and source above the chart, with the recent-range legend below. `TrendChartPlot` draws readable axes and actual reading dots, breaks lines at missing days, and gives narrow ranges some headroom. Heading management opens from the compact summary so History stays within reach. The Body Log action sits at the right above the native tabs.

## Screen composition

Journal and the intake log are orchestrators, not layouts. Each holds its state,
effects and store calls, and composes sections that live beside it:
`screens/home/` has the sittings, factors, notes, routines and past-day
sections; `screens/intake/` has the browse surface, the two form sheets and the
recent row. Shared shapes (C09, C15, C25) are in `components/` so any screen can
reach them. Keep new screen surfaces this way rather than growing a single file.

## Token discipline

One name per value. The spacing scale is `xs sm md lg xl xxl huge`, with `gutter` aliased to `xl` so the page inset cannot drift from the step it is. The radius scale is `xs md lg pill`, with `chip`, `control` and `card` aliased onto it, plus `sheet`. Type roles are `largeTitle title section sectionCompact contentTitle body caption footnote monoHero monoDial monoReadout monoList monoInline serifQuote lead label eyebrow`; the earlier parallel names (`display`, `score`, `metric`, `micro`, `face`) are retired. `apps/app/src/theme.test.ts` holds the palette to its contrast floors and requires every stacked surface to stay distinct within a theme.
