# Nicotine logging implementation plan

## Status

**Delivered, 1 September 2026.** All three slices are in: the generic substance-catalogue shape and the nicotine catalogue, `nicotine_intake` with the `nicotine` tag removed, `habit:nicotine-free`, the `nicotine_kg` column and its migration, the derived-totals mapping, substance-content export exclusion, and the descriptor-driven `/nicotine` stack with settings and FAB gating. Domain, mobile-model, logic, database-app, and app suites, typecheck, lint, and repo-wide `biome check` are green (39 / 53 / 122 / 351 tests).

Four decisions were taken during implementation that this plan had not anticipated; they are recorded in [Decisions locked](#decisions-locked-for-this-step) below rather than left in the diff. Nothing in the delivered work departs from the plan's intent.

This plan introduces optional smoking and vaping logging for people who want to build habits or goals around reducing or quitting, as a third consumption stream beside drinks ([step 8](step-8-drink-logging.md)) and food ([step 9](step-9-food-logging.md)). It is deliberately small: the entry table, the snapshot rule, the derived-totals projection, the catalogue discipline, recents, corrections, goals, and habit completion all exist and are proven — this step authors nicotine content into that machinery rather than designing anything new. The product plan already names the audience in its tag-catalogue rationale ([product-domains-and-data.md](product-domains-and-data.md), "the abstinence-tracking audience is large and already keeping this record somewhere"); this step is that observation getting a quantified surface.

The `nicotine` check-in tag is **removed outright**, not deprecated: the app is unreleased and the tag has no recorded use, so nothing depends on its slug. Its concept is taken over by the quantified counterpart, exactly as `alcohol` → `alcohol_intake` — this is the registry's own tag-needing-quantity convention coming due a second time, minus the migration debt the first time carried.

One forward-looking constraint shapes this step: **nicotine is not expected to be the last substance stream** — cannabis is a named candidate. Drinks and food earned bespoke surfaces because their journeys genuinely differ; nicotine and any later substance share one journey (pick an item, pick a serving, recents-heavy, one sensitive summed metric, `at_most` habits). So this step builds the **generic substance log** — a shared catalogue shape, a descriptor-configured store, descriptor-driven screens — with nicotine as its first configuration, so that a later substance is authored content plus a config object plus a migration column, not a fourth copy of the drinks stack. The entry table needs no generalising: `kind` is the logging journey, substances are the canonical columns, and an entry may carry several (a drink already carries ethanol, caffeine, and energy — which is also how a THC-and-calories edible would be represented without restructuring).

## Outcome

A man who wants to smoke less turns on nicotine logging, and each cigarette or vape session is two taps from the FAB — recents first, because a smoker logs the same thing many times a day. He adopts "Have a nicotine-free day" from the habit catalogue, or keeps an editable "at most" target and walks it down week by week. A week in, Trends shows his own nicotine series next to his sleep and his mood; nothing in the app congratulates or scolds him, and a lapse is one more logged entry, not a broken promise. A user who never opts in sees no smoking surface anywhere — not in the FAB, not in Trends, not in settings copy pushed at him.

The step is successful when three properties hold: a logged cigarette is stored once with its label, serving, and estimated nicotine mass snapshotted, and still reads correctly after the catalogue changes; a day's `nicotine_intake` is derived from entries at read and never stored; and a user who never enables nicotine tracking sees every existing surface byte-identical, including a check-in panel that simply no longer offers a Nicotine tag.

## Non-goals

- **No cessation programme, no coaching, no medical advice.** This is a log and the habit/goal machinery over it. Quit-plan content, NRT guidance, and health-outcome copy are a product decision for another day, if ever.
- **No NRT tracking (patches, gum, pouches).** The v1 catalogue is smoked and vaped nicotine only. Including cessation aids in `nicotine_intake` would break the metric's meaning for exactly the person doing best: a man quitting cigarettes via gum would log gum and lose his "nicotine-free day" while succeeding at the actual goal. If NRT ever arrives it is likely a separate metric, and that reasoning is recorded here so it is not relitigated casually.
- **No craving mechanic.** A "craving resisted" log is genuinely motivating for quitters and genuinely new machinery (an event that is the *absence* of consumption). Named in the hand-off, not smuggled in.
- **No new insight pairs.** Nicotine against sleep and anxiety are the obvious candidates and the pair-count discipline from the step 7 hand-off is the reason to wait: pairs are added when the series exists and the copy can be honest, not on the day the series is born. Zero engine changes, zero pair changes.
- **No smoking reminder.** The `reminders` table stays kind-less. "Did you smoke today" is the guilt mechanic this product has refused in every domain, and it is most corrosive here.
- **No new challenge.** A sobriety-area challenge is a candidate once the log exists; the challenge catalogue is not touched in v1.
- **No change to the check-in flow** beyond the tag panel naturally losing the removed Nicotine tag. `hasCompletedCheckIn` is untouched; nothing here writes an observation.
- **No custom-consumable library entries.** The free "something else" entry (label plus nicotine mg) plus recents covers repeatability, the step 8 posture. `custom_consumables` stays `food`/`drink`.
- **No cannabis content.** This step ships the generic substance machinery and nicotine's configuration of it, nothing more. A cannabis stream is a step of its own — content, a `thc_kg` column, a `thc_intake` metric, and its own product checkpoints — inheriting this step's surface; see the hand-off.
- **No new native dependency, no network request, no new dimension.** Nicotine is mass; `mass` is canonical and `mg` is a fixed display unit, the caffeine precedent exactly.

## Current baseline

- `consumption_entries` exists with `kind` (`'drink'`, `'food'`), full snapshot columns, hard deletes, `local_day`/`occurred_at`/`tz_offset_minutes` spine, and the `(kind, local_day)` index. Migration history has been squashed to a single baseline (`0000_flashy_leech`); the manifest is generated by `db:generate`.
- The registry's consumption-derived measurement variant is proven: `sum` aggregation, `enabled: false` overlay defaults, `sensitive` handling, fixed display units (`caffeine_intake` renders `mg` with no preference row).
- `ConsumptionStore` ([consumption-store.ts](../../../apps/app/src/consumption/consumption-store.ts)) is an abstract base parameterised by kind and metric slugs; `DrinksStore` and the food store are its two subclasses. Day snapshots, recents de-duplication, totals, goal progress, and validation come with it.
- The `/drinks` stack (`index`, `[localDay]`, `log`, `goals`, `custom`, `_layout`) and `settings/drinks` are the surface pattern to mirror.
- The QuickLogFab ([quick-log-fab.tsx](../../../apps/app/src/components/quick-log-fab.tsx)) offers Food, Drink, and Check-in unconditionally.
- `habit:alcohol-free` proves the reduction-habit shape: a metric habit, `direction: "at_most"`, `defaultTargetValue: 0`, completion derived from the day's consumption total, a day with nothing logged counting as met. Habit targets and days-of-week are user-editable in the habits screen, which is what makes tapering work with no new machinery.
- `wheel:sobriety` ("Sobriety & recovery") exists, sensitive, default-off.
- The check-in export is at format version 1 with fixtures; sensitive exclusion already drops whole ethanol-carrying entries (`check-in-export.ts`).
- The `nicotine` tag exists in the registry (sensitive, lifestyle, default-enabled) and is referenced only by [metric-registry.ts](../../../packages/domain/src/content/metric-registry.ts) and its test. No habit, insight pair, fixture, or screen names it.

## Decisions locked for this step

- **Nicotine is a third `kind` on `consumption_entries`, not a new table.** A cigarette is a thing consumed at a time with a label, quantity, and canonical content snapshotted beside it — the same shape as a pint. One nullable `nicotine_kg` column joins the entry table; everything else (snapshot rule, hard deletes, derived totals, recents, day boundaries) is inherited, not rebuilt.
- **One derived metric: `nicotine_intake`.** Consumption-derived measurement, canonical **mass in kilograms**, aggregation `sum`, `fixedDisplayUnit: "mg"` (the caffeine precedent — no preference row), `sensitive: true`, overlay default `enabled: false`. Registry label **"Nicotine"**; user-facing surface copy says "Smoking & vaping" where it names the activity rather than the quantity.
- **One substance-catalogue shape, authored per substance.** The domain gains a generic substance-catalogue entry shape — stable id, label, servings, each serving carrying a **map of canonical amounts** rather than named fields — with a shared snapshot function, so a later substance authors content into the same shape instead of minting a parallel one. `nicotine-catalogue.ts` is its first instance; the drink and food catalogues are not migrated to it (their journeys and shapes are bespoke and shipped).
- **Catalogue numbers are estimated *delivered* nicotine, and every number is a sign-off gate.** A cigarette *contains* ~10–12 mg but *delivers* roughly 1–1.5 mg; vape delivery varies with device and strength. The catalogue records typical-delivered estimates with the assumption documented in the file, the same way the drink catalogue owns regional servings. Provisional content, all subject to sign-off: **Cigarette** (1.2 mg), **Roll-up** (1.2 mg), **Cigar** (3 mg), **Vape, ~20 mg/ml** with servings "10 puffs" (0.8 mg) and "session" (1.5 mg), **Vape, ~10 mg/ml** with the same servings at half those figures, plus the free "something else" entry (label + mg per item). Estimates are for trend arithmetic, and the copy never presents them as measurements.
- **The `nicotine` tag is removed, and the slug is retired for its old meaning.** Registry entry and `TagSlug` member deleted, tests updated; remaining tag positions are left unrenumbered (positions are authored defaults, and a gap costs nothing). The "slug stays resolvable forever" contract is about recorded data; there is none. Should a stray `nicotine` observation ever exist on a dev device, `resolveMetric` already returns `unknown` gracefully — that tolerance is asserted, not assumed. The slug must never be reintroduced as a tag: the quantified metric owns the concept now, per the registry's own convention.
- **`habit:nicotine-free` joins the habit catalogue.** Metric habit on `nicotine_intake`, `direction: "at_most"`, `defaultTargetValue: 0`, `areaSlug: "wheel:sobriety"`, `sensitive: true`, every day by default. Description in the alcohol-free voice: *"Counts automatically from your smoke log: a day with nothing logged is nicotine-free."* Tapering is the existing edit-the-target journey — a man moves 0 to whatever mg his current ceiling is and walks it down; count-style targets ("at most 5 cigarettes") are deliberately not modelled in v1 and are named in the hand-off.
- **Default-off, and the FAB is gated — the first conditional quick-log action.** The metric ships `enabled: false` like every consumption metric. The QuickLogFab shows "Smoke or vape" only when `nicotine_intake` is tracked **or** an active habit targets it; Food, Drink, and Check-in stay unconditional. The asymmetry is deliberate: eating and drinking are universal, smoking is a minority behaviour and sensitive, and a permanent smoking button in every man's FAB is the product having a view about him.
- **The surface is the generic substance log, and nicotine is its first descriptor.** A **substance descriptor** — kind, metric slug, catalogue, route base, i18n namespace, icon — configures one `SubstanceStore extends ConsumptionStore` and one set of screens (`index` with today, recents strip, and running total; `[localDay]`; `log`; `goals`; a settings screen), following the `/drinks` stack's journeys but written against the descriptor, not the substance. The `/nicotine` stack and `settings/nicotine` are that machinery instantiated once. No tab changes. Entry points: FAB (when gated on), Trends, settings. A later substance adds a descriptor, a catalogue, a column, and a metric — no new store subclass logic, no copied screens.
- **Everything nicotine is sensitive, and exclusion is by substance content, not kind.** The metric is `sensitive: true`; export's sensitive exclusion drops **any entry carrying a sensitive substance whole** — the established `ethanolKg > 0` rule gains `nicotineKg > 0` — together with the metric's tracked row and any goals against it. Content-based rather than kind-based because it generalises: each later sensitive substance adds one predicate, and an entry that carries a sensitive substance through another journey (a THC edible logged as food, one day) is excluded correctly by construction. `nicotineKg` joins the export entry shape as a nullable field; absent parses as null, existing fixtures parse unchanged, and a new fixture proves exclusion in both directions. Format version follows the export suite's additive-change convention.
- **Nicotine renders in whole milligrams, and that is deliberate.** `mg`'s display resolution is 1 — right for caffeine at 95 mg, and initially wrong-looking for a 1.2 mg cigarette, which renders as `1 mg` and three as `4 mg`. Keeping it is the honest choice, not a compromise: these are delivery *estimates*, and a decimal place would assert a precision they do not have. Per-metric display resolution was considered and rejected as real machinery bought for false precision. The entry row names the thing logged; the milligram figure is there to trend against itself.
- **Catalogue amounts are authored in milligrams and divided into canonical kilograms.** Written as kilogram literals they do not survive a round trip — `0.8e-6 × 10⁶` is `0.7999999999999999` — which would put noise into the very numbers the sign-off gate exists to pin. `nicotineKgFromMg()` in the catalogue source keeps the authored figure readable and the stored value exact.
- **The shared store states its custom-consumable invariant rather than assuming it.** `ConsumptionStore` typed `kind` as any `ConsumptionEntryKind` while its custom-consumable helpers required a `CustomConsumableKind`. Rather than widen `custom_consumables` to substances it will never hold, the base class gained `customConsumableKind()`, which narrows for drink and food and throws for a substance stream — the "a substance has no user library, recents cover repeats" decision made checkable instead of implicit.
- **The descriptor carries resolved copy, not a namespace name.** i18next keys are literal-typed in this app, so a `${namespace}:key` template defeats them, and a dynamic `useTranslation(ns)` would defeat them in the screens too. Each stream's module supplies a `SubstanceCopy` of small functions resolved against its own typed namespace, so shared code never builds a key by hand and every key stays checked. The contract holds only what shared code actually reads.
- **Copy states, never grades.** Totals in mg with no thresholds, no "heavy", no guideline comparison, no health warnings. Logging after a lapse must cost exactly one entry and zero adjectives — relapse-tolerant copy is the difference between a log that survives a bad week and one that gets deleted with the app.

## Schema

`nicotine_kg REAL` (nullable) joins `consumption_entries` in [schema.ts](../../../packages/database/app/src/schema.ts); `pnpm nx run @bro/database-app:db:generate` regenerated it as migration `0001_fast_night_thrasher` — a single `ALTER TABLE … ADD COLUMN`. Note that the squashed baseline emits plain `CREATE TABLE`, not the `IF NOT EXISTS` form earlier plans describe: **Drizzle's `__drizzle_migrations` ledger is what makes a re-run safe now**, not statement-level conflict tolerance, and the upgrade test simulates a pre-nicotine device by seeding that ledger. `NULL` means not applicable; `0` means measured as none — the standing distinction. No new table, no new index (`(kind, local_day)` already serves the day read), so `PRODUCT_TABLE_NAMES` and delete-local-data are unchanged by construction.

`mobile-model` widens `ConsumptionEntryKind` to `"drink" | "food" | "nicotine"` and adds `nicotineKg: number | null` to `ConsumptionEntry`, optional on `CreateConsumptionEntry` alongside the food snapshot fields.

## User journeys and copy contract

### Turn it on

`settings/nicotine`, or adopting `habit:nicotine-free` from the sobriety area, tracks the metric. Nothing anywhere invites a non-smoker in; the surface is found, not promoted.

### Log a smoke

FAB → "Smoke or vape" → recents first (a smoker's log is the most repetitive in the app — the ten-second repeat target from step 8 matters most here), then the catalogue, then "something else". Default time now; earlier today one tap away.

### Walk it down

Adopt the habit at 0 for quitting, or set an "at most" target and reduce it over weeks. Completion derives from the day's entries; a nothing-logged day meets the target, the alcohol-free semantics unchanged.

### See it next to everything else

Trends renders the summed daily series once tracked; history and review pick it up like any consumption metric. The number is the user's own, in mg, ungraded.

### Correct the record

Edit or hard-delete any entry from its day; every derived reading of that day changes on the next read, nothing recomputed because nothing was stored.

### Take it with you

Export carries nicotine entries as stored; with sensitive data off — still the default — every nicotine entry, the metric's tracked row, and its goals are absent.

## Delivery slices

### Slice 1: Domain — the sign-off gate

1. The generic substance-catalogue shape and shared snapshot function in [packages/domain/src/content/](../../../packages/domain/src/content/), then `nicotine-catalogue.ts` as its first instance: entries, servings, per-serving delivered-mg estimates with the documented assumption. **Every entry and number is the sign-off gate for this slice.**
2. `nicotine_intake` in the registry (consumption-derived, mass, `mg` fixed display, `sum`, sensitive, default-off); the `nicotine` tag and `TagSlug` member removed; registry tests updated including the sensitive-tag and default-enabled assertions.
3. `habit:nicotine-free` in the habit catalogue with tests.

### Slice 2: Model, migration, and derived resolution

1. `mobile-model` kind and field widening; schema column; `db:generate`; real-SQLite migration test proving a fresh file and a current-baseline file both apply cleanly and re-runs are no-ops.
2. `packages/logic` consumption totals map `nicotine_intake` → `nicotineKg`; resolved-day/series regression tests prove drink and food metrics are untouched and the new metric sums per local day.
3. Export: `nicotineKg` on entries, substance-content sensitive exclusion (`nicotineKg > 0` joining the ethanol predicate) with tracked-row and goal removal, new fixture, existing fixtures still parsing.

### Slice 3: App surfaces

1. The substance descriptor type, `SubstanceStore extends ConsumptionStore`, and descriptor-driven screens; the `/nicotine` stack (`index`, `[localDay]`, `log`, `goals`, `_layout`) and `settings/nicotine` as the nicotine descriptor's instantiation; i18n namespace `nicotine` across locale files plus the new `quickLog.*` keys.
2. QuickLogFab gating: the "Smoke or vape" action appears when the metric is tracked or an active habit targets it; FAB tests cover both states.
3. Goals and Trends entry points through the existing repositories; habit adoption from the sobriety area verified end to end, including nothing-logged-day completion.

## Expected touchpoints

| Area | Files |
| --- | --- |
| Catalogue and registry | New generic substance-catalogue shape and `packages/domain/src/content/nicotine-catalogue.ts`; `metric-registry.ts` (+`nicotine_intake`, −`nicotine` tag) and tests; `habit-catalogue.ts` |
| Model | `packages/mobile-model/src/records.ts` (kind, `nicotineKg`) |
| Schema and migration | `packages/database/app/src/schema.ts`, generated `drizzle/` SQL and `migrations/manifest.ts`, repository tests |
| Derived resolution | `packages/logic/src/consumption/` totals mapping; resolved-day/series tests |
| Export | `packages/logic/src/export/check-in-export.ts`, new fixture |
| Stores and screens | New substance descriptor and `apps/app/src/substances/substance-store.ts` (extends `ConsumptionStore`), descriptor-driven screens, `apps/app/src/app/nicotine/` stack, `settings/nicotine.tsx`, `quick-log-fab.tsx`, i18n locales |

## Automated acceptance matrix

| Case | Expected result |
| --- | --- |
| Migration | Fresh and current-baseline files gain `nicotine_kg`; re-runs are no-ops; existing rows untouched. |
| Canonical storage | A logged cigarette stores one row with `nicotineKg` from the catalogue estimate × quantity; renders in mg; the stored value never changes when the catalogue does. |
| Derived totals | Entries sum to the day's `nicotine_intake` on Trends, goals, history; deleting one changes every reading on next read; nothing written to `observations` or `daily_metrics`. |
| Tag removal | The check-in tag panel offers no Nicotine tag; registry tests pass with the slug gone; `resolveMetric("nicotine")` returns `unknown` without throwing anywhere it is rendered. |
| Habit | `habit:nicotine-free` completes on a nothing-logged day and on a zero-total day, fails on a day with a logged entry, and honours an edited mg target in both directions — matching alcohol-free semantics exactly. |
| Default-off and FAB gating | Fresh install: no nicotine surface, three FAB actions. Tracking on (or habit adopted): the fourth action appears that day. Tracking off again: it disappears. Check-in byte-identical throughout. |
| Check-in isolation | Logging a smoke writes no observation; `hasCompletedCheckIn`, streaks, and reminders unaffected. |
| Sensitive export | With sensitive off, every entry with `nicotineKg > 0`, the metric's tracked row, and its goals are absent; ethanol-carrying entries are excluded as before; nicotine-free drink and food entries remain; existing fixtures parse; the new fixture round-trips. |
| Delete local data | Nicotine entries cleared via the shared table list; all standing guarantees hold. |
| No backend request | Catalogue, logging, totals, goals, habit completion, and export issue none. |

## Verification commands

```bash
pnpm nx run @bro/database-app:db:generate
pnpm nx run-many -t test typecheck lint -p @bro/domain @bro/mobile-model @bro/logic @bro/database-app @bro/app --skipNxCache --parallel=1
pnpm biome check .
```

Preserve the complete output of a failing command. No device work is required.

**`--parallel=1` is deliberate.** Running test, typecheck, and lint across five projects at full parallelism starves the CPU enough that three pre-existing end-to-end suites — `drinks-flow`, `review-flow`, and `check-in-flow` — intermittently exceed Jest's 5000 ms default timeout (roughly one run in seven on a developer machine). Unloaded they finish in about a second each, so the headroom is 5×, and none of them was touched by this step. It is an environmental flake, not a correctness signal; whoever next feels it should raise the timeout on those three suites rather than chase a phantom regression.

## Exit criteria

- Catalogue entries and delivered-mg estimates signed off, with the estimation assumption written in the file.
- A logged entry round-trips the snapshot rule: catalogue edits never change a logged day, total, or export.
- No daily nicotine total is a stored row anywhere.
- The `nicotine` tag is gone from registry, types, and tests, with unknown-slug tolerance proven.
- `habit:nicotine-free` completion proven in both directions including the nothing-logged day.
- Every existing surface is byte-identical for a user who never opts in, and the FAB gates correctly in both directions.
- The store and screens are written against the substance descriptor, with nothing nicotine-specific outside the descriptor, the catalogue, and copy — reviewed as the "second substance is content plus config" claim, not assumed.
- Sensitive export exclusion covers entries, tracked row, and goals; fixtures prove it.
- Test, typecheck, lint, and `biome check` are green.

## Hand-off

**Cannabis is the named next substance, and this step is built so it inherits rather than copies.** Its delivery is: a `thc_kg` column, a `thc_intake` metric (mass, `mg` fixed display, `sensitive: true`, default-off), a `cannabis-catalogue.ts` in the shared shape (flower, vape, edible — an edible carries `energy_kcal` beside `thc_kg`, which the entry model already represents), a substance descriptor, an `at_most` habit in `wheel:sobriety`, and the `thcKg > 0` predicate joining the sensitive-exclusion rule. Two checkpoints belong to that step, not this one: an App Store / Play policy review (consumption *tracking* is generally acceptable where trade and facilitation are absent, but it is a review-risk item to confirm, not assume) and a market-legality read that argues for an even quieter found-not-promoted posture than nicotine's. Delivered-THC estimates are fuzzier than nicotine's; the documented-assumption discipline carries over and its numbers are that step's sign-off gate.

Three further items are deliberately left on the table. **Count-based targets** ("at most 5 cigarettes") would need either a per-kind count metric or unit-aware targets over `nicotine_intake`; wait for evidence that mg targets fail real users before building it. **Insight pairs** — nicotine against sleep and anxiety are the authored-pair candidates once real series exist; they need no engine change and belong to whichever step next reviews the pair list. **Craving support and NRT** are the two ways this domain could grow past a log: a "craving resisted" event is new machinery (worth it only with demand), and NRT tracking must be a separate metric so a gum-assisted quit never reads as failure — that constraint is this plan's most important sentence for whoever picks it up.
