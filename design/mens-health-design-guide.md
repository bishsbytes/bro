# Grounded Editorial: current screens and components

Selected direction, expanded 7 September 2026. Dark appearance extension included at the end. This revision applies Grounded Editorial to Journal, Intake, Body and Life. The sixteen screen studies contain six direct redesigns and ten proposed supporting views.


## Grounded Editorial. Across your app.

Your current screens and components, brought together as one coherent men's health app.

16 screen studies · 28 component contracts · Journal / Intake / Body / Life. The four imagegen boards are embedded in the PDF.


## Apply the direction to what you have

### The navigation for this expansion

**Journal / Intake / Body / Life**, in the same order as the current screenshots. Journal keeps the daily entry point. Intake keeps its dedicated tab. The labelled + Log action is a proposed visual refinement of your existing add button.

### The concepts that remain familiar

Keep morning/evening check-ins; mood, energy and motivation; factor groups; recent intake; custom entries; measurements and personal ranges; life areas and reviews; Headings; and practices. "Heading" stays visible so the handoff maps directly to the present product.

### How to read the screen studies

Six views redesign screens you supplied. Ten supporting views are proposals derived from visible actions and content. A "Manage measurements" link proves that the action exists; it does not reveal the exact fields in its current destination. Proposed view fields need a product/code check before implementation.

### The consistent visual rules

Off-white canvas, darker warm stone surfaces, strong ink, deep teal selection and primary actions, restrained clay for + Log. Serif titles establish character; sans-serif controls, supporting text and measurements establish clarity. Use space and dividers to group content.

### What the evidence covers

This pass uses the six original screenshots and the selected Grounded Editorial board. It is a visual and interaction specification, not a repository audit or a running prototype. Existing component names, routes and backend schemas were not supplied. The contract names in this guide are proposed design names.

### What supersedes the earlier exploration

The original Today / Body / Mind / Life navigation and Focus/Goal renaming were broader possibilities. This revision applies the selected visual direction to your **current** navigation and terms. The relevant benchmark review is retained at the back; these current-screen specifications guide this pass.


## The screen inventory

| ID | Screen | Basis | Components covered |
| --- | --- | --- | --- |
| J01 | Journal overview | Direct redesign | Calendar, AM/PM cards, grouped factors, add action. |
| J02 | Mood check-in | Direct redesign | Existing five mood words, equal options, progress and save. |
| J03 | Energy check-in | Proposed view | Shared selection component; scale labels need confirmation. |
| J04 | Motivation check-in | Proposed view | Shared selection component and complete/partial save. |
| I01 | Intake overview | Proposed view | Daily entries, timestamps and a direct logging action. |
| I02 | Search and recents | Direct redesign | Food/drink filters, suggestions and Something else. |
| I03 | Item amount | Proposed view | Amount, units, date/time and nutrition disclosure. |
| I04 | Custom item | Proposed view | Name, type, amount, optional details and reuse choice. |
| B01 | Body overview | Direct redesign | Lead measurement, personal history and measurement list. |
| B02 | Measurement detail | Direct redesign | Source, range, readings, Heading and history. |
| B03 | Add reading | Proposed view | Metric, numeric value, units, event time and note. |
| B04 | Manage measurements | Proposed view | Visibility, ordering, custom metric and display units. |
| L01 | Life overview | Direct redesign | Review date, wheel, manage areas and Headings. |
| L02 | Review detail | Proposed view | Named life-area values and previous-review comparison. |
| L03 | Heading detail | Proposed view | Target/intention, practice, activity and archive/remove. |
| L04 | Edit Heading | Proposed view | Name, intent, life area, dates and optional reason. |


## Journal and check-ins

The existing date strip, morning/evening rhythm and factors remain central.

J01-J04: see the full four-screen board in the PDF. All sample answers are fictional.


## Make check-ins feel like one familiar flow

### Calendar and check-in cards

DateStrip is shared by Journal and the proposed Intake overview. Selected dates use deep teal with white text. A separate small dot indicates a recorded entry, so "selected" and "has data" are not confused. CheckInCard supports not started, partial and complete; completed summaries use words and keep the record time visible.

### Mood, energy and motivation

Use the same five-row SelectableRow layout, progress header and sticky footer for each step. Preserve the mood labels Low / Flat / Okay / Good / Very good. The illustrated Energy and Motivation labels are proposed copy because their exact existing labels were not shown; verify scale meaning before mapping saved numeric values.

### Continue versus save

Selecting an option changes the draft. Continue advances to the next step; Save for now stores a partial check-in; Save check-in commits completion on the final step. No preselection in a fresh real flow. The selected options in the board show a filled example.

### Factor groups

FactorChip supports selected, unselected and unavailable states. Retain the current Body, Lifestyle and Mind groupings and custom factors. A selected chip shows both a visual state and a checkmark. Add More factors rather than squeezing all possible tags onto the first screen.

### Navigation and input recovery

Back preserves answers. Close with changes offers Keep draft or Discard only when needed. Keep an optional note collapsed until requested, and keep the current field and footer visible above the keyboard. Accessible selection state must be announced without reading every decoration.

### Copy and imagery

The current interactions provide the character here: a clear question, considered typography and useful summaries. Use expressive art sparingly on reflective or empty states. Do not fill the check-in with photography or make every mood a facial expression.


## Intake and food logging

Recent-item rows, quantity controls and optional detail form a consistent logging path.

I01-I04: see the full four-screen board in the PDF. Intake overview and editing forms are proposed supporting views.


## One item row, several useful actions

### Search and repeat

IntakeRow contains name, amount/unit, optional thumbnail and a trailing action. On recents, tapping the row opens amount editing; the plus repeats the visible amount. On the daily log, the row opens the recorded entry. Give row and plus distinct accessible names and non-overlapping hit areas.

### Quantity is a value plus a unit

QuantityField combines an editable number, unit selector and optional stepper. The step depends on the item/unit, not a global +1 rule. Permit decimal quantities and direct keyboard entry. A unit change must use a defined conversion or ask for a new amount; never silently treat grams as millilitres.

### Custom-item basis

For the proposed custom form, label nutrition as **For the amount above**. If the product supports per-100g, per-100ml or per-serving bases, expose that basis explicitly. Empty optional nutrition is unknown, not zero. Do not infer caffeine or medication dose from a generic item name.

### Keep suggestions honest

"Usually around now" requires suitable time-based history. Otherwise use "Recent". The list is not a recommendation to eat or drink something. Saved items keep their own metadata and history, and the source can be disclosed in the detail view.

### Save and repeat safely

Save and add creates the custom item only when the reuse toggle is enabled, and adds one consumption event. Saving again during a retry must not duplicate that event. After success, show Added to intake and Undo. Cancelling does not consume an item.

### The real form states

Supply empty and populated search, no results, quantity validation, long item names, missing thumbnails, saving and offline states. Display the date as well as the time when logging to a previous day. Data shown across Journal and Intake should reference the same recorded event.


## Body and measurements

Personal history, source information, headings and editing share the same visual language.

B01-B04: the weight curves in the raster board are schematic. The chart contracts and exact fictional examples later in this guide govern implementation.


## Preserve the meaning of every reading

### MeasurementCard and SourceStamp

A card shows metric name, complete value/unit, event timestamp and an optional comparison. SourceStamp identifies the origin and recording time; sync time is separate. Weight is the illustrated selected metric, not a requirement that every user's Body screen must lead with weight.

### RecentRange and TrendChart

Keep the existing middle-half personal-history definition and its calculation convention. Show the window, valid reading count and an explanation on demand. A neutral horizontal band is sufficient; the data does not require the broad wavy shape created in the PoC. Do not imply the range is clinically healthy.

### Heading and history

Keep the Heading card with current target or intent, dates and a detail/edit action. If a target appears in a chart, label it independently from the personal range. ReadingsList gives the exact event values, sources and timestamps. A "No change" comparison must identify its comparison period.

### New reading

FormField and QuantityField are reused from Intake, with the unit driven by metric metadata. Date and time refer to the reading itself. Source is Manual entry for a manually entered value. Editing an imported record should follow the existing provenance policy and should not silently masquerade as an original sensor reading.

### Manage means display management

ManagementRow supports reordering and visibility. Hiding a metric leaves its records available; removal of a metric or its history is a separate operation. Provide move-up/down actions as alternatives to drag. The custom-metric destination is proposed and needs its existing schema checked.

### The empty and sparse cases

No readings gets a short explanation and Add reading. One reading gets one point and a timestamp. A chart should show gaps when data is missing. Unit changes update display consistently across the leading value, history, targets and range labels.


## Life, reviews and headings

The life wheel remains recognisable; reviews and headings receive clearer detail and editing views.

L01-L04: life-area names, 0-10 scoring and activity examples are fictional for the study, not recovered user settings.


## Make the life wheel and headings usable together

### A wheel that reflects the actual model

LifeWheel takes the user's configured area IDs, labels, scale and review values. The eight named areas and 0-10 scale in the PoC are examples. Do not replace current user settings with these examples. Keep area order stable across comparable reviews and explain missing or newly added areas.

### A named-value alternative

LifeAreaRow shows the area, value and scale in text. The proposed Review detail makes the chart accessible and supports precise comparison. Both views must use the same review data. No combined life score is introduced; the filled polygon is not a measure of personal worth.

### Manage life areas

The existing management entry stays visible. Its proposed sheet uses the same ManagementRow pattern as Body for label, order and visibility. Changes must preserve review history and explain how prior reviews will be displayed when the area set changes.

### HeadingCard and PracticeRow

HeadingCard shows status, name, target or intention and an optional date. It links to a detail view. PracticeRow describes the actual repeat action and recent activity. A completed practice references the same event wherever it appears in the app.

### Edit Heading is a proposed form

Keep the current Heading concept. The illustrated name, intent, life-area and optional date/reason fields are a proposal pending schema confirmation. A measurable Heading and a qualitative intention may need different fields; do not force all of them into a numeric target.

### Archive and remove are different

Archive changes the Heading's active state while retaining history. Remove must explain the scope of deletion before committing. Preserve the current behaviour when it is known; the new interface must never silently broaden what an existing destructive action does.


## Shared foundations, drawn precisely

These are rendered component specimens. Use the tokens and contracts to resolve small inconsistencies in the imagegen studies.

### Foundation specimens

Selected dates use deep teal/white; logged-date dots are separate. Primary buttons are 52 high; minimum interactive hit area is 48. Factor chips carry text plus a selected indicator. Selection rows are equal height. Saving suppresses repeated submission.


## Shared fields, rows and quantity controls

### Input specimens

Persistent labels, logical keyboard types, explicit units, contextual validation and stable detail rows. The amount-greater-than-zero example applies to consumption quantity; measurements use their own domain rules.


## Shared cards tell the user what happened

### Status specimens

Completed check-ins show recorded words and time. Partial check-ins show unanswered dimensions rather than zero. Active and archived Heading states retain identity and history.


## Charts should be native components

The following examples are drawn from explicit sample data. They demonstrate encoding, not clinical interpretation or user measurements.

### Exact chart data

Weight, 1-7 September: 84.5, 84.7, 84.2, 84.8, 84.4, 84.9, 84.6 kg. Linear-quartile example: Q1 84.45, Q3 84.75. This illustrates the encoding; preserve the app's existing calculation convention and data requirements.

Life areas: Work, Money, Health, Relationships, Home, Friends, Growth, Leisure. Fictional current values: 6, 6, 7, 8, 7, 5, 6, 5; previous: 7, 5, 7, 7, 6, 6, 5, 6. Use the actual configured scale and labels in implementation.


## Shared component registry / foundations

These names describe reusable design responsibilities; map them to the app's actual code after inspecting the repository.

| ID | Component | Used by | Responsibility |
| --- | --- | --- | --- |
| C01 | AppScaffold | All primary screens | Safe areas, scroll container and stable tab/action placement. |
| C02 | ScreenHeader | All screens | Title, optional eyebrow, back/close and contextual action. |
| C03 | DateStrip | J01, I01 | Selected date and recorded-entry indicators are independent. |
| C04 | BottomNavigation | J01, I01, B01, L01 | Journal / Intake / Body / Life; icon plus visible label. |
| C05 | LogAction | Primary screens | Labelled + Log; destination-aware options preserve the active date. |
| C06 | Button | All flows | Primary, secondary, text, destructive, loading and disabled states. |
| C07 | IconButton | Add, remove, settings | Named action, minimum hit area and distinct selected/pressed state. |
| C08 | SelectableRow | J02-J04 | Equal height; no default answer; explicit selection. |
| C09 | FactorChip | J01 | Stable factor ID, readable label, group and selected state. |
| C10 | SegmentedControl | Filters, units, ranges | One selected option; purpose and selection announced. |
| C11 | FormField | I03-I04, B03, L04 | Persistent label, input, helper, optionality and inline error. |
| C12 | QuantityField | I03-I04, B03 | Numeric value, unit metadata, direct input and optional step. |
| C13 | DetailRow | Details and editors | Label/value pair, optional source/date and disclosure action. |
| C14 | FeedbackBanner | Save and error states | Outcome, scope and one relevant action such as Undo or Retry. |


## Shared component registry / domain patterns

These names describe reusable design responsibilities; map them to the app's actual code after inspecting the repository.

| ID | Component | Used by | Responsibility |
| --- | --- | --- | --- |
| C15 | CheckInCard | J01 | Not started, partial, complete; event time and human labels. |
| C16 | CheckInStepper | J02-J04 | Step count, draft retention and distinct continue/save actions. |
| C17 | IntakeRow | I01-I02 | Item, visible amount/unit and contextual repeat/edit action. |
| C18 | SourceStamp | B01-B03, I03 | Origin, measurement time and optional separate sync time. |
| C19 | MeasurementCard | B01-B02 | Complete value/unit, event time, range and comparison basis. |
| C20 | RecentRange | B01-B02 | Neutral interval with window, method and sufficient-data state. |
| C21 | TrendChart | B01-B02, history | Labelled axes/units, gaps, selected reading and text alternative. |
| C22 | LifeWheel | L01 | Stable area IDs/order, configured scale, two review styles. |
| C23 | LifeAreaRow | L02 and area editing | Named area/value, scale, previous value and missing state. |
| C24 | HeadingCard | B02, L01-L03 | Status, title, intent/target, dates and detail/edit action. |
| C25 | PracticeRow | L03 and activity | Action, completion/event reference and optional amount/time. |
| C26 | ReadingsList | B02 | Exact recorded values, timestamps, units and sources. |
| C27 | ManagementRow | B04, life-area settings | Visibility, reorder and labels; deletion is separate. |
| C28 | ActionSheet | + Log, More factors | Named options, dismiss, date context and keyboard handling. |


## Design the moments between screens

### The + Log sheet

Use a contextual first option: Check-in in Journal, Food or drink in Intake, Measurement in Body, and Practice or Heading in Life where those actions are supported. Keep the remaining global actions in a predictable order. Carry the selected date into the form and show it before saving.

### Empty, sparse and stale

Empty: "No readings yet" plus Add reading. Sparse: show the available point(s) and explain why a range is absent. Stale: keep the actual event date visible. Do not replace old data with a reassuring status or label a sync time as the reading time.

### Save and sync

Local save is the user action's success boundary when the architecture supports it. Show "Saved on this device" separately from "Sync pending". A sync failure should offer retry without asking the person to re-enter a completed record. Preserve event identity during retries.

### Forms and keyboard

Validate in context, keep typed values on failure, focus the first error and announce its label. Scroll the active control above the keyboard and safe area. A sticky action can move with the keyboard; it must not cover the final field or the last row of a sheet.

### Destructive actions

Archive changes active status. Remove describes which item and records are affected. Show a specific confirmation where removal is consequential. Use a text label and restrained error colour; keep destructive actions away from the primary save action.

### Large text and assistive input

Let titles wrap, cards grow and long unit/value pairs reflow. Horizontal controls may become vertical lists when needed. Provide accessible row actions and reorder alternatives. Charts expose a textual summary and a reading list. Test the native build; images cannot prove these behaviours.


## Tokens make the four areas feel like one app

| Token group | Value / decision | Use |
| --- | --- | --- |
| Light colour | Canvas #FFFDFA; surface #F4F1EB; ink #202725; secondary #626B65. | The base of all four primary areas; surfaces are darker than the canvas. |
| Brand / action | Deep teal #174F4A; on-brand #FFFFFF; clay #A14F36. | Teal primary/selection; clay reserved for the labelled add action. |
| Control boundary | Interactive border #78847D; selected-soft #E0ECE7; error #A33932. | Distinguishable controls. Pale dividers remain decorative only. |
| Typography | Display 32/38; title 28/34; section 20/26; body 16/24; label 14/20. | Serif headlines only; sans-serif metrics, units, forms and chart labels. |
| Layout | Page inset 24; spacing 4 / 8 / 12 / 16 / 24 / 32 / 48. | Repeated rhythm, generous separation between tasks. |
| Components | Card radius 16; input radius 12; primary button 52 high; hit area at least 48. | Rows and cards grow with content; dimensions are starting points. |
| Feedback | State feedback 120-180 ms; sheet transitions 220-280 ms. | Optional subtle haptics; honour reduced motion. |
| Contrast | Ink/canvas 15.01:1; secondary/canvas 5.43:1; white/teal 9.32:1. | Calculated sRGB pairs; interactive border/surface 3.45:1. |
| Dark option | Use the warm charcoal and sage mappings in the dark appearance extension. | System / Light / Dark. See the dark appearance extension at the end. |

Imagegen corrections: standardise date selection and icons, use flat brand fills, use sans-serif measurements and rebuild charts from records. Images communicate art direction; these tokens govern implementation.


## Make the first implementation concrete

### 1. Inventory and theme

Map the 28 design contracts onto existing code. Reuse components with the same responsibility. Introduce semantic colour, type, spacing and state tokens. Preserve routes, field names, scale versions and record IDs during the visual pass.

### 2. Journal and shared input

Build the header, date strip, buttons, selection rows and factor chips first. Apply them to J01-J04. Test draft retention, partial saves, the full three-step path and long labels. Confirm the unseen Energy/Motivation scale labels before shipping.

### 3. Intake and Body

Reuse fields and quantity controls across I03-I04 and B03. Complete repeat/add/edit, source timestamps, no-results and validation states. Use actual data rules for personal ranges, unit conversions and hiding/reordering measurements.

### 4. Life and management

Apply shared detail rows, status badges and management rows to Life areas, reviews and Headings. Validate that wheel and list values agree, archived records remain accessible, and remove has the intended scope.

### Acceptance tasks

Complete a check-in without a note; resume after leaving mid-flow; repeat a drink and undo; change a quantity/unit; find an old reading's source; hide a metric without deleting it; compare two Life reviews; archive a Heading and find its history.

### The remaining checks

Verify a narrow viewport, largest supported text sizes, long item/area names, keyboard exposure, TalkBack/VoiceOver, offline save and sync retries. Conduct the first usability round on the same current navigation. The screenshot-based work does not establish these runtime results.


## A handoff that maps to your current product

### The selected direction

Grounded Editorial is selected. Journal, Intake, Body and Life retain their positions. Headings, life reviews, personal ranges and custom tracking remain recognisable. The redesign adds clearer hierarchy, predictable controls and a more deliberate visual identity.

### What was produced

Four imagegen boards with sixteen screen studies; four rendered component-atlas pages; a twenty-eight-component registry; exact fictional chart examples; screen-specific behaviour contracts; and updated tokens and generation prompts.

### Evidence boundary

The six supplied images cover Journal, Mood, Intake search, Body, Measurement and Life. Screens reached via visible controls are design proposals until checked in the actual app. Example data, energy/motivation wording and life-area labels are illustrative. No repository changes were made.

### How to use the files

Use the PDF to review the visual design and the Markdown file for searchable specifications. The JSON file contains tokens plus screen/component inventories. The prompt file records the imagegen briefs. Do not use raster text, chart geometry or icon variants as production assets.

### Benchmark context follows

The five app-review spreads and source register follow this expansion; the dark appearance extension follows them. They remain supporting evidence for the direction; they do not override the current-screen contracts. The prior broader navigation experiments are no longer the implementation recommendation in this revision.

### Source material

User-provided files 1000079114.png through 1000079119.png; approved Grounded Editorial board; the official sources in the retained register. The PDF component examples are vector-rendered from the documented fictitious data and token values.


# Supporting benchmark review

## Men's health has more than one visual language

Observed product patterns are separated from recommendations. Trade-offs below are design hypotheses, not usability-test results.

### Hims - Men's telehealth

**Observed:** The current storefront presents broad men's care through warm brown and skin-tone imagery, personal treatment questions and a health snapshot. Care and commerce share the same product.

**Apply to your app:** Borrow the adult, discreet presentation and plain problem-led language. Give sensitive topics such as libido their own optional, clearly named entry points.

**Watch the trade-off:** A product-led care model can frame normal variation as something to fix. Your daily tracker should help people understand themselves before offering a service or purchase.

Sources: [Hims app listing](https://play.google.com/store/apps/details?hl=en&id=com.himshers.hims)

### Mojo - Sexual wellbeing

**Observed:** The current offering combines expert programs, guided AI conversations and medical care. Private use is prominent in its messaging. Its audience and programs now extend beyond men alone.

**Apply to your app:** Discuss sex, relationships and confidence clearly, without embarrassment. Explain what support is available, who created it and whether a person or AI is responding.

**Watch the trade-off:** Do not copy broad therapeutic promises or assume an AI conversation is equivalent to clinical care. The discretion lesson is stronger than the treatment model for your scope.

Sources: [Mojo product website](https://mymojo.com/)

### Mental - Mental health / training

**Observed:** The current listing foregrounds AI therapy/coaching, brief daily training and cold-training content. Storefront images use a dark interface, bright green accents and a performance vocabulary.

**Apply to your app:** Short, concrete sessions can give a hesitant user an obvious first step. Offer outcomes such as "switch off after work" alongside mood tracking.

**Watch the trade-off:** A toughness or optimisation identity is a narrower audience hypothesis. Do not make cold exposure, military references or continuous self-improvement the definition of men's mental health.

Sources: [Mental app listing](https://apps.apple.com/us/app/mental-ai-therapy-coaching/id6444276517)


## Make the numbers mean something

Observed product patterns are separated from recommendations. Trade-offs below are design hypotheses, not usability-test results.

### Oura - Daily interpretation

**Observed:** The 2025 redesign foregrounds one timely focus in Today, metrics in Vitals and longer-term context in My Health. Its current support guide explains baselines and insufficient-data states.

**Apply to your app:** Use a clear daily hierarchy: one useful focus, a few relevant signals and access to detail. Show the period and source behind each insight; personalise the order of metrics.

**Watch the trade-off:** Interpretation can sound more certain than the evidence. Keep self-reported mood distinct from sensor data and avoid inventing a universal wellbeing score.

Sources: [Oura: new app design](https://ouraring.com/blog/new-app-design/), [Oura: how to use the app](https://support.ouraring.com/hc/en-us/articles/360058599753-How-to-Use-the-Oura-App)

### WHOOP - Performance / behaviour

**Observed:** Official material centres sleep, strain, recovery and health monitoring. The Journal links logged behaviours with physiological insights. This review used documentation rather than live visual inspection.

**Apply to your app:** Borrow the loop of recording context, reviewing patterns and choosing a small experiment. Make repeat factors quick to log and let people change which factors they track.

**Watch the trade-off:** Your users should not need a wearable to get value. A recovery number must not override how someone says they feel, or become a moral judgement about their day.

Sources: [WHOOP: how it works](https://www.whoop.com/de/en/how-it-works/), [WHOOP Journal](https://www.whoop.com/dk/en/thelocker/the-whoop-journal/)

### Gentler Streak - Sustainable activity

**Observed:** Activity Path, personal progress and explicit activity statuses give rest a place in the product. Public imagery uses clear charts and a lively illustrated character.

**Apply to your app:** Make illness, injury, a break and returning after a gap legitimate states. Measure participation over flexible periods and let people choose a lighter day.

**Watch the trade-off:** Borrow the behaviour design first. Its mascot is a distinctive brand choice, not a required ingredient for a mature men's product.

Sources: [Gentler Streak](https://gentlerstories.com/gentlerstreak)


## Remove effort from the repeat action

Observed product patterns are separated from recommendations. Trade-offs below are design hypotheses, not usability-test results.

### Hevy - Workout logging

**Observed:** Its product imagery shows structured set rows with previous values and completion controls. Routines, progress and friends support a repeated workout-logging loop.

**Apply to your app:** Adopt predictable rows, visible units, recent values and a clear saved state for intake and body measurements. A familiar item should be quicker to repeat than to find again.

**Watch the trade-off:** Dense workout tables work in a focused session. They are less suitable as the first screen for a tired user trying to understand his day.

Sources: [Hevy](https://www.hevyapp.com/)

### Ladder - Guided strength training

**Observed:** The product centres coach-led plans, exercise guidance and progress. Its current site also promotes nutrition logging. Strong photography, bold typography and coaching identity lead the presentation.

**Apply to your app:** Make the next useful action obvious, including time and effort. A small number of curated choices is a better starting point than a large content catalogue.

**Watch the trade-off:** Do not equate healthy living with physique goals or an intensive training schedule. Borrow the clarity of the plan, while keeping your plan adaptable.

Sources: [Ladder](https://www.joinladder.com/)

### Strava - Activity / community

**Observed:** The official listing combines recording a broad range of activities, understanding progress and participating in a community. It is a general fitness app, not a men-only product.

**Apply to your app:** Support optional shared activities and connection goals later. Show walking and ordinary movement as meaningful alongside formal training.

**Watch the trade-off:** Public comparisons and feeds would change the emotional and privacy expectations of your app. Keep personal health logs private by default and sharing deliberate.

Sources: [Strava app listing](https://play.google.com/store/apps/details?hl=en_US&id=com.strava)


## Help users name, notice and respond

Observed product patterns are separated from recommendations. Trade-offs below are design hypotheses, not usability-test results.

### How We Feel - Emotional awareness

**Observed:** The official product describes precise emotional vocabulary, repeated check-ins, patterns over time and strategies for the moment. Its brand uses expressive colour and characters.

**Apply to your app:** Keep the five-word mood check-in as the fast path, then let people add a more precise emotion or context. Turn reflection into an optional next action.

**Watch the trade-off:** Do not turn one mood scale into a clinical assessment. More emotional vocabulary should be available without making the first interaction complicated.

Sources: [How We Feel](https://howwefeel.org/)

### Bearable - Whole-person tracking

**Observed:** The official screenshot groups mood, symptoms, factors, sleep, medications/supplements and food. The product emphasises customisation and finding patterns across these records.

**Apply to your app:** Preserve your broad model, but start with a few user-selected measures. Expose more detail progressively and make the recorded context easy to review or correct.

**Watch the trade-off:** Breadth creates logging burden. Avoid a first-run checklist of every symptom, substance and life factor; enough recorded data is more useful than an exhausting perfect log.

Sources: [Bearable](https://bearable.app/)

### Headspace - Needs-led support

**Observed:** The current site groups support around needs such as stress, sleep, anxiety and processing thoughts. Product imagery uses bright colour, approachable illustration and expert-led content.

**Apply to your app:** Label actions around a user's immediate need: "Unwind", "Clear your head", "Get ready for sleep". Keep the duration and delivery format visible.

**Watch the trade-off:** A content library can distract from your tracking purpose. A few relevant exercises should complement Today rather than occupy the entire product.

Sources: [Headspace](https://www.headspace.com/)


## Three references with useful boundaries

Observed product patterns are separated from recommendations. Trade-offs below are design hypotheses, not usability-test results.

### Calm - Sleep / meditation

**Observed:** The official indexed product summary emphasises sleep and meditation. This was a limited content review; its full product page did not load, so detailed current UI claims are excluded.

**Apply to your app:** Provide an easy evening entry point and short low-effort audio options where content is in scope. Let the user start without browsing a long catalogue.

**Watch the trade-off:** A relaxation-first brand would understate your physical tracking and broader life features. Treat evening use as one mode within the app.

Sources: [Calm sleep app](https://www.calm.com/app/sleep)

### MANUAL - Men's healthcare brand

**Observed:** The public website uses large direct language, deep green, light backgrounds and problem-based treatment categories. It was reviewed as a web brand reference, not verified as a native tracking app.

**Apply to your app:** A men's health identity can be clear, restrained and credible. Use a strong ink colour, generous spacing and specific words rather than masculine decorative signals.

**Watch the trade-off:** The treatment-shopping structure serves a different job. Your home screen should not become a list of perceived deficiencies or things to buy.

Sources: [MANUAL website](https://www.manual.co/)

### Flo - Category / privacy reference

**Observed:** Flo's Anonymous Mode page explains the privacy choice in product language and describes feature and account-recovery limitations. It is an adjacent reference, not a men's competitor.

**Apply to your app:** Explain a privacy option where it is chosen, including its practical limits. Borrow the principle of contextual daily relevance for a recurring personal-health habit.

**Watch the trade-off:** Do not imply men have an equivalent monthly prediction model, or label local-only storage as anonymous or end-to-end encrypted without the corresponding implementation.

Sources: [Flo: Anonymous Mode](https://flo.health/product-tour/anonymous-mode)




# Source register

1. [Hims app listing](https://play.google.com/store/apps/details?hl=en&id=com.himshers.hims) - Official listing and screenshots; telehealth scope and visual positioning.
2. [Mojo product website](https://mymojo.com/) - Official product and program descriptions; current broader sexual-wellbeing positioning.
3. [Mental app listing](https://apps.apple.com/us/app/mental-ai-therapy-coaching/id6444276517) - Official listing and screenshots; AI and daily training positioning.
4. [MANUAL website](https://www.manual.co/) - Men's healthcare brand reference; public website visually inspected.
5. [Oura: new app design](https://ouraring.com/blog/new-app-design/) - 5 November 2025 redesign: Today, Vitals, My Health and daily prioritisation.
6. [Oura: how to use the app](https://support.ouraring.com/hc/en-us/articles/360058599753-How-to-Use-the-Oura-App) - Current navigation, personal baselines, data sufficiency and feature organisation.
7. [WHOOP: how it works](https://www.whoop.com/de/en/how-it-works/) - Official descriptions of sleep, strain, recovery and health monitoring; browser visuals blocked.
8. [WHOOP Journal](https://www.whoop.com/dk/en/thelocker/the-whoop-journal/) - Official description of behaviour logging and physiological insights.
9. [Gentler Streak](https://gentlerstories.com/gentlerstreak) - Official screenshots and descriptions of Activity Path, rest and activity status.
10. [Hevy](https://www.hevyapp.com/) - Official website and product imagery: workout logging, routines and progress.
11. [Ladder](https://www.joinladder.com/) - Official website: coaching, programs, rep/weight logging and nutrition.
12. [Strava app listing](https://play.google.com/store/apps/details?hl=en_US&id=com.strava) - Official listing: activity recording, progress and community.
13. [How We Feel](https://howwefeel.org/) - Official website: emotional vocabulary, check-ins, patterns and in-the-moment strategies.
14. [Bearable](https://bearable.app/) - Official product descriptions and screenshot: mood, symptoms, factors and health tracking.
15. [Headspace](https://www.headspace.com/) - Official website and product imagery: needs-led discovery, meditation, sleep and support.
16. [Calm sleep app](https://www.calm.com/app/sleep) - Official indexed product summary; full page did not load. Limited content benchmark.
17. [Flo: Anonymous Mode](https://flo.health/product-tour/anonymous-mode) - Official feature explanation and limitations; privacy communication reference.
18. [W3C: contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) - WCAG 2.2 explanation of text contrast requirements.
19. [Android: accessible apps](https://developer.android.com/guide/topics/ui/accessibility/apps) - Official touch-target and accessibility guidance.
20. [Apple: accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) - Platform accessibility reference for implementation and QA.


# Dark appearance extension

Grounded Editorial supports System, Light and Dark. System is the recommended default. The four primary-screen studies below extend the selected design; the same 28 component contracts and 16 screen layouts apply in both appearances. This replaces the preliminary blue-grey dark palette.


## Grounded Editorial, after dark.

Warm charcoal, sage teal and softened clay. The same Journal, Intake, Body and Life.

A four-screen dark appearance imagegen PoC is embedded in the PDF. Sample values and plot shapes are illustrative. Use the exact chart contracts and configured data described earlier; measurements remain sans-serif in production.


## A second appearance for the same system

Semantic roles preserve hierarchy. A component resolves its colours from the chosen appearance.

| Role | Light | Dark | Application |
| --- | --- | --- | --- |
| Canvas | #FFFDFA | #171D1A | The main page background. |
| Surface | #F4F1EB | #202923 | Cards and list groups; darker than the canvas in light appearance. |
| Raised surface | Surface + elevation | #29352D | Sheets and raised content. Use tonal separation. |
| Primary text | #202725 | #F2F0E9 | Warm off-white body copy, headings and values. |
| Secondary text | #626B65 | #B3BDB5 | Dates, units, sources and supporting copy. |
| Primary / on-primary | #174F4A / #FFFFFF | #A8CDBE / #14261D | Selected dates and primary buttons. |
| Accent / on-accent | #A14F36 / #FFFFFF | #D99A78 / #281B14 | The labelled + Log action. |
| Control boundary | #78847D | #7D9183 | Inputs and controls needing a visible outline. |
| Decorative divider | #D8DDD6 | #39483F | Non-essential grouping lines only. |
| Selected soft | #E0ECE7 | #304B3E | Selected chips with brand text and a checkmark. |
| History fill | #DDE5DD | #344C40 | Neutral personal-history band, independent of targets. |
| Error | #A33932 | #F2ABA0 | Error text, icons and outlines; include a message. |

Calculated sRGB contrast ratios: primary text/canvas 15.01:1; secondary text/surface 7.74:1; secondary text/raised surface 6.62:1; on-primary/primary 9.16:1; on-accent/accent 7.04:1; control outline/raised surface 3.81:1; brand/selected-soft 5.51:1; error/surface 7.92:1. Verify other pairings and rendered states in the native build.


## Let people choose their appearance

Appearance is a preference. Build both themes into the shared components as they are implemented.

### Preference behaviour

System follows device changes. Light and Dark stay selected until changed. Persist the choice on this device and restore it before the first visible app frame.

### Preserve the task

Changing appearance keeps the current screen, scroll position, typed values and unfinished check-in. It does not reset a draft or create another record.

### Cover the whole experience

Apply the resolved theme to sheets, menus, date pickers, charts, keyboards where supported, system bars and launch surfaces. Reuse natural-colour photos; do not invert them.

### Validate both appearances

Check every component state, low brightness, large text and screen readers. Keep selected and error icons, meaningful text and chart line styles. Honour reduced motion.

The System / Light / Dark choice follows [Android's dark theme guidance](https://developer.android.com/develop/ui/views/theming/darktheme). Native implementation details depend on the app stack; the PoC does not establish runtime behaviour.

### Implementation scope and PoC corrections

Use one screen implementation with semantic colours for both appearances. Keep layout, type scale, units, controls and navigation consistent. Replace the raster's serif weight numeral with the UI sans face, use flat solid fills, and draw the personal range as the documented horizontal interval from real records. The generated week/month labels and curves are schematic. Appearance does not change data interpretation.

### Preference acceptance tasks

Launch with the device in dark mode; force Light; restart; return to System; change the device appearance while a check-in draft is open; open a picker and sheet; trigger an inline error; view sparse chart data. The preference should persist, drafts should survive, and all surfaces should remain readable.
