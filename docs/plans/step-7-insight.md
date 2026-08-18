# Step 7: Insight implementation plan

## Status

**Complete, 18 August 2026.** The 14-pair premium catalogue, scale-aware daily-signal adapter, 90-day gated engine, arithmetic teaser, Mind and evidence surfaces, eight-week habit adherence record, and v5 export share/save UI are delivered. The signed-off semantics below are implemented with no schema change and covered by pure-domain, real-SQLite, interaction, export round-trip, typecheck, and lint verification. No native dependency or prebuild was required.

This is the delivery plan for [sequencing step 7 of the product domains plan](product-domains-and-data.md#sequencing): insight — "derived, and the actual product". It consumes the [step 6 hand-off](step-6-habits-and-challenges.md#step-7-hand-off): the first behavioural adherence data, the finished-challenge moment as the designated premium introduction point, and three questions this plan must answer before the first correlation — whether habit adherence joins the pool, the minimum-data gates, and the premium boundary. It also collects two promissory notes: the product plan requires the **export share UI** to ship "no later than insight (step 7)" and step 1's serialisation still has no UI; and step 6 deferred **habit adherence over time as a rendered surface** to this step's insight work.

## Outcome

A user who has been checking in for a few weeks opens the Mind tab and sees something true about themselves that they did not type in: "On days after you drank, your energy averaged 2.1 — against 3.4 on other days. 11 days each." Tapping it shows the evidence — both arms, the day counts, the size of the difference — not a verdict. A user without enough data sees an honest not-yet state that names what is being watched and how close the nearest pattern is to showing, which is also where a free user will one day learn that cross-metric insight is the paid product. Everything is computed on device at read time from series that already exist; nothing is stored, nothing is sent, and a late watch sync that rewrites yesterday rewrites the insight with it.

The step is successful when both properties hold: an insight that appears only once its gates are met and disappears if the evidence stops supporting it, and a data export handed to a share sheet that the existing parser round-trips — the record leaving the device because the user asked, in the same release that starts interpreting it.

## Non-goals

- **No migration and no new tables.** Insights are derived at read, never stored — the product plan's own rule. No result cache (`bro-local.db` cache tables are permitted but "a few thousand rows in SQLite will not be the bottleneck", and the pool here is one device's daily rows), no seen/dismissed state, no stored teaser progress. This is the first step whose diff contains no schema change, and that is a feature: there is nothing here sync will ever have to replicate.
- **No premium enforcement.** The boundary is *decided and recorded* here (below); the entitlement machinery — purchase SDK, server verification, the `unknown` state — is [umbrella Phase 4](offline-first-identity-onboarding-premium.md#phase-4-premium-and-server-verified-entitlement), a separate native-integration workstream. Insights ship ungated meanwhile, tier-tagged in the catalogue, exactly as step 6 shipped the full challenge catalogue free: flipping enforcement on is a code change, not a migration.
- **No AI reflection.** Open decisions 18–20 stay open. Nothing in this step sends anything anywhere; the "no backend request" acceptance row holds for the entire insight surface.
- **No notifications.** The `reminders` table stays kind-less a third time, on purpose. An "insight is ready" nudge is real notification design (content sensitivity, timing, interaction with the daily reminder) and would be this step's second hard thing.
- **No p-values and no blanket corrections.** The multiple-comparisons posture is curation plus floors (below), decided before the screen exists per the product plan. Formal significance testing over a small authored pair list is machinery without a customer — and it would make the copy unwritable.
- **No new metrics, no pool beyond the daily series.** Wheel scores are sparse periodic sittings, not daily signals; body weight as an outcome is slow-moving and a motivational minefield. Both stay out of the v1 pool. Resting heart rate as a personalised input (versus one's own median) is genuinely interesting and genuinely clever; it waits.
- **No weekly-count cadence.** The step 6 hand-off's condition — scheduled-day streak breaks while weekly volume holds — becomes *observable* with this step's adherence surface. The decision stays evidence-gated; this plan builds the instrument, not the answer.
- **No insight history.** What is true today from the trailing window is the product. "What insights did I have in March" is a stored-truth feature and contradicts the derivation rule.

## Current baseline

- Migrations 001–006 shipped; `PRODUCT_TABLE_NAMES` drives verification and delete-local-data; this step adds nothing to either.
- The registry ([metric-registry.ts](../../apps/app/src/content/metric-registry.ts)) carries two scored metrics (`mood`, `energy`, 5-point, bounds snapshotted per observation), twelve presence factors, and three imported daily series (`sleep_duration` and `steps` summed, `resting_heart_rate` meaned) with 365-day backfill.
- The resolved-day merge ([resolved-day.ts](../../apps/app/src/health/resolved-day.ts) / [resolved-series.ts](../../apps/app/src/health/resolved-series.ts)) is the one function that answers "what was this metric's value on this local day"; Trends, Body, goals, and habit completion already call it.
- `observations` is indexed by `(metric_slug, local_day)` and snapshots `scale_min`/`scale_max` per row; the check-in writes factor presence and scored values into the same spine.
- Habits domain math ([apps/app/src/habits/](../../apps/app/src/habits/)) exposes scheduled-day expansion, derived completion, and streaks as pure functions — the raw material for the adherence surface.
- Export format v5 serialises and parses with committed v1–v5 fixtures; `sensitiveIncluded` exclusion is proven across every domain. **No share UI exists**: `expo-sharing` is not a dependency and no settings route offers export.
- The Mind tab already renders a 7-day mood/energy trends block with designed empty states — the natural host for the insight surface.
- Steps 1, 2, and 5 carry pending physical-device checklists; this step forces no build and adds nothing to them.

## Decisions locked for this step

- **The correlation pool is daily signals, read through one adapter.** A new pure boundary — the daily-signal adapter — produces, for any pool metric and local day, at most one value: scored metrics as the day's mean observation, factors as presence, measurements as the resolved-day value (imported-wins, provenance-aware). The engine never touches a repository or the resolved merge directly; every signal flows through this one function, so a late import that rewrites a day rewrites every insight that read it. This is the `goals`/habits derivation rule applied a third time: stored target or authored pair, computed truth, nothing frozen.
- **Habit adherence does not join the correlation pool. Sign-off item.** Three reasons, in descending order. First, it is nearly all duplicate signal: the `training` habit shadows the `training` factor, the steps habit *is* the steps series, and correlating a derived view of a series against another series invents findings. Second, the honest copy does not exist — "you feel better on days you complete your habits" is direction-ambiguous (did the habit lift the day, or did a good day make the habit easy?) and one step from guilt mechanics, which the product has refused everywhere else. Third, the hand-off's hard sub-question — how derived metric adherence would be *represented* beside stored manual completions in a pool — dissolves entirely if adherence stays descriptive. So adherence gets what step 6 actually deferred: a **rendered surface** (below), not a correlation input. Recorded in the product plan as this step's answer; revisitable with evidence, which the surface itself will generate.
- **The pair catalogue is authored content, in the binary** — [insight-catalogue.ts](../../apps/app/src/content/insight-catalogue.ts), the fourth catalogue, same rules as the other three: stable ids (`insight:<input>-<output>` with a lag suffix where needed), a copy edit is never a migration, unknown ids tolerated forever. Each entry: input metric and transform (`presence`, or `threshold` with a canonical-unit cut), output metric (scored, or `sleep_duration`), lag in local days (0 or 1), tier, and the copy template with slots for both arm means and day counts. The candidate list for sign-off, with lags stated so the review can audit each one's causality-of-timing: `alcohol → energy (+1)`, `alcohol → mood (+1)`, `late_screen → sleep_duration (+1)`, `late_screen → energy (+1)`, `caffeine → sleep_duration (+1)`, `poor_sleep_environment → sleep_duration (0)` (the factor describes last night, tagged the morning it was felt — same day as the rolled-up sleep), `sleep_duration < 6h → mood (0)`, `sleep_duration < 6h → energy (0)`, `steps ≥ 8,000 → mood (0)`, `training → mood (0)`, `stress → mood (0)`, `outdoors → mood (0)`, `social → mood (0)`, `junk_food → energy (+1)`.
- **The multiple-comparisons posture is the product plan's recommended one, made concrete: a curated list plus floors, not a correction.** Fourteen authored pairs is not four hundred blind ones; what protects the user from a spurious screenshot is that every tested pair was chosen because a mechanism is plausible, and that no result shows without clearing *all four* gates: window, arm minimums, effect floor, and stability. Recorded as resolving the product plan's "decide before the screen exists" demand.
- **The minimum-data gates, proposed for sign-off as numbers, not vibes:** the window is the **trailing 90 local days**; a pair is evaluated only when the output has **≥ 20 days** with a value in the window; each arm (input true / input false, or above / below threshold) needs **≥ 7 days**; the effect floor is **≥ 0.5 points** for scored outputs on the 5-point scale and **≥ 30 minutes** for `sleep_duration`; and the effect's *direction* must agree between the older and newer halves of the window (each half meeting a 3-per-arm minimum), so a pattern that reversed a month ago cannot show as current truth. A pair failing any gate produces a typed not-yet reason — which arm is short and by how many days — because that reason is itself product surface.
- **Scale-bounds guard:** the 5-point bounds are snapshotted per observation precisely so they can change; the engine therefore excludes observations whose snapshotted bounds differ from the current registry bounds rather than averaging across scales. A no-op today, an invariant the day the scale is renormalised.
- **The premium boundary is answered where the product plan drew it: *this metric over time* is free, *this metric against that one* is premium.** Every insight-catalogue entry ships `tier: "premium"`; per-metric trends, history, logging, and export stay free, per the tier table's line-to-hold. The free experience of this surface is the **not-yet/teaser state** — patterns being watched, the nearest one's distance to showing — which is the umbrella plan's designed conversion moment and fires when insight is real rather than on a timer. Enforcement waits for Phase 4 entitlement; until then the tag renders nothing differently, and pre-Phase-4 releases show insights free, deliberately (the step 6 catalogue precedent). Recorded in the product plan as resolving the boundary half of umbrella decision 7's dependency; the trial-contents half (decision 20) stays open.
- **The copy contract is structural, not editorial.** Every template is comparative and past-tense — two arms, two numbers, day counts always visible — and never imperative, predictive, or causal. "Your energy averaged 2.1 on days after drinking, against 3.4 otherwise" is the shape; "drink less to have more energy" is medical advice and unwritable in this template by construction, because the template has no slot for an instruction. Sensitive metrics get no special on-screen handling (the screen is local and Body already shows weight plainly), but the sobriety-adjacent alcohol pairs' copy is flat and factual — an observation about days, never about the person. Sign-off item alongside the catalogue.
- **The adherence surface is descriptive and lives with the habit.** Each active habit's detail (from `settings/habits`) gains its scheduled-day record over the trailing eight weeks — done, missed, unscheduled, no-data — rendered from the existing pure math with no new aggregate stored. For masked training-style habits this is exactly the instrument that shows "streak broke, weekly volume held" if it happens — the evidence the deferred weekly-cadence decision is waiting on.
- **The export share UI ships with no new native module and no prebuild.** Decision: a `settings/export` child route that serialises with the existing v5 code and hands the JSON to the platform — on iOS, a temporary file via `expo-file-system` (already a dependency) handed to React Native core `Share` as a file URL; on Android, `expo-file-system`'s StorageAccessFramework "save to a location you choose", because core `Share` on Android carries only text and a multi-year record as an intent extra is a `TransactionTooLargeException` waiting to happen. If the product later wants a true Android share sheet for files, `expo-sharing` joins a batched native regeneration under the umbrella plan's shared-prerequisites rule — it does not force one now. The screen carries the sensitive-data toggle (default off, wired to the proven `sensitiveIncluded` machinery) and one honest sentence about what the file contains and that it leaves the device only via the share action the user is about to take. Copy sign-off item. **No format bump: v5 unchanged, no new fixture.**
- **The insight surface lives on the Mind tab**, above the existing trends block: patterns live where mood lives. A detail screen per shown insight renders the evidence — both arms, counts, the window. Today, the check-in, and every step 1–6 surface are provably unchanged; the empty and not-yet states are designed as the primary states, per the product plan's own note that they are what most users see first.

## The engine

Pure functions in `apps/app/src/insight/`, no database handle, no React:

1. **Signal extraction:** for a pair, build the day-aligned series over the window — input value on local day *d*, output value on *d + lag* — from the adapter's per-day answers. Local-day strings order lexically; lag arithmetic uses the existing calendar-day helpers, so DST days and travel behave exactly as they already do in streak math.
2. **Arm split:** presence inputs split on tagged/not-tagged (an untagged check-in day is a *false* arm day, consistent with the check-in's "an untapped tag costs nothing"; a day with no output value joins neither arm). Threshold inputs split on the canonical-unit cut; a day with no input value joins neither arm — the habits no-data rule again: missing data is missing, never evidence.
3. **Gate evaluation** in a fixed order — window, output minimum, arm minimums, floor, stability — returning either a `shown` result (direction, both means, both counts, effect size) or a typed `not-yet` reason carrying the failed gate and its distance ("6 more days with a late-screen tag").
4. **Teaser aggregation:** over the whole catalogue, the not-yet state's numbers — how many patterns are being watched, and the nearest one's remaining distance — fall out of the per-pair reasons for free. The teaser is honest because it is arithmetic, not marketing.

Everything downstream (store, cards, detail) renders these results and computes nothing.

## User journeys and copy contract

### See what's affecting you

The Mind tab gains an insights block with three designed states. **Empty** (no pairs evaluable at all): what this surface will do, in the correlational register, with the check-in as the call to action. **Not-yet**: "Watching 14 patterns — the closest needs 6 more days of check-ins", built from the teaser aggregation; this is the future conversion card and must already read like one thing being offered rather than an apology. **Shown**: one card per passing insight, comparative copy from the template, both day counts visible on the card itself — the numbers are the credibility, not decoration.

### Read the evidence

Tapping a card opens the insight detail: the two arms side by side with their means and day counts, the window ("last 90 days"), and a plainly worded standing note that this is an association in this user's own record, not a cause and not advice. No action buttons — the product plan's line between honest observation and medical advice is enforced by there being nothing here to comply with.

### See your adherence

A habit's detail view shows its eight-week scheduled-day record — the four day-states rendered from existing math. A masked habit whose weeks are full but whose streak broke is visible as exactly that, which is the evidence the weekly-cadence decision needs and the reason this surface belongs to this step.

### Take your record with you

`settings/export`: what the file is, the sensitive toggle with the same wording precedent as prior sensitive flows, and the platform save/share action. The success state names where the file went; the failure state preserves the error. Nothing is uploaded; the existing "no backend request" guarantee covers the whole flow.

## Delivery slices

### Slice 1: The adapter and the engine

1. The daily-signal adapter over observations and the resolved-day merge, with the scale-bounds guard; real-SQLite coverage proving scored means, presence, resolved measurement values, and bounds exclusion.
2. Pure engine math — alignment, arm split, gates, teaser aggregation — exhaustively tested: lag across DST and month boundaries, no-data days in each position, every gate's pass/fail edge, stability reversal, and the retroactive case (a changed input day flips a result).

### Slice 2: The catalogue and the numbers — the sign-off gate

1. The insight catalogue with types, tiers, lags, thresholds, and copy templates; invariant tests (ids stable, every referenced metric exists in the registry with the right kind, thresholds in canonical units, every template comparative — no imperative verbs — with both count slots present).
2. **Sign-off gate: the pair list and each pair's lag; the gate numbers; the effect floors; the adherence decision; the premium boundary and tier tags; every copy template; the export screen's copy.**

### Slice 3: Surfaces

1. Insight store over the engine and catalogue; the Mind-tab block with all three states; the insight detail; both themes, token parity.
2. The habit adherence record on habit detail, from existing pure math.
3. Isolation regressions: a user with no check-ins sees the designed empty state and every step 1–6 surface byte-for-byte unchanged; a user with data but no passing gate sees not-yet, never a weak result.

### Slice 4: Export UI, acceptance, and the hand-off

1. `settings/export` with the platform-split share/save path, the sensitive toggle, and flow tests asserting the emitted payload parses with the existing v5 parser under both toggle states.
2. The automated acceptance matrix below.
3. Product plan updates (step 7 status; the boundary and adherence answers recorded; the export-UI promissory note discharged) and the step 8 hand-off.

## Expected touchpoints

| Area | Existing or planned files |
| --- | --- |
| Catalogue | `apps/app/src/content/insight-catalogue.ts` (new) |
| Adapter and engine | New `apps/app/src/insight/` — daily-signal adapter, alignment, gates, teaser, store |
| Routes and screens | `mind-screen` (insights block), new insight detail route, `settings/habits` detail (adherence), new `app/settings/export.tsx` |
| Export UI | New export screen over `apps/app/src/export/check-in-export.ts` (serialisation unchanged) |
| Tests | `@bro/app:test` — adapter real-SQLite suite, pure engine suites, catalogue invariants, surface and export flow tests |

No `packages/database` changes: no migration, no repository, no table.

## Automated acceptance matrix

| Case | Expected result |
| --- | --- |
| Gates | Below any gate — window, output minimum, arm minimum, floor, stability — no insight renders; the not-yet reason names the failed gate and its distance. |
| Emergence | Crossing the last failing gate makes the insight appear on the next read, with correct arms and counts; no write occurred anywhere. |
| Healing | A late import that rewrites a window day changes the arms, the effect, and — where it crosses a gate or the floor — the insight's existence, in both directions. |
| Lag alignment | Lag-1 pairs attribute across DST transitions and month boundaries correctly; a missing output day joins neither arm. |
| Stability | An effect whose direction reverses between window halves does not show, even above the floor. |
| Bounds guard | Observations with non-current snapshotted bounds are excluded from scored means. |
| Teaser | Watched-pattern count and nearest-distance equal the per-pair reasons they aggregate. |
| Isolation | No check-ins → empty state and every prior surface unchanged; no passing pair → not-yet, never a sub-floor result. |
| Adherence | The eight-week record matches the pure completion/cadence math day for day, including no-data days on metric habits. |
| Export UI | Emitted payload parses with the v5 parser; the sensitive toggle excludes exactly what format v5 excludes; v1–v5 fixtures untouched. |
| Storage | No new tables touched; delete local data leaves nothing insight-related behind because nothing was ever written. |
| No backend request | Evaluate, render, detail, adherence, export — none. |

## Verification commands

```bash
pnpm nx run @bro/app:test --skipNxCache
pnpm nx run-many -t typecheck lint -p @bro/app --skipNxCache
```

Preserve the complete output of a failing command. No migration regeneration (nothing changed), no device builds forced; steps 1, 2, and 5's carried physical checklists remain external.

## Exit criteria

- Every shown insight clears all four gates, renders comparative copy with visible day counts, and disappears when its evidence does; nothing about it is ever stored.
- The not-yet and empty states are designed, honest, and derived — the teaser numbers are arithmetic over the same gates.
- Late-arriving data retroactively changes insights in both directions, proven.
- Habit adherence renders descriptively from existing math and stays out of the correlation pool.
- The export share UI ships on both platforms with no new native module, the sensitive toggle proven, and the emitted file parsing with the unchanged v5 code.
- Every prior surface is provably unchanged for a user who never opens the Mind tab.
- The pair catalogue, gate numbers, tiers, and all copy signed off before Slice 3; suites, typecheck, and lint green.

## Step 8 hand-off

Food logging (step 8) gets a working insight pipeline whose pool it will want to join, and the joining rule is already decided: a food-derived daily signal enters as a registry metric plus authored catalogue pairs — no engine change — but the *number* of plausible food pairs is exactly the multiple-comparisons pressure the curated-list posture was chosen to resist, so the pair-count discipline becomes a standing review item the moment nutrition signals exist. The premium boundary is now recorded and tier tags are in place; umbrella Phase 4 can flip enforcement without touching this step's code, and the finished-challenge moment plus the not-yet teaser are the two designed slots waiting for it. The adherence surface is the instrument for the deferred weekly-cadence decision — if training-style habits show broken streaks over held weekly volume, that is the trigger, and the additive design (cadence kind, weekly target, week-based streak function) is sketched in the step 6 hand-off. The `reminders` table is still kind-less after a third deliberate deferral; the first notification anyone designs — habit nudge, review prompt, or an insight-ready ping this plan declined to invent — pays that one cheap migration. Sync (Phase 5) is untouched by this step in the strongest possible sense: it added no replicating rows at all.
