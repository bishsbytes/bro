# Step 4: Body metrics and unit preferences implementation plan

## Status

Implementation in progress, 16 August 2026. Slices 1 and 2 are complete: migration 004, the conflict-tolerant `unit_preferences` table and latest-per-dimension repository resolution; the signed-off canonical/display unit model with exact conversion, compound parsing, render-only rounding, and locale fallback; measurement registry entries for weight, waist, and body fat; default-off overlays; and last-of-day trend aggregation are implemented and green. Builds directly on the [step 3 hand-off](step-3-wheel-of-life.md#step-4-hand-off): the `goals` table is live and waiting for weight targets, migration 004 runs over a twice-proven multi-migration path, and `settings/life-areas` is the precedent for the units screen.

This is the delivery plan for [sequencing step 4 of the product domains plan](product-domains-and-data.md#sequencing): the first dimensional metrics — weight, waist, and body fat — and per-dimension unit preferences. It is deliberately the first real test of [canonical storage with display-side units](product-domains-and-data.md#units-and-measurement-preferences), taken now because a stored value in an unknown unit is the one mistake this schema cannot absorb, and cheap now becomes a rewrite of every row later.

## Outcome

A user can log a weight, a waist measurement, or a body fat reading — quickly from the daily check-in, or from a Body view that also shows where each number has been and where it is going. They see every value in the unit they think in (stones and pounds included), set a target ("13 stone by Christmas") against the goal machinery step 3 already shipped, and change their display unit at any time without a single stored value or goal moving. Everything works offline, with no account, and issues no backend request.

The step is successful when a measurement entered as `12 st 4 lb` is stored once in kilograms, renders back as `12 st 4 lb`, renders as `78.0 kg` after one settings tap, and a goal set against it reads the same series either way.

## Non-goals

- **No resting heart rate.** It is user-enterable in principle, but almost nobody measures it by hand; it arrives properly with health import (step 5) where a device reports it. Adding it later is one registry entry.
- **No height, no BMI.** No derived indices at this step; height ships when something needs it.
- **No energy unit.** Kilocalories versus kilojoules ([open decision 5](product-domains-and-data.md#open-decisions)'s energy half) is taken when food logging ships — the decision recurs per metric, and this step takes only the three it writes.
- **No quantified factor counterparts.** `alcohol_units` and friends follow the same canonical-unit discipline but belong to the check-in domain's own step; nothing here anticipates them beyond proving the discipline.
- **No import, no precedence rule.** User-versus-tracker precedence (open decision 12) is step 5's; every row this step writes has `source: 'user'`.
- **No per-metric unit overrides.** One preference per dimension, as the product plan models it. The genuine conflict — the UK habit of waist in inches but height in centimetres — cannot arise until height ships, and a per-metric override is an additive preference row (`metricSlug` beside `dimension`) when it does.
- **No weigh-in reminder.** Same refusal as step 3's review-cadence prompt: the `reminders` table stays kind-less until the prompt is designed.
- **No new native dependency, no prebuild.** Pure TypeScript and SQL over what exists.

## Current baseline

- Migrations 001–003 shipped; the multi-migration path is proven on real step-1 and step-2 database files; migration 004 follows a twice-walked road.
- `goals` is live with create/achieve/abandon, canonical `target_value`, derived progress — built in step 3 explicitly so this step reuses it unchanged.
- The metric registry has three kinds (`scored`, `factor`, `assessment`) with per-kind filtering proven as a guarded invariant on every surface; `TrackedMetricDefault` carries an `enabled` flag, so a registry metric can ship default-off in the check-in overlay.
- `tracked_metrics` overlay: position, enabled, `custom_label`, with `configureMany` for atomic multi-row changes.
- The trends screen renders per-metric series with per-kind aggregation (`mean`, `presence`); scale renormalisation from snapshotted bounds is in production.
- `settings/life-areas` is the child-route precedent for a customisation screen; shared components and the token-parity theme test cover both colour schemes.
- Export format v2 covers observations, day notes, tracked metrics, assessments, and goals, with committed v1 and v2 fixtures.
- Delete local data clears every table in `PRODUCT_TABLE_NAMES` in one transaction.

## Decisions locked for this step

- **Canonical units — the sign-off item, and the one this step exists to take.** Mass in **kilograms**; length in **metres**; body fat as a **fraction of one** (0–1). These are [open decision 5](product-domains-and-data.md#open-decisions)'s three body-metric cases, taken before the first write. Fraction-of-one over percent for body fat because it is what HealthKit stores and what step 5's import boundary will otherwise convert twice; the `%` is a display formatting of the `fraction` dimension, always, with no preference needed.
- **The registry gains kind `"measurement"` and, with it, the dimension concept.** `weight` (mass), `waist` (length), `body_fat` (fraction): null scale bounds, `userEnterable: true`, new per-day aggregation `"last"` — the day's value is the last one recorded, which is how a weigh-in behaves. The registry declares the dimension; the unit a user sees is dimension plus preference, resolved at render and never below it.
- **Three measurement slugs are permanent vocabulary**, like every slug before them: `weight`, `waist`, `body_fat`. Labels are copy and carry the standing sign-off discipline.
- **Display units per dimension: mass in `kg`, `lb`, or `st` (compound stones and pounds); length in `cm` or `in`; fraction always `%`.** The preference is global and universal: one choice per dimension applies to every metric of that dimension on every surface — check-in entry, Body view, history, trends, goal targets, settings preview — from day one, with no surface exempt and no metric shipping in a fixed unit. Compound units are a formatting problem: `12 st 4 lb` is parsed on entry and composed on display, and nothing below the formatter knows stones exist. Each dimension has a fixed display resolution (0.1 kg / 0.2 lb / whole pounds within stones; 0.5 cm / 0.25 in; 0.1 percentage point) — rounding happens at render only, never on write.
- **`unit_preferences` is a `bro.db` table and will replicate** — resolving [open decision 6](product-domains-and-data.md#open-decisions) as recommended: it describes the person, not the handset. One row per dimension, latest `updated_at` wins at read (no unique constraint, per the standing two-offline-devices rule); a missing or unknown preference falls back to the locale default, and an unknown `unit` value from a future version falls back to canonical display rather than erroring.
- **Locale seeds the default, then never changes silently.** First read without a stored preference resolves from the device region (US → lb and in; UK → st and cm; otherwise kg and cm) without writing a row; the first explicit choice writes one. A user who switched to kilograms did so deliberately.
- **Measurements join the check-in through the overlay, default-off.** The three metrics ship with `enabled: false` defaults — the daily loop stays two scores and a tap row until a user opts in. The check-in gains a measurements section that renders only tracked measurement metrics, parses input in the preferred unit, and writes canonical values with `source: 'user'` and null bounds. Scored and factor surfaces provably ignore measurement metrics and vice versa — the same guarded invariant as `wheel:*`.
- **The Body view is a `body` stack outside the tabs**, the `review` precedent exactly: `/body` (latest value, trend sparkline, and goal per tracked measurement; tracking toggles for the untracked), `/body/[slug]` (full history for one metric, goal create/manage). Entry from the trends screen beside the wheel entry. The tab bar stays at four.
- **Goals on measurements reuse the step 3 table and repository unchanged** — that was the point of shipping them early. Targets are entered in the preferred unit, stored canonical, and inherit the display unit at render, so changing preference never moves a goal. Direction is inferred from target versus latest value, as the wheel does.
- **Unit conversion is one pure module.** Parse (including compound), convert, format, and display-resolution tables live in `apps/app/src/units/` with no dependency on the database or React; every other surface — check-in, Body, trends, goals, export display — calls it rather than owning arithmetic. Conversion factors are exact definitions (1 lb = 0.45359237 kg), not approximations.
- **`unit_preferences` joins `PRODUCT_TABLE_NAMES`**, so migration verification and delete-local-data inherit it by construction.
- **Export bumps to format v3**, adding a `unitPreferences` section beside the existing five. Measurement observations already ride in `observations` as canonical values — the export stores what the database stores, and v1 and v2 fixtures keep parsing.

## Schema

Migration 004, one statement under the standing conventions (`IF NOT EXISTS`, UUIDv7 ids, epoch-ms timestamps):

```sql
CREATE TABLE IF NOT EXISTS unit_preferences (
  id TEXT PRIMARY KEY,
  dimension TEXT NOT NULL,        -- 'mass' | 'length' | 'fraction' | future
  unit TEXT NOT NULL,             -- 'kg' | 'lb' | 'st' | 'cm' | 'in' | future
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

No indexes — a handful of rows read in full. No unique constraint on `dimension`: two offline devices choosing units the same day are two rows, and the latest `updated_at` wins at read, exactly as `tracked_metrics` resolves duplicates. Measurement observations need no schema at all — the spine's `REAL` value and nullable bounds already suffice, which is the observation model paying rent.

## User journeys and copy contract

### Log from the check-in

Opt in once (Body view or the check-in's own management affordance), then the daily check-in shows a measurements row: weight in the user's unit, one field, saved as canonical kilograms alongside the day's mood and factors. Compound entry accepts `12 st 4` and `12st 4lb`; a bare number in stones mode is stones. Nothing appears for users who never opt in.

### See where it's going

`/body`: each tracked measurement shows its latest value, when it was taken, a sparkline, and its active goal if one exists. `/body/[slug]`: the full series, in the display unit, with edit and delete honouring the same rules as history.

### Set a target

From a measurement on the Body view: target in the preferred unit, optional date, direction inferred. Progress is derived from the observation series — the same derivation, the same screen patterns, as wheel goals on `/review`.

### Think in stones

`settings/units`, following the life-areas precedent: one choice per dimension, previewed with a live example value (`78.0 kg` / `172.0 lb` / `12 st 4 lb`). Changing it re-renders every surface and rewrites nothing. First run shows the locale default unmarked; an explicit choice persists and replicates when sync arrives.

### Delete local data

Unchanged copy; the action now also clears `unit_preferences` via the shared table list.

## Delivery slices

### Slice 1: Migration 004 and the repository

1. `unit_preferences` into `schema.ts` and `PRODUCT_TABLE_NAMES`; `db:generate`, conflict-tolerant form, commit SQL and manifest.
2. Real-SQLite migration tests: fresh file applies 001–004; a step-3 file applies only 004; re-runs are no-ops.
3. `UnitPreferenceRepository` (set, resolve-latest-per-dimension, list) per the recipe. Delete-local-data test extended with a sentinel row.

### Slice 2: Dimensions, the units module, and the registry extension

1. `apps/app/src/units/`: dimension model, exact conversion factors, parse (compound included), format with per-dimension display resolution, locale defaulting. Pure functions, exhaustively tested — round-trips, boundary rounding, malformed input.
2. Registry kind `"measurement"` with `dimension`; aggregation `"last"` added to trend math; the three slugs with labels. Regression tests: scored, factor, and assessment surfaces ignore measurement metrics; `DEFAULT_TRACKED_METRICS` ships them `enabled: false`.
3. **Canonical units, display units, labels, and display resolutions are the sign-off gate for this slice.**

### Slice 3: The check-in measurements section

1. Measurements section on the check-in, overlay-driven, rendered only when at least one measurement is tracked; entry parsed in the preferred unit, written canonical, `source: 'user'`, null bounds, standard `localDay` conventions.
2. Check-in isolation regressions in both directions; abandoning entry writes nothing; the day's last value wins in trends.

### Slice 4: The Body view and goals

1. `/body` and `/body/[slug]` stack outside the tabs; tracking toggles write overlay rows (`configureMany` where atomic); latest values, sparklines, history.
2. Goal create/achieve/abandon on measurements through the existing repository; canonical targets; derived progress; direction inference — including decrease, which the wheel never exercised as a default expectation.
3. Trends gains the Body entry point beside the wheel entry; measurement series render in the display unit.

### Slice 5: Units settings, export, acceptance

1. `settings/units`: per-dimension choice with live preview, locale default, both themes, token parity.
2. Export format v3: `unitPreferences` section, new fixture, v1 and v2 fixtures still parse.
3. Full automated acceptance matrix below; update the product plan (step 4 status, open decisions 5 body-cases and 6 resolved) and record the step 5 hand-off.

## Expected touchpoints

| Area | Existing or planned files |
| --- | --- |
| Schema and migration | `packages/database/app/src/schema.ts`, `product-tables.ts`, `drizzle/*.sql`, `src/migrations/manifest.ts` |
| Repositories | New `unit-preference-repository.ts`; exported from `src/index.ts` |
| Units module | New `apps/app/src/units/` — dimensions, conversion, parsing, formatting, locale defaults |
| Registry | `apps/app/src/content/metric-registry.ts` (measurement kind, dimension); `apps/app/src/trends/trend-math.ts` (aggregation `last`) |
| Routes and screens | New `apps/app/src/app/body/` stack; `(tabs)/settings/units`; check-in measurements section in `home-screen`/`check-in-store`; trends entry point; screens under `src/screens/` |
| Export | `apps/app/src/export/check-in-export.ts`, new v3 fixture |
| Tests | Extends `@bro/app:test` and the real-SQLite migration suites |

## Automated acceptance matrix

| Case | Expected result |
| --- | --- |
| Migration 004 on fresh and step-3 files | Fresh applies all four; a step-3 device applies only 004; re-runs are no-ops. |
| Canonical storage | `12 st 4 lb` entered → one row, kilograms, exact factor; renders `12 st 4 lb`; renders `78.0 kg` after preference change; the stored value never changes. |
| Compound parsing | `12 st 4`, `12st 4lb`, `172 lb`, `78,0` (locale decimal) parse; garbage is rejected with the field-level message; formatting composes compounds correctly at boundaries (`11 st 14 lb` never rendered). |
| Rounding | Display honours per-dimension resolution; repeated unit switches never drift a stored value; no implied precision (80 kg never renders `176.37 lb`). |
| Preference resolution | Latest row per dimension wins; no row falls back to locale default; unknown future unit falls back to canonical display without erroring. |
| Check-in isolation | Measurement metrics never appear in scored or factor surfaces, nor wheel sittings; scored/factor/assessment surfaces unchanged by measurement overlay rows. |
| Default-off | A fresh install shows no measurements section; opting in via Body or settings shows it that day. |
| Aggregation | Two weigh-ins one day → trends shows the later; gaps stay gaps. |
| Goals | Weight-decrease goal from the Body view: canonical target, derived progress against the series, achieve/abandon round-trips; changing display unit moves neither target nor progress. |
| Export v3 | `unitPreferences` present; v1 and v2 fixtures still parse; round-trip on the v3 fixture. |
| Delete local data | Preference rows gone; steps 1–3 guarantees still hold. |
| No backend request | The entire measurement, goal, and units flow issues none. |

## Verification commands

```bash
pnpm nx run @bro/database-app:db:generate
pnpm nx run @bro/app:test --skipNxCache
pnpm nx run-many -t typecheck lint -p @bro/app @bro/database-app --skipNxCache
```

Preserve the complete output of a failing command. No device work is required by this step.

## Exit criteria

- A measurement entered in any supported unit is stored once, canonically, and round-trips through every display unit without the stored value or any goal target moving.
- Every dimensional value on every surface renders through the per-dimension preference — no screen, chart, goal, or preview shows a hard-coded unit.
- Canonical units for mass, length, and fraction are signed off before slice 2 completes; they are the units health import will convert into in step 5.
- Migration 004 follows the conflict-tolerance convention, proven on a real step-3 database file.
- The check-in stays two scores and a tap row for anyone who has not opted in; measurement metrics are provably invisible to every non-measurement surface.
- A weight target set from the Body view derives progress from the same series the chart draws, in either direction.
- Export v3 ships with fixtures; delete local data covers the new table.
- Automated suites, typecheck, and lint are green.

## Step 5 hand-off

Health import (step 5) gets: canonical units already decided and enforced for mass, length, and fraction, so the import boundary is a conversion into a known target rather than a second unit decision; the `dimension` concept in the registry ready to type imported metrics; aggregation `"last"` proven for the rollup conversation ([open decision 13](product-domains-and-data.md#open-decisions)); and a Body view ready to show imported series beside user-entered ones. What step 5 must decide before its first write is the precedence rule when user and tracker disagree on the same day (open decision 12) — both rows are kept, the read side picks — and the platform question (open decision 11). Step 5 is the next native work: HealthKit and Health Connect need a prebuild, batched with Phase 3 per the standing plan.
