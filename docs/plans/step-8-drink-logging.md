# Step 8: Drink logging implementation plan

## Status

**Complete, 19 August 2026.** Migration 007, the snapshotted consumption-entry repository, canonical drink units and authored catalogue, read-time daily totals, drinks/settings/Trends/goals surfaces, entry-derived insight signals, the sixteen-pair catalogue, and export format v6 are delivered. Real-SQLite, pure-domain, store, interaction, export, migration, typecheck, and lint coverage are green. No native dependency, prebuild, account, network request, or stored daily total was added.

This is the delivery plan for the first half of [sequencing step 8 of the product domains plan](product-domains-and-data.md#sequencing), which this plan splits in two. The product plan's step 8 — food logging — is "the largest, carries the external dependency, and is the easiest to get wrong in a way users abandon". That description is true of food and false of drink: alcohol, caffeine, and fluid need no food database, no barcode, no network, and no new store, and they are the consumption signals the [insight engine](step-7-insight.md) already has authored pairs for. So **step 8 is drink logging, and step 9 is food logging**, and step 8 exists to design and prove the consumption entry model — the entry table, the snapshot rule, the entry-to-daily-signal projection — with zero external dependency, so that step 9's one hard thing is genuinely only the provider.

It consumes the [step 7 hand-off](step-7-insight.md#step-8-hand-off): a working insight pipeline whose pool a consumption signal joins as a registry metric plus authored pairs with no engine change, and the standing warning that pair count is the multiple-comparisons pressure the curated-list posture was chosen to resist. It also collects a promissory note from step 4, which deferred [open decision 5](product-domains-and-data.md#open-decisions)'s energy half — kilocalories versus kilojoules — to "when food logging ships". A logged pint carries calories, so this step takes it.

## Outcome

A man who wants to know what four pints on Friday actually costs him opens the app on Saturday, taps two things, and has logged Friday's drinks. A week later the alcohol series on Trends is his own, in the units he thinks in, and the insight surface can say something true he did not type: on days after he drank four or more units, his energy averaged 2.1 against 3.4 otherwise. Caffeine and total fluid ride the same entry path. Everything works offline, with no account, and issues no backend request — the last time that row will be unconditional, because step 9 spends it.

The step is successful when three properties hold: a drink logged as "pint of lager, 4.5%" is stored once as canonical ethanol mass with its label and serving snapshotted, and still reads correctly after the catalogue entry it came from has been edited or removed; the day's alcohol total is **derived** from entries at read and is never a stored row; and a user who never logs a drink sees every step 1–7 surface unchanged.

## Non-goals

- **No food, no provider, no network.** Search, barcode, macros beyond energy, custom foods, and recipes are step 9. This step ships the table they will extend and nothing they will have to unpick.
- **No custom-drink library.** "Something else" entry (label plus ABV and volume, or plus caffeine) writes a complete entry, and **recents** make it repeatable — which is the reuse journey the product plan actually names. A user-authored consumable table is step 9's, where custom foods and recipes force it properly; drinks join it there.
- **No weekly targets.** "Under fourteen units a week" is the right goal for this domain and the wrong step for it: `goals` derives progress from a per-day series, and a weekly window is real new machinery — the same machinery the [deferred weekly habit cadence](step-6-habits-and-challenges.md#step-7-hand-off) wants. One weekly-aggregation design, taken once, when the adherence surface has produced the evidence. Daily-series goals work meanwhile.
- **No hydration coaching, and no water insight pair.** Fluid intake is logged, trended, and goal-able because users ask for it; it is not correlated against mood or energy at v1. Self-reported hydration is a weak signal with a strong guilt gradient, and the copy contract has no honest template for it.
- **No drink reminder.** The `reminders` table stays kind-less a fourth deliberate time. A "did you drink last night" prompt is the guilt mechanic this product has refused everywhere else.
- **No kilojoule display, no macros.** Canonical energy is decided here because entries carry it; the kJ display unit and protein/carbs/fat arrive with food, where a user can actually see them add up.
- **No change to the check-in.** The daily loop stays two scores and a tap row. Drink logging is default-off and reached from its own surface; the `alcohol` and `caffeine` factors keep their place in the factor panel unchanged.
- **No new native dependency, no prebuild.** Pure TypeScript and SQL over what exists. Steps 1, 2, and 5 carry physical-device checklists; this step adds nothing to them.

## Current baseline

- Migrations 001–006 shipped; `PRODUCT_TABLE_NAMES` ([product-tables.ts](../../packages/database/app/src/product-tables.ts)) drives Drizzle schema naming, manifest verification, and delete-local-data, so a new product table declares its deletion responsibility in one place.
- The registry ([metric-registry.ts](../../packages/domain/src/content/metric-registry.ts)) has four kinds and two measurement variants — user-enterable and imported-only — plus the standing convention, written in the file itself, that **a factor needing quantity gets a separate quantified counterpart** (`alcohol` → `alcohol_intake`) rather than overloading `FACTOR_PRESENCE_VALUE`. This step is that comment coming due.
- Canonical storage with display-side preferences is proven for `mass`, `length`, and `fraction`, with exact conversion factors, compound parsing, render-only rounding, and the `unitPreferenceDimension` override that already splits `height` from `length` ([dimensions.ts](../../packages/domain/src/units/dimensions.ts)).
- [resolved-day.ts](../../apps/app/src/health/resolved-day.ts) is the one function answering "what was this metric's value on this local day", merging observations with imported `daily_metrics` under imported-wins precedence; Trends, Body, goals, and habit completion all read through it. It is typed to `HealthMetricSlug` today.
- The insight daily-signal adapter ([daily-signal.ts](../../apps/app/src/insight/daily-signal.ts)) indexes its sources once and answers per metric per day; factors resolve as presence, with an untagged day on a check-in day counting as a false arm.
- `goals` supports create/achieve/abandon against any metric series with canonical targets and derived progress, in both directions.
- Export format v5 parses v1–v5 fixtures with `sensitiveIncluded` exclusion proven across every domain, and ships a platform-split share/save UI.
- No table in `bro.db` stores per-event rows yet: every domain to date is either one row per day-ish observation or a small configuration table. This is the first entry log, which is why it is worth designing before the provider arrives.

## Decisions locked for this step

- **One `consumption_entries` table, designed for food from the start.** A drink and a meal are the same shape — a thing consumed at a time, with a label and quantity snapshotted and nutrition snapshotted beside them — so step 8 writes the table step 9 extends, rather than a `drinks` table step 9 has to merge. The `kind` column (`'drink'`, later `'food'`) exists from migration 007, and step 9's migration adds macro columns and the consumable reference; it does not restructure anything.
- **Snapshot everything displayed, reference only for re-lookup.** The rule the product plan sets for food applies to the drink catalogue for the same reason: `label`, `serving_label`, quantity, and every nutrition number are copied onto the entry at log time. A catalogue edit, a deprecation, or a removed entry never changes what a logged day says. `catalogue_ref` is for "edit this entry" and for step 9's provider re-lookup — never for display. This is the [catalogue, overlay, snapshot](product-domains-and-data.md#catalogue-overlay-snapshot) discipline applied a fifth time.
- **Daily totals are derived, never stored. Sign-off item.** No observation row is written for a drink. `alcohol_intake`, `caffeine_intake`, `fluid_intake`, and `energy_intake` are a third measurement variant — **consumption-derived** — whose value on a local day is the sum of that day's entries, computed at read. This extends the resolved-day merge to a third source rather than inventing a parallel path, which is what makes Trends, goals, history, and insight work with no per-surface arithmetic. It also means a corrected or deleted entry corrects every derived reading of that day on the next read, exactly as a late import rewrites an insight. The cost is honest and accepted: `resolveMetricDay` widens beyond `HealthMetricSlug` to a resolution over three sources, and that widening is reviewed as part of the sign-off, not smuggled in.
- **Canonical units, taken before the first write, as step 4 took its three.** Alcohol as **ethanol mass in kilograms** (the existing `mass` canonical, so no new physical dimension); caffeine as **mass in kilograms**; fluid as **volume in litres** (new dimension); energy as **kilocalories** (new dimension). Kilocalories over kilojoules because every candidate provider and both platform health stores express food energy in kcal, and kJ is an exact display conversion of it (1 kcal = 4.184 kJ) — this resolves the energy half of [open decision 5](product-domains-and-data.md#open-decisions). One defined constant governs entry arithmetic: `ETHANOL_DENSITY_G_PER_ML = 0.78924`, from which volume × ABV → mass follows reproducibly.
- **Alcohol display is a preference dimension, not a physical one.** `alcohol` joins `UNIT_PREFERENCE_DIMENSIONS` as a `unitPreferenceDimension` override on the `mass` dimension — precisely the mechanism that already splits height from length. Display units: **UK unit** (10 ml ethanol = 7.8924 g by the constant above), **US standard drink** (14 g exactly), and **g**. These are different *definitions* of a quantity, not conversions of one, which is why they are display units over a canonical mass and never a stored "unit count". Locale seeds the default (UK → UK units, US → standard drinks, otherwise UK units), then never changes silently. Display resolution 0.1. **Sign-off item:** the 7.8924 g figure against the "a unit is about 8 g" wording of UK guidance. The unit-neutral slug is `alcohol_intake`; the unreleased app deliberately retired the earlier display-coupled draft before it became permanent.
- **Volume display is `ml` or `l` metric, `fl oz` imperial — and pints are servings, not units.** UK and US fluid ounces and pints differ definitionally (1 fl oz UK = 28.4130625 ml, 1 fl oz US = 29.5735295625 ml — both exact), and a "pint" display unit would force that ambiguity onto every number on every screen. Instead the **drink catalogue owns servings**: a pint, a 330 ml can, a 175 ml glass, a double measure are catalogue rows with an exact volume, and the volume *preference* only ever chooses how a total renders. Caffeine renders in `mg` always, following the `fraction`-renders-as-`%` precedent, with no preference row.
- **The drink catalogue is authored content in the binary** — the fifth catalogue in [packages/domain/src/content/](../../packages/domain/src/content/), same rules as the other four: stable ids, unknown ids tolerated forever, a copy edit is never a migration. Each entry carries a label, a kind, servings with exact volumes, and its per-serving numbers (ABV for alcoholic drinks, caffeine mg, kcal). It is deliberately generous and British-first in its defaults (pint, half, 175/250 ml wine, 25/50 ml spirit measure, mug of tea and coffee) with US servings alongside. **Catalogue content and every number in it is a sign-off gate**, like the habit catalogue and the insight pairs before it.
- **Logging is default-off and lives outside the daily loop.** The four derived metrics ship as tracked-metric overlay entries with `enabled: false`, the step 4 measurement precedent. A `/drinks` stack outside the tabs — `/drinks` (today's entries, quick-add strip of recents, running totals) and `/drinks/[localDay]` (a day's entries, edit, delete) — mirrors the `/body` precedent exactly. The tab bar stays at four. Entry points from Trends and from `settings/drinks`.
- **Corrections are hard deletes, no tombstones**, as the product plan's [correct the record](product-domains-and-data.md#correct-the-record) journey requires: under sync a delete forwards as a write, and an offline device's later edit updates zero rows.
- **Alcohol and caffeine presence become derivable from entries, and the factor panel is unchanged.** The daily-signal adapter resolves the `alcohol` and `caffeine` factors as true on a day with a matching logged entry, whether or not the tag was tapped. Without this, a user who logs three pints and never taps the tag is counted by the existing insight pairs as a non-drinking day, which is not a modelling nicety — it is the engine reporting the opposite of what happened. The false arm is unchanged: an untapped, unlogged day on a check-in day is still false.
- **Exactly two new insight pairs, and the pair-count discipline is the reason.** `alcohol_intake ≥ 4 units → energy (+1)` and `alcohol_intake ≥ 4 units → sleep_duration (+1)`, both plain thresholds on canonical mass, both `tier: "premium"`, both needing **no engine change** — fourteen authored pairs become sixteen. The genuinely interesting pair this domain unlocks — caffeine *after a time of day* against sleep — needs a windowed transform the engine does not have and is deferred to a step of its own, named in the hand-off rather than smuggled in here. Fluid and energy get no pairs at all.
- **`consumption_entries` is a `bro.db` table and replicates**; it is user-originated data by definition. It joins `PRODUCT_TABLE_NAMES`, so migration verification and delete-local-data inherit it by construction.
- **Alcohol is sensitive; fluid and caffeine are not.** `alcohol_intake` ships `sensitive: true` alongside the body metrics, and export's sensitive exclusion drops **any entry carrying ethanol** — a drink entry is not partially sensitive — together with the metric's registry entry, its tracked-metric row, and any goal against it. Caffeine, fluid, and energy entries stay. Export bumps to **format v6**, adding a `consumptionEntries` section; v1–v5 fixtures keep parsing.
- **A logged drink is not a check-in.** `hasCompletedCheckIn` reads mood and energy observations only, and nothing in this step writes an observation. Streaks, reminders, and the Today empty state are provably unaffected.

## Schema

Migration 007, under the standing conventions (`IF NOT EXISTS`, UUIDv7 ids, epoch-ms timestamps, canonical values):

```sql
CREATE TABLE IF NOT EXISTS consumption_entries (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,               -- 'drink'; 'food' from step 9
  catalogue_ref TEXT,               -- authored catalogue id, or NULL for a free entry
  label TEXT NOT NULL,              -- snapshotted at log time, never resolved for display
  serving_label TEXT,               -- snapshotted: 'pint', '330 ml can', '175 ml glass'
  quantity REAL NOT NULL,           -- number of servings
  volume_l REAL,                    -- canonical litres, per entry (quantity applied)
  ethanol_kg REAL,                  -- canonical mass of pure alcohol
  caffeine_kg REAL,                 -- canonical mass
  energy_kcal REAL,                 -- canonical energy
  occurred_at INTEGER NOT NULL,
  local_day TEXT NOT NULL,
  tz_offset_minutes INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_consumption_entries_day ON consumption_entries (local_day);
CREATE INDEX IF NOT EXISTS idx_consumption_entries_kind_day ON consumption_entries (kind, local_day);
```

Nutrition columns are nullable because a drink legitimately has no caffeine or no alcohol, and `NULL` means "not applicable or unknown" while `0` means "measured as none" — a distinction food will need. `local_day`, `occurred_at`, and `tz_offset_minutes` follow the observation spine's conventions exactly, so day-boundary and travel behaviour are the ones already proven. No unique constraint: two entries of the same drink at the same minute are two drinks.

## User journeys and copy contract

### Log a drink

`/drinks`, or the quick-add strip: recents first (what this person actually drinks), then the catalogue by category, then "something else". Pick a serving, adjust quantity, done — the target is under ten seconds for a repeat and under twenty for a first-time catalogue pick. The default time is now; last night is one tap away, because drinks are usually logged the morning after.

### See what it adds up to

Today's totals on `/drinks` in the user's units — units or standard drinks, ml or fl oz, mg, kcal — with the week beside them. Trends renders each tracked derived metric as a summed daily series, alongside every other metric. The copy states totals and never grades them: no colour-coded thresholds, no "heavy" or "moderate" labels, no guideline comparison. This product does not have a view about someone's drinking, and the moment it appears to, the logging stops.

### Correct the record

Edit or delete any entry from its day. A deleted entry is gone, and every derived total, trend point, goal progress, and insight that read that day changes on the next read — with no recomputation step, because none of it was stored.

### Take it with you

Export v6 carries entries as they are stored. With sensitive data off — still the default — every entry carrying alcohol is absent from the file, along with the `alcohol_intake` metric, its tracked-metric row, and its goals.

### Delete local data

Unchanged copy; the action now also clears `consumption_entries` via the shared table list.

## Delivery slices

### Slice 1: Migration 007 and the repository

1. `consumption_entries` into `schema.ts` and `PRODUCT_TABLE_NAMES`; `db:generate`, conflict-tolerant form, commit SQL and manifest.
2. Real-SQLite migration tests: fresh file applies 001–007; a step-7 file applies only 007; re-runs are no-ops.
3. `ConsumptionEntryRepository` (insert, list by day, list recents, update, hard delete) per [the repository recipe](../../packages/database/app/src/repositories/README.md). Delete-local-data test extended with a sentinel row.

### Slice 2: Units, catalogue, registry, and the derived resolution — the sign-off gate

1. `volume` and `energy` dimensions with exact conversion factors; the `alcohol` preference dimension over canonical mass; caffeine's fixed `mg` display; display resolutions and locale defaults. Pure, exhaustively tested — round-trips, boundaries, malformed input.
2. The drink catalogue, with servings and per-serving numbers; the volume × ABV × density → ethanol mass function; the four consumption-derived registry metrics with aggregation `sum`, `enabled: false` defaults, and `sensitive: true` on `alcohol_intake`.
3. The derived daily resolution: entries → per-day totals, folded into the resolved-day merge as a third source. Regression tests proving observation- and import-backed metrics are untouched, and that no consumption metric ever appears in a scored, factor, assessment, or user-enterable measurement surface.
4. **Canonical units, the ethanol constant, the alcohol display definitions, the slug, and every catalogue number are the sign-off gate for this slice.**

### Slice 3: The drinks surfaces

1. `/drinks` and `/drinks/[localDay]`: quick-add strip, recents, catalogue sheet, free entry, quantity and time adjustment, totals, edit and hard delete.
2. `settings/drinks`: which drink metrics are tracked, plus the alcohol and volume unit choices with live previews (into `settings/units` if it reads better as one screen — one decision, taken in review).
3. Trends entry point and summed series; goals on the derived metrics through the existing repository, in both directions.

### Slice 4: Insight, export v6, acceptance, and the hand-off

1. Factor presence derivation from entries in the daily-signal adapter; the two new catalogue pairs with copy; teaser arithmetic unchanged.
2. Export format v6: `consumptionEntries`, entry-level sensitive exclusion, new fixture, v1–v5 fixtures still parsing.
3. Full automated acceptance matrix below; update the product plan (sequencing split, step 8 status, open decisions 5-energy and 16 resolved) and record the step 9 hand-off.

**Delivered 19 August 2026.** Alcohol and caffeine factor presence now derives from positive canonical quantities on logged entries without changing the false-arm check-in rule. Two four-UK-unit threshold pairs join the authored catalogue, taking the teaser and evaluation pool from fourteen to sixteen without an engine change. Export v6 adds sorted snapshot-complete `consumptionEntries`; sensitive exclusion removes whole ethanol-carrying entries together with the alcohol metric, tracked row, and goals, while v1–v5 fixtures continue to parse. The acceptance matrix is covered across the existing focused suites and the product plan records the resolved unit/provider decisions and completed sequencing step.

## Expected touchpoints

| Area | Existing or planned files |
| --- | --- |
| Schema and migration | `packages/database/app/src/schema.ts`, `product-tables.ts`, `drizzle/*.sql`, `src/migrations/manifest.ts` |
| Repositories | New `consumption-entry-repository.ts`; exported from `src/index.ts` |
| Units | `packages/domain/src/units/` — `volume` and `energy` dimensions, the `alcohol` preference dimension, conversion constants, formatting |
| Catalogue and registry | New `packages/domain/src/content/drink-catalogue.ts`; `metric-registry.ts` (consumption-derived variant, four slugs) |
| Derived resolution | `apps/app/src/health/resolved-day.ts` and `resolved-series.ts` (third source, widened slug typing); new `apps/app/src/consumption/` for entry → daily-total math |
| Insight | `apps/app/src/insight/daily-signal.ts` (presence derivation), `packages/domain/src/content/insight-catalogue.ts` (two pairs) |
| Routes and screens | New `apps/app/src/app/drinks/` stack; `settings/drinks`; trends entry point; screens under `src/screens/` |
| Export | `apps/app/src/export/check-in-export.ts`, new v6 fixture |
| Tests | Extends `@bro/app:test` and the real-SQLite migration suites |

## Automated acceptance matrix

| Case | Expected result |
| --- | --- |
| Migration 007 on fresh and step-7 files | Fresh applies all seven; a step-7 device applies only 007; re-runs are no-ops. |
| Canonical storage | A pint of 4.5% lager logs one row with ethanol mass from volume × ABV × the declared density; renders `2.6 units`, `1.5 standard drinks`, `20.5 g` under the three preferences; the stored value never changes. |
| Snapshot fidelity | Editing or removing the catalogue entry a logged drink came from changes no logged day, no total, and no export. |
| Derived totals | Three entries on one day sum to the day's value on Trends, goals, history, and insight; deleting one changes every one of them on the next read; nothing was written to `observations`. |
| Source isolation | Consumption metrics never appear in scored, factor, assessment, or user-enterable measurement surfaces; observation- and import-backed metrics resolve exactly as before. |
| Default-off | A fresh install shows no drinks surface in Today or Trends; opting in shows it that day; the check-in is byte-identical either way. |
| Check-in isolation | Logging drinks on a day with no check-in leaves `hasCompletedCheckIn` false, streaks unchanged, and reminders unaffected. |
| Presence derivation | A logged drink with no tapped tag counts as a true alcohol day in the existing presence pairs; an unlogged, untapped check-in day stays false; a non-check-in day joins neither arm. |
| New pairs | The two threshold pairs clear and fail their gates on constructed series exactly as the pure engine tests specify; the teaser count reflects sixteen pairs. |
| Units | Exact factors for fl oz UK/US, litre, kcal/kJ, UK unit, US standard drink; repeated preference switches never drift a stored value; caffeine always renders mg. |
| Goals | A decrease goal on `alcohol_intake` derives progress from the derived series; changing display preference moves neither target nor progress. |
| Export v6 | `consumptionEntries` present; with sensitive off, every ethanol-carrying entry and the `alcohol_intake` metric, tracked row, and goals are absent while caffeine and fluid entries remain; v1–v5 fixtures still parse; v6 round-trips. |
| Delete local data | Entry rows gone; steps 1–7 guarantees still hold. |
| No backend request | The entire catalogue, entry, totals, trends, goals, insight, and export flow issues none. |

## Verification commands

```bash
pnpm nx run @bro/database-app:db:generate
pnpm nx run @bro/app:test --skipNxCache
pnpm nx run-many -t typecheck lint -p @bro/app @bro/database-app @bro/domain --skipNxCache
```

Preserve the complete output of a failing command. No device work is required by this step.

## Exit criteria

- A drink entered from the catalogue is stored once with canonical values and a full display snapshot, and round-trips through every display preference without the stored value moving.
- No daily total, anywhere, is a stored row; correcting or deleting an entry corrects every derived reading of that day on the next read, proven in both directions.
- Canonical units for alcohol, caffeine, volume, and energy — and the ethanol constant — are signed off before slice 2 completes; they are the units step 9's provider mapping converts into.
- The drink catalogue's servings and per-serving numbers are signed off, and the totals copy states quantities without grading them.
- Migration 007 follows the conflict-tolerance convention, proven on a real step-7 database file.
- Every step 1–7 surface is provably unchanged for a user who never opens the drinks surface, and the check-in is unchanged for everyone.
- Insight gains exactly two pairs and no engine change; presence derivation is proven in both directions.
- Export v6 ships with fixtures and entry-level sensitive exclusion; delete local data covers the new table.
- Automated suites, typecheck, and lint are green.

## Step 9 hand-off

Food logging (step 9) inherits the entry model finished and proven: `consumption_entries` with its snapshot rule, its hard-delete rule, and its derived-totals projection, so food's migration adds macro columns and a consumable reference rather than a second design. It inherits canonical energy, so provider mapping is a conversion into a decided unit rather than a second unit decision — the step 4 pattern, one step later. The `kind` column already partitions the table, and the recents, quantity, serving, and correction surfaces are built.

**The provider decision is taken: food lookup goes through our API, sourced from Open Food Facts first, behind a normalised response shape that lets UK and US datasets (USDA FoodData Central and a UK composition dataset are the named candidates) be added server-side without an app release.** That resolves [open decision 16](product-domains-and-data.md#open-decisions), and it deliberately chooses the option the product plan flagged as costly, for a reason the plan did not weigh: multi-source coverage is a product requirement here, and normalising three datasets on the device would mean three parsers, three licence-attribution paths, and a client release to change any of it. Step 9 must therefore carry the consequences the plan named, and they are its scope, not this one's:

- **A third carve-out to the no-backend-request promise**, documented in the [acceptance matrix](offline-first-identity-onboarding-premium.md#acceptance-test-matrix) as search-only, and the honest [privacy screen rewrite](product-domains-and-data.md#open-decisions) (open decision 24) that has now accumulated three items.
- **Offline-first has to survive a network dependency.** Logging, recents, correction, totals, and every derived reading stay local and unconditional; only *search* needs the network, and it degrades to recents plus the local cache rather than blocking. Looked-up results cache in `bro-local.db`, non-replicating and rebuildable, per the plan's [three-store split](product-domains-and-data.md#three-stores-not-two).
- **The search endpoint's retention posture is a design item before it ships**, not after: no account required, no user identifier attached, and a decision recorded on whether queries are logged at all. We can see food searches now; the design should mean we do not keep them.
- **Barcode scanning** (open decision 17) remains open and remains a native dependency and prebuild, batchable under the shared-prerequisites rule.
- **Pair-count discipline**, per the step 7 hand-off, is now a standing review item: nutrition offers dozens of plausible pairs, and the curated-list posture is what keeps the premium surface from producing a wrong screenshot.

Two further items carry forward. The **windowed-transform insight pair** — caffeine after a time of day against sleep — is the first genuinely new engine capability any step has asked for since step 7, and the entries now carry the `occurred_at` it needs. The **weekly-aggregation decision** (weekly unit caps, weekly habit cadence) is now wanted by two domains; whichever step takes it should take it once, for both. The `reminders` table remains kind-less after a fourth deferral.
