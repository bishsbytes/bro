# Grounded Editorial in the Expo app

Use the September 2026 guide and JSON tokens. Runtime styles come from `apps/app/src/theme/unistyles.ts`. Components import that module so Unistyles is configured before route evaluation. Reuse the bundled Instrument Serif for headings and platform sans for interface text and tabular readings. Existing legacy `mono*` roles now resolve to tabular sans; stored accent preferences are retained for compatibility, while current UI uses the fixed brand and Log colours.

System / Light / Dark resolves through `DeviceSettingsProvider`, before the splash hides. Native tab and stack navigation remains in place. Picker and sheet styles resolve from the same theme. Do not remount screens to change appearance.

Light appearance uses an off-white canvas (`#FFFDFA`) and darker warm stone cards and controls (`#F4F1EB`), matching the screen studies. Custom app and check-in headers use 24-point horizontal insets, 16 points above and 12 below, inside the top safe area. Keep header actions at least 48 points and allow editorial titles the full width below the date/action row.

Day tiles have subtle borders inside their spacing; the full tile area remains tappable. Header action surfaces are borderless circles. Factor chips have 12-point corners and a 40-point visual height inside a minimum 48-point touch target; allow growth for larger text. Unselected chips are transparent with faint outlines; selected chips use the soft selection tint and a checkmark without a contrasting border.

Check-in choices are borderless surfaces with a brand fill and checkmark for selection. The mood question leads directly into the choices without a supporting caption.

The header date, check-in card sitting names and check-in screen sitting label use the shared uppercase eyebrow style: 12-point type, 16-point line height and light letter spacing. Apply casing through typography so the translated source text retains its natural casing.

## Component contracts

Paths below are relative to `apps/app/src`.

| Contract | Implementation |
| --- | --- |
| C01 AppScaffold | `components/screen.tsx`, `app/(tabs)/_layout.tsx` |
| C02 ScreenHeader | `components/app-header.tsx`, `components/section-header.tsx`, native stack options |
| C03 DateStrip | `components/week-strip.tsx` for Journal; Intake uses its day switcher |
| C04 BottomNavigation | `app/(tabs)/_layout.tsx`, Expo native tabs |
| C05 LogAction | `components/quick-log-fab.tsx`, `components/log-date-context.tsx` |
| C06 Button | `components/button.tsx` |
| C07 IconButton | `components/header-icon-button.tsx` and existing named row actions |
| C08 SelectableRow | `components/score-row.tsx`; five equally sized options |
| C09 FactorChip | `screens/home/home-screen.tsx` |
| C10 SegmentedControl | Existing Intake filters, quantity choices and `components/option-row.tsx` |
| C11 FormField | `components/form-field.tsx`, date/time and markdown fields |
| C12 QuantityField | `components/measurement-field.tsx`, `screens/intake/intake-quantity-field.tsx` |
| C13 DetailRow | `components/list-row.tsx`, `screens/intake/intake-rows.tsx` |
| C14 FeedbackBanner | `components/log-confirmation-toast.tsx` and inline errors |
| C15 CheckInCard | Journal sitting cards in `screens/home/home-screen.tsx` |
| C16 CheckInStepper | `screens/check-in/check-in-screen.tsx`; device-local drafts are separate from observations |
| C17 IntakeRow | `screens/intake/intake-rows.tsx`, recent rows in `intake-log-screen.tsx` |
| C18 SourceStamp | Body reading metadata and exact history rows; Intake entry details |
| C19 MeasurementCard | `screens/body/body-baseline-gauge.tsx` and Body overview/detail cards |
| C20 RecentRange | `components/baseline-gauge.tsx`; existing middle-half calculation retained |
| C21 TrendChart | `components/trend-chart.tsx`; SVG from actual series, missing-day gaps and readings list |
| C22 LifeWheel | `components/wheel-chart.tsx`; actual snapshot order/labels, current solid and previous dashed |
| C23 LifeAreaRow | Wheel's named-value alternative and `screens/review/review-result-screen.tsx` |
| C24 HeadingCard | Existing Body, Life and review Heading cards |
| C25 PracticeRow | Existing habit rows and `screens/habits/` |
| C26 ReadingsList | Body history and TrendChart's text alternative |
| C27 ManagementRow | Existing Body management and `screens/life/life-areas-screen.tsx` |
| C28 ActionSheet | `components/modal-sheet.tsx`, quick log and existing option sheets |

## Data and interaction boundaries

The current five-point mood labels remain Low / Flat / Okay / Good / Very good. Energy and Motivation retain their numeric points and existing endpoint descriptions; the image board's intermediate words are not used to relabel historical answers. Optional metrics remain configurable rather than forcing exactly three steps.

A check-in draft is stored per sitting on this device, with its date and existing record ID. Continue never commits it. Explicit save writes the existing atomic check-in transaction. Discard removes only the draft; deletion of local product data removes drafts as well. Partial status derives from unanswered configured dimensions, without introducing a new record schema.

Recent intake rows edit on tap and repeat via a separate named plus action. The displayed quantity and portion are the repeat amount. Local write success is retained if refreshing the list fails. Undo removes the event just created, without deleting its reusable item. Existing mass/volume/portion conversion and unknown-nutrition rules remain authoritative.

The ten supporting screen studies are mapped onto existing destinations and forms. Illustrative custom-metric schemas, qualitative Heading fields, reusable-item switches and new archive models are not inferred from the boards. The existing storage and supported actions remain authoritative.

## Verification

Run the app and database-app Nx tests, relevant typecheck/lint targets, and repo-wide `pnpm biome check .`. Check a narrow viewport and both appearances; validate large text, keyboard exposure, VoiceOver/TalkBack and native picker/sheet behaviour on devices before release.

Intake opens on the daily entries, with totals available under Summary. Search keeps its custom-entry action above the bottom safe area. Amount and custom-entry forms use full-height modals with a Close header, scrolling content and pinned actions above the keyboard and bottom safe area. They reuse decimal quantity fields with inline units; supported portion/mass/volume changes use the existing composition metadata and preserve the consumed amount. Date and time appear as detail rows backed by native pickers (browser inputs on web); saving uses the displayed timestamp. Custom nutrition remains explicitly per portion and requires at least one known value under the current store contract; reusable items remain managed through Your library.

Food artwork lives in `apps/app/assets/intake/`, with the generation prompts and mapping policy in its README. Transparent illustrations are bundled for offline use, matched to stable system keys or exact unbranded local dish names, and never supply nutrition. Other items keep a neutral icon.

Intake places the day switcher at the top, with no week strip. The “Add to your day” invitation card appears only on Today, below the switcher.
