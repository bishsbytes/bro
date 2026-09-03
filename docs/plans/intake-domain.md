# Intake domain implementation plan

## Status

**Phase 1 delivered, 3 September 2026.** Slices 1–5 are in: the constituent catalogue and generated registry block, `µg`/`salt_g` and the `sodium` preference dimension, the re-authored drink and nicotine catalogues, the external consumable contract, the four new tables as a re-squashed `0000` baseline, the three repositories, the calculation layer, export format v2, the provider returning the consumable shape with a barcode lookup, and the app rebuilt on `IntakeStore`, `LibraryStore`, `IntakeSettingsStore`, and `IntakeSearchStore` behind `/intake/log`, `/intake/[localDay]`, `/intake/goals`, `/intake/library`, and `settings/intake`. All six projects' test, typecheck, and lint targets and repo-wide `biome check` are green. Every sign-off item below still stands as a sign-off item; the code pins the provisional figures.

Three deviations from the text below, each recorded where it applies: composition scaling and recipe arithmetic live in `@bro/domain/composition` and are re-exported from `@bro/logic`, because the consumable repository recomputes a recipe inside its transaction and data access may depend on domain and model only; `@bro/domain/food-search` is a leaf module that also defines the base consumable shapes (kinds, basis, portions, the constituent map), because the API type-checks under Node's ESM resolution and cannot follow the domain's extensionless relative imports — `./consumable` re-exports them; and `expandSavedMeal` waits for Phase 5, which shapes the saved-meal item it expands. `listAll()` remains in export, review, goal creation, and the habits and insight stores use `listBetween`; the rest is named debt in the hand-off.

**Draft, 2 September 2026.** The delivery plan for the [intake, nutrition and consumption proposal](consumption-nutrition.md). It takes the three shipped consumption streams — [drinks](step-8-drink-logging.md), [food](step-9-food-logging.md), and [nicotine](nicotine-logging.md) — and the [Intake tab](intake-body-split.md) that fronts them, and rebuilds them on one generic model: a **consumable** contains **constituents**, and an **intake event** records what was taken. Those three plans remain the record of what shipped and why; this plan supersedes their architecture, not their decisions about copy, sensitivity, or offline behaviour, all of which carry forward.

**The slate is clean.** The app is unreleased, so nothing here is migrated, adapted, or kept for compatibility: the old tables, catalogues, stores, screens, and copy are deleted in Phase 1, the migration history is re-squashed to one baseline, and developer devices reset with delete local data.

Community content is a later piece of work. This plan does not build it, but Phase 1 fixes the invariants a community catalogue will need — provenance, versions, snapshots, fork-on-edit — because they are cheap on day one and expensive to retrofit. See [Community readiness](#community-readiness).

## Outcome

A man opens the Intake tab and sees his day as one stream: a coffee at 07:40, a nicotine pouch at 11:45, lunch at 13:00, a vitamin D tablet and creatine at 15:30, two pints at 19:00. Every one of them was logged the same way — pick it, pick a portion, done — and each landed as one event with everything it contained snapshotted beside it. Above the stream, the day's totals are projections over that one list: energy and macros, caffeine, alcohol in his units, nicotine if he has that stream on, the supplements he tracks. Nothing counts down to a target. Each number sits against *his* usual range, the way weight does on Body.

He builds a protein smoothie once — milk, a banana, whey, creatine, a shot of espresso — and it is a recipe whose calcium, caffeine, and creatine add up from its ingredients without a smoothie feature existing. An espresso martini is the same thing with vodka in it. His usual breakfast is a saved meal that logs as four independent events he can edit one at a time. A week's plan says what he intends to eat and take; confirming an item turns intent into an event, skipping it does not.

All of it works on a train with no signal. Searching a product database is the only thing that needs a connection, exactly as today. When a community catalogue arrives, what he downloads becomes his — a versioned copy in his library, forked the moment he edits it — and nothing he has already logged ever changes because someone upstream changed a recipe.

The plan is successful when four properties hold: **a new constituent is a registry entry, not a migration**; every logged event reads identically after the consumable, recipe, catalogue, or provider record behind it has changed or gone; every intake projection — nutrition, caffeine, alcohol, nicotine, supplements — is arithmetic over the one event table with no per-stream storage; and every rule the three shipped plans established about sensitivity, default-off streams, offline-first, and ungraded copy still holds, proven by the same kinds of test.

## Non-goals

- **No community catalogue, publishing, download, or update flow.** Foundations only. The catalogue, its server, and the account it needs are Phase 9, planned when Phase 1 has settled the shapes it publishes.
- **No barcode scanning.** Still the native batch ([open decision 17](product-domains-and-data.md#open-decisions)). A barcode *field* on a consumable and a barcode *lookup* through the provider are in scope; the camera is not.
- **No AI-assisted logging.** The unified log screen and the provider normalisation boundary are where it would attach; nothing here calls a model.
- **No medication domain.** `medication` is a consumable kind so a tablet can be logged. Schedules, dose reminders, adherence, interactions, and prescribing information are a domain of their own, as the proposal says, and they inherit this model rather than shaping it.
- **No user-defined constituents.** Custom items cost the authored-content guarantee ([catalogue, overlay, snapshot](product-domains-and-data.md#catalogue-overlay-snapshot)); the catalogue ships generous instead. Named in the hand-off.
- **No targets that count down, no grading, no population reference zones on a gauge.** The design rules and every consumption plan before this one. Goals and `at_most` habits keep working as they do; the Intake tab renders usual ranges, not allowances.
- **No new insight pairs and no engine change.** Constituents make the windowed caffeine pair easier to author one day; that day is not this plan's.
- **No weekly goals.** The calculation layer gains period totals because the proposal asks for them and they are arithmetic; the weekly *goal and habit* decision stays with the tracking domain, still to be taken once for every domain that wants it.
- **No sync.** Every new table is authored to replicate correctly; nothing here turns it on.
- **No change to the check-in.** Logging intake never writes an observation, the sixth time this holds.

## Current baseline

Verified against source, not the earlier plans:

- **One event table, three streams.** `consumption_entries` ([schema.ts](../../packages/database/app/src/schema.ts)) carries `kind` (`drink` | `food` | `nicotine`), a display snapshot (`label`, `serving_label`, `quantity`), and **eight fixed canonical columns**: `volume_l`, `ethanol_kg`, `caffeine_kg`, `nicotine_kg`, `energy_kcal`, `protein_g`, `carbs_g`, `fat_g`. Two reference columns point back for re-lookup only: `catalogue_ref` (authored drink or nicotine id) and `consumable_ref` (`custom:<id>` or `off:<barcode>`). Adding nicotine cost a migration column, a registry metric, and a line in the totals mapping — the proposal's argument in one commit.
- **Three catalogue shapes.** [drink-catalogue.ts](../../packages/domain/src/content/drink-catalogue.ts) (servings with absolute per-serving numbers and ABV), [substance-catalogue.ts](../../packages/domain/src/content/substance-catalogue.ts) (servings carrying a map keyed by entry column names, nicotine as its first instance), and `custom_consumables` (user foods and drinks, servings as JSON with absolute per-serving numbers, recipes as a flag plus `custom_consumable_components` whose nutrition is snapshotted and unlinked from any consumable).
- **Provider foods live in the cache, not the library.** [food-search-store.ts](../../apps/app/src/food/food-search-store.ts) caches `FoodSearchResult` rows in `bro-local.db`; logging one writes an entry with `consumable_ref: off:<barcode>` and nothing replicating. A phone change loses "my foods" that came from search.
- **The registry hard-codes the derived metrics.** `ConsumptionDerivedMeasurementSlug` in [metric-registry.ts](../../packages/domain/src/content/metric-registry.ts) is a union of eight slugs; [daily-totals.ts](../../packages/logic/src/consumption/daily-totals.ts) maps each to an entry column by hand. `resolveMetricDay` ([resolved-day.ts](../../packages/logic/src/health/resolved-day.ts)) reads consumption as a third source; Trends, goals, history, habits, and insight all go through it.
- **Four stores over one abstract base.** [ConsumptionStore](../../apps/app/src/consumption/consumption-store.ts) owns day snapshots, recents de-duplication (keyed on every canonical column), goals, corrections, and the custom library; `DrinksStore`, `FoodStore`, and the descriptor-driven `SubstanceStore` specialise it. Every day read calls `listAll()` on the entry table — the window both hand-offs asked for is still owed.
- **Three route stacks and three settings screens.** `/drinks`, `/food`, `/nicotine`, each with `index`, `log`, `[localDay]`, `goals` (drinks and food add `custom`); `settings/drinks`, `settings/food`, `settings/nicotine`. The [Intake tab](../../apps/app/src/screens/intake/intake-screen.tsx) is a summary row per stream reading each store's `loadToday()`; the smoking row and the FAB's "Smoke or vape" action are gated on `SubstanceStore.isTracked()`.
- **Sensitivity is content-based.** Export's `carriesSensitive` drops any entry with `ethanolKg > 0` or `nicotineKg > 0`, plus the metric's tracked row and goals. `parseCheckInExport` accepts only the current format version (1, after the squash), so a format change regenerates fixtures rather than adding a parser.
- **The provider boundary is proven.** `/api/food/search` and `/api/food/:ref` in [apps/api](../../apps/api/src/routes/food.ts) return the provider-neutral `FoodSearchResult` (four macros per serving) from Open Food Facts, anonymous, no query retention, coarse in-memory rate limit, ODbL attribution on every result.
- **Reusable surface parts exist.** [WeekStrip](../../apps/app/src/components/week-strip.tsx) and [DayPager](../../apps/app/src/components/day-pager.tsx) from the Today strip; [BaselineGauge](../../apps/app/src/components/baseline-gauge.tsx) and `resolveMeasurementBaseline` from Body; `LogConfirmationToast`, `ModalSheet`, `OptionSheet`, `ListRow`.
- **The app is unreleased, and the migration history has been squashed once already.** `drizzle/` holds `0000_flashy_leech` plus the nicotine column; the migrator suite proves a fresh file and a re-run, and one upgrade case from the pre-nicotine baseline. Nothing below builds on any of it: the tables, the upgrade case, and the code that reads the old columns all go.

## What changes, and what does not

| Proposal concept | Today | After Phase 1 |
| --- | --- | --- |
| Constituent | A column per substance on the entry, a metric per column | An authored **constituent catalogue**; the registry's intake metrics are generated from it |
| Composition | Absolute numbers per serving | Amounts per **basis** (100 g, 100 ml, or one portion); portions scale it |
| Consumable | Drink catalogue, nicotine catalogue, `custom_consumables`, food cache | One shape: authored **system** consumables in the binary, and a **library** table for user, provider, and (later) community rows |
| Portion | Servings, each with its own numbers | Portions with a mass, a volume, or a multiple of the basis portion |
| IntakeEvent | `consumption_entries` with eight fixed columns | `intake_events` with a **constituent map** snapshot, plus mass and volume consumed |
| IntakeContext | None (declined in step 9) | Optional, never required, suggested from the clock |
| Recipe | Custom consumable with unlinked components | A consumable whose composition is **calculated from ingredient rows** that reference library consumables |
| Saved meal | None | Phase 5 |
| Meal plan, planned intake | None | Phase 6 |
| TrackingMetric | Registry metric + tracked-metric overlay + goals | Unchanged machinery, driven by the constituent catalogue |
| ContentSource | `catalogue_ref` / `consumable_ref` strings | A **source** on every library row and a **source ref** on every event, ingredient, and item |
| Provider adapter | Open Food Facts → four macros | Same boundary, returning the consumable shape with the full constituent map |

What does **not** change: the snapshot rule, hard deletes, derived-never-stored totals, canonical units with edge conversion, default-off streams, the gating of sensitive streams, the anonymous search endpoint, and the copy contract. The proposal's field names (`grams`, `millilitres`, `userId`) yield to standing conventions: canonical kilograms and litres, and no per-account ownership on local rows.

## Decisions locked for this plan

- **Constituents are authored content, and a new one never migrates.** A `constituent-catalogue.ts` joins [packages/domain/src/content/](../../packages/domain/src/content/) with the same rules as every other catalogue: permanent codes, unknown codes tolerated forever, a copy edit is never a migration. Each definition carries a code, label, category, physical dimension (`mass`, `volume`, or `energy` — canonical kg, l, kcal), display (a fixed unit or a preference dimension), sensitivity, and whether community publishing may carry it. This is the [observations-not-a-wide-row](product-domains-and-data.md#observations-not-a-wide-daily-row) argument applied to what a consumable contains, and it is the proposal's central change.
- **The registry's intake metrics are generated from the catalogue, one per constituent, slug `<code>_intake`.** No hand-written union and no legacy slug map: `alcohol_intake` becomes `ethanol_intake`, `carbs_intake` becomes `carbohydrate_intake`, and the habit catalogue, the insight pairs, and the tests that name them follow. The slug-permanence rule protects data on released devices; there are none, so it has nothing to protect until this step ships, after which it applies to the generated names. Labels stay the user's words — `Alcohol`, `Carbohydrate`. All ship `enabled: false`, so twenty-odd metrics change nothing on Trends or in settings until tracked. `resolveMetricDay`, the daily-signal adapter, Trends, goals, habits, and insight need **no interface change**: the consumption source reads `event.constituents[metric.constituentCode]` instead of a named column.
- **An event stores its constituents as one JSON map, keyed by code, in canonical units, already scaled by quantity.** `constituents TEXT NOT NULL` on `intake_events`. The precedent is `custom_consumables.servings`: read whole with its row, never queried across rows in SQL, and totals are computed in `@bro/logic` today anyway. A child table was considered and rejected — under sync a delete becomes N deletes, and nothing reads a constituent without its event. Unknown codes survive the round trip untouched and are excluded from totals until a build knows them, which is the same posture as unknown metric slugs.
- **Fluid is a constituent.** `fluid` (dimension volume) replaces the special reading of `volume_l`. A drink authored per 100 ml carries `fluid: 0.1 l` by construction, so `fluid_intake` sums it like everything else, a smoothie's fluid adds up from its milk and juice, and the totals engine has no special case. The event still snapshots `volume_l` and `mass_kg` as the amount consumed; that is provenance, not a total.
- **Composition has a basis, and portions scale it.** `basis` is `{ mass 0.1 kg }`, `{ volume 0.1 l }`, or `{ portion <id> }`. A portion carries `massKg`, `volumeL`, or `basisUnits` (a multiple of the basis portion: half a cigarette is 0.5, a pack of two tablets is 2). Logging by weight or volume directly is allowed whenever the basis is mass or volume. The scaling function lives in `@bro/logic` and rejects a portion it cannot relate to the basis rather than guessing.
- **System consumables stay in the binary; the library holds what the user has.** The drink and nicotine catalogues are re-authored in the consumable shape (drinks per 100 ml with an ABV helper so the readable figure is what is signed off; nicotine per portion) and remain catalogues: authored, versioned with the release, never in the database. The `consumables` table holds `user`, `provider`, and later `community` rows. The logging surface presents both through one read model, and **editing a system item forks it into the library** with `forkedFrom` recording where it came from. This keeps our content out of every replicating database, which the product plan requires, and it is exactly the fork rule community content needs.
- **Logging a provider result saves it to the library.** Today a searched food leaves only an entry and a cache row. After this plan it writes a `provider`-sourced library consumable (idempotent on `off:<barcode>`) and logs against it, so "my foods" survive a phone change and repeat offline forever. The cache in `bro-local.db` keeps holding results that were seen but not used, and it never replicates.
- **A recipe is a consumable whose composition is calculated.** `recipe_ingredients` reference library or system consumables by id and source ref, snapshot the ingredient's name and scaled constituents at compose time, and the recipe's own `constituents` per yield unit are **recomputed and stored on the consumable** whenever an ingredient changes. A recipe's basis is one yield unit: `{ portion }` when the yield is in servings, portions, or glasses, and mass or volume when it is in grams or millilitres, so "half a serving" and "200 ml of the soup" both scale through the ordinary portion factor. Logging a recipe is therefore an ordinary consumable log — one event, snapshotted — and a recipe can be an ingredient of another recipe or an item in a saved meal without special cases. Cycles are rejected at save. This keeps step 9's "one entry per recipe" invariant and adds the linkage it lacked.
- **Six kinds, and they drive UI, not behaviour.** `food`, `drink`, `supplement`, `medication`, `nicotine`, `other`. The event's `kind` snapshots the consumable's kind and partitions the stream views; nothing in the calculation layer branches on it. `nicotine` is a kind rather than folding into `other` because the nicotine plan's gating, sensitivity, and habit rules are keyed on it and must not loosen.
- **Streams are an explicit overlay, and sensitive ones are still found, not promoted.** A small replicating `intake_streams` table records which optional kinds are on: `supplement`, `medication`, `nicotine`, `other`. Food and drink are always on. The nicotine gate becomes "stream on": off on a fresh install, switched on from settings or by adopting `habit:nicotine-free`, the found-not-promoted posture the nicotine plan set. Everything the nicotine plan gated — the FAB action, the tab row, search results of that kind — gates on the stream, so a user who never opts in sees no supplement, medication, or smoking surface anywhere.
- **Intake context is optional and never assumed.** `context` (`breakfast`, `lunch`, `dinner`, `snack`, `drink`, `supplement`, `medication`, `other`) is nullable on the event. The log screen suggests one from the clock and the kind; the suggestion is a pre-filled chip, not a stored default, and a coffee at 10:30 needs no meal. Step 9 declined this as a schema commitment that constrains the entry; a nullable column that nothing requires does not.
- **Sensitivity generalises by constituent and by kind.** A constituent definition carries `sensitive` (ethanol and nicotine today); a kind may be sensitive whole (`medication`, `other`). Export drops any event carrying a positive amount of a sensitive constituent or of a sensitive kind, together with the metric's tracked row and goals — the shipped rule with the predicate moved into the catalogue, so the next sensitive substance adds a definition, not a clause.
- **The old structure is deleted, not migrated.** `consumption_entries`, `custom_consumables`, `custom_consumable_components`, the drink and substance catalogue shapes, the substance descriptor, `ConsumptionStore` and its three subclasses, the `/food`, `/drinks`, and `/nicotine` stacks with their settings screens, and the `food`, `drinks`, and `nicotine` copy namespaces all go in Phase 1. The migration history is re-squashed to a single baseline that creates the new tables directly, as was done once before the nicotine step, and developer devices reset with delete local data. A compatibility layer would cost more than it saves and would leave two names for everything. Vocabulary follows the proposal: `IntakeEvent`, `Consumable`, `Constituent`, `Portion`, `IntakeStore`. UI copy keeps the friendlier words — Food & drink, Meals, Supplements, Smoking & vaping — and the user never meets the word constituent.
- **Every reusable row carries provenance from day one.** `source` (`user`, `system`, `provider`, `community`) and `forkedFrom` on consumables, saved meals, and meal plans; a `sourceRef` string on every event, ingredient, item, and planned intake naming what it was logged or composed from. Local row ids stay client-generated UUIDs; a community `contentId` and `version` live inside `source`, never in the primary key. See [Community readiness](#community-readiness) for why each of these is there.
- **Intake projections render against the user's usual range, never a target.** Each tracked constituent on the Intake tab is a metric row with the compact baseline treatment Body uses — a band for the middle half of the last 90 logged days, a mark for today — and a plain read: "Inside your usual 1,900–2,400 kcal." Below fourteen logged days the row shows the number alone. Population references (RDA, guideline units) are the Body screen's rule: off by default, caption-only when on, never a coloured zone. This is what "beyond MyFitnessPal" means in this product: the comparison is you against you.
- **Entry reads get a window.** `listBetween(fromDay, throughDay)` joins the event repository, and every intake read uses it. The other stores that call `listAll()` (Trends, insight, history, habits, review) are switched in the sweep where the change is mechanical and left where it is not; the debt is at least named in one place.
- **The calculation layer is pure and lives in `@bro/logic`.** `packages/logic/src/intake/` holds composition scaling, recipe calculation, saved-meal expansion, day and period totals, and projection grouping. It imports records from `@bro/mobile-model` and the catalogue from `@bro/domain`, and nothing else — the split the logic package's own header explains.

## Domain shapes

Types as they will appear in `@bro/domain` (catalogue) and `@bro/mobile-model` (records). Field names are settled here so the repositories, export, and screens agree; column names follow them in snake case.

```ts
// @bro/domain — authored
type ConstituentCategory =
  | "energy" | "macronutrient" | "micronutrient" | "hydration"
  | "stimulant" | "alcohol" | "supplement" | "medication" | "other";

type ConstituentDefinition = {
  code: string;                       // permanent: "protein", "caffeine", "vitamin_d"
  label: string;
  category: ConstituentCategory;
  dimension: "mass" | "volume" | "energy";   // canonical kg | l | kcal
  display:
    | { fixedDisplayUnit: DisplayUnit }               // "g", "mg", "µg", "kcal"
    | { unitPreferenceDimension: UnitPreferenceDimension }; // alcohol, volume, sodium
  // the registry metric is generated as `${code}_intake`; nothing here names it
  sensitive: boolean;
  publishable: boolean;               // may community content carry it
  defaultPosition: number;
};

type ConsumableKind = "food" | "drink" | "supplement" | "medication" | "nicotine" | "other";

type CompositionBasis =
  | { type: "mass"; massKg: number }
  | { type: "volume"; volumeL: number }
  | { type: "portion"; portionId: string };

/** code → canonical amount. Unknown codes are preserved, not summed. */
type ConstituentAmounts = Readonly<Record<string, number>>;

type Portion = {
  id: string;
  label: string;                      // "pint", "1 medium", "tablet"
  massKg: number | null;
  volumeL: number | null;
  basisUnits: number | null;          // multiple of the basis portion
};

type ContentSource =
  | { type: "user" }
  | { type: "system"; key: string }                       // "drink:lager-4_5"
  | { type: "provider"; provider: string; externalId: string } // "off", "5000..."
  | { type: "community"; contentId: string; version: number };

// @bro/mobile-model — records
type Consumable = {
  id: string;
  kind: ConsumableKind;
  name: string;
  brand: string | null;
  barcode: string | null;
  basis: CompositionBasis;
  constituents: ConstituentAmounts;   // per basis
  portions: Portion[];
  defaultPortionId: string | null;
  recipe: { yield: RecipeYield } | null;   // ingredients live in recipe_ingredients
  source: ContentSource;
  forkedFrom: ContentSource | null;
  archivedAt: number | null;
  createdAt: number; updatedAt: number;
};

type RecipeYield = { quantity: number; unit: "serving" | "portion" | "glass" | "ml" | "g" };

type RecipeIngredient = {
  id: string; recipeId: string; position: number;
  consumableId: string | null;        // library row, may dangle after a delete
  sourceRef: string | null;           // "system:drink:espresso" | "off:…" | "library:<id>"
  name: string;                       // snapshot
  portionLabel: string | null; quantity: number;
  massKg: number | null; volumeL: number | null;
  constituents: ConstituentAmounts;   // snapshot, scaled to this ingredient
  createdAt: number; updatedAt: number;
};

type IntakeContext =
  | "breakfast" | "lunch" | "dinner" | "snack"
  | "drink" | "supplement" | "medication" | "other";

type IntakeEvent = {
  id: string;
  kind: ConsumableKind;               // snapshot of the consumable's kind
  consumableId: string | null;
  sourceRef: string | null;
  name: string; brand: string | null;
  portionLabel: string | null; quantity: number;
  massKg: number | null; volumeL: number | null;
  constituents: ConstituentAmounts;   // snapshot, already × quantity
  context: IntakeContext | null;
  notes: string | null;
  occurredAt: number; localDay: string; tzOffsetMinutes: number;
  createdAt: number; updatedAt: number;
};

type IntakeStream = { id: string; kind: ConsumableKind; enabledAt: number; disabledAt: number | null; createdAt: number; updatedAt: number };
```

Saved meals and meal plans are shaped in their own phases below; their rows follow the same provenance and snapshot rules.

## Schema

Phase 1 re-squashes the migration history: `drizzle/` and the generated manifest are deleted, the three old tables are removed from `schema.ts` and `PRODUCT_TABLE_NAMES`, and `db:generate` produces a new `0000` baseline from the final schema — the same operation the repo performed before the nicotine step. No table is renamed and no row is backfilled. The migrator suite keeps its fresh-file and re-run cases and drops the pre-nicotine upgrade case, which no longer has a "before". Standing conventions are unchanged: client UUIDv7 ids, epoch-ms timestamps, canonical values, and Drizzle's `__drizzle_migrations` ledger as what makes a re-run safe (the squashed baseline emits plain `CREATE TABLE`, not the `IF NOT EXISTS` form).

```sql
CREATE TABLE intake_events (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,                 -- consumable kind, snapshotted
  consumable_id TEXT,                 -- library row; may dangle after a delete
  source_ref TEXT,                    -- 'system:drink:lager-4_5' | 'off:5000…' | 'community:<id>@<v>'
  name TEXT NOT NULL,
  brand TEXT,
  portion_label TEXT,
  quantity REAL NOT NULL,
  mass_kg REAL,                       -- amount consumed, where known
  volume_l REAL,
  constituents TEXT NOT NULL,         -- JSON map code → canonical amount, already × quantity
  context TEXT,
  notes TEXT,
  occurred_at INTEGER NOT NULL,
  local_day TEXT NOT NULL,
  tz_offset_minutes INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_intake_events_day ON intake_events (local_day);
CREATE INDEX idx_intake_events_kind_day ON intake_events (kind, local_day);

CREATE TABLE consumables (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  brand TEXT,
  barcode TEXT,
  basis TEXT NOT NULL,                -- JSON CompositionBasis
  constituents TEXT NOT NULL,         -- JSON map, per basis
  portions TEXT NOT NULL,             -- JSON Portion[]
  default_portion_id TEXT,
  recipe TEXT,                        -- JSON { yield } for a recipe, else NULL
  source_type TEXT NOT NULL,          -- 'user' | 'provider' | 'community'
  source_ref TEXT,                    -- provider external id or community content id
  source_version INTEGER,             -- community version
  forked_from TEXT,                   -- JSON ContentSource
  archived_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_consumables_kind ON consumables (kind, archived_at);
CREATE INDEX idx_consumables_source ON consumables (source_type, source_ref); -- provider idempotency

CREATE TABLE recipe_ingredients (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  consumable_id TEXT,
  source_ref TEXT,
  name TEXT NOT NULL,                 -- snapshot
  portion_label TEXT,
  quantity REAL NOT NULL,
  mass_kg REAL,
  volume_l REAL,
  constituents TEXT NOT NULL,         -- JSON map, scaled to this ingredient
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_recipe_ingredients_recipe ON recipe_ingredients (recipe_id, position);

CREATE TABLE intake_streams (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  enabled_at INTEGER NOT NULL,
  disabled_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

Phase 5 adds `saved_meals` and `saved_meal_items`; Phase 6 adds `meal_plans` and `planned_intakes` and a nullable `planned_intake_id` on `intake_events`. Every table joins `PRODUCT_TABLE_NAMES`, so migration verification and delete-local-data inherit them. `food_cache` in `bro-local.db` keeps its shape and its non-replicating status; its payload becomes the consumable-shaped provider result.

`NULL` versus zero keeps its meaning inside the map: an absent code is "not applicable or unknown", a zero is "measured as none", and the totals engine counts a zero and skips an absence exactly as the column version did.

## The calculation layer

`packages/logic/src/intake/`, pure, exhaustively tested, no React, no SQLite:

| Function | Answers |
| --- | --- |
| `portionFactor(consumable, selection)` | How many bases a portion × quantity, or a direct mass/volume, is; throws when the portion cannot be related to the basis |
| `scaleComposition(consumable, selection)` | The constituent map, mass, and volume for that selection — what an event snapshots |
| `addConstituents(...maps)` | Sums maps code-wise, preserving unknown codes |
| `calculateRecipeComposition(ingredients, yield)` | Per-yield-unit constituents plus mass/volume, from ingredient snapshots; cycle detection is the repository's job at save |
| `expandSavedMeal(meal, resolve)` | The N event drafts a saved meal logs, from current consumables with the item snapshot as fallback |
| `intakeDayTotal(code, localDay, events)` | Replaces `consumptionMetricDayTotal`; null when no event carries the code, zero when one carries zero |
| `intakePeriodTotals(code, fromDay, throughDay, events)` | Daily series and sum over a window; `trailingDailyMean` moves here unchanged |
| `intakeProjections(events, tracked, catalogue)` | The Intake tab's grouped rows: per category, per tracked constituent, day value and the readings the baseline needs |
| `intakeBaseline(code, events, throughDay)` | Adapts day totals into `resolveMeasurementBaseline`'s reading shape so the compact gauge draws the same way it does on Body |

`resolveMetricDay` keeps its signature and calls `intakeDayTotal` with the metric's `constituentCode`. The insight daily-signal adapter is untouched.

## User journeys and copy contract

### Log something

One screen for everything: `/intake/log`, reached from the FAB's Food, Drink, and gated stream actions (each a kind preset on the same screen, so muscle memory and gating survive) and from the tab. **Recents first**, across kinds, de-duplicated on what a repeat would reproduce — then the library, then saved meals, then the system catalogue, then search, then "something else". Pick an item, pick a portion or type a weight, adjust quantity, save; the toast confirms and the screen stays for the next item, because a meal is several events. Default time is now; earlier today and yesterday are one tap; a context chip is suggested and ignorable. A repeat is three taps and no network; a first-time catalogue pick is under twenty seconds.

### See what it adds up to

The Intake tab is the day: the [week strip](today-week-strip.md) pinned under the header, one metric-size energy total, then a card per tracked category — Nutrition, Stimulants, Alcohol, Smoking & vaping, Supplements — each a list of metric rows with a compact usual-range mark, then the day's events in time order across every kind. The copy states totals and never grades them: no allowance, no remaining, no over or under, no colour for either. "Inside your usual 80–110 g" is the whole sentence. A category the user tracks nothing in does not render; a stream that is off does not exist.

### Build something you have often

A consumable is a name, a basis (per 100 g, per 100 ml, or per portion), the numbers you have, and the portions you use. Energy and macros come first; fibre, sugar, salt, and the micronutrients are behind "More nutrients" so a quick custom food stays quick. A recipe is a consumable whose numbers come from its ingredients — searched, from the library, or another recipe — with a yield in servings, glasses, grams, or millilitres. Editing a recipe later never changes a meal already logged. Editing something bro or a provider supplied makes a copy that is yours, and says so once.

### Repeat a whole meal

A saved meal is a bundle: the usual breakfast, the pre-gym stack, the Friday pints. Logging it writes one event per item, each editable and deletable on its own, at the time chosen once for the lot.

### Plan a week

A plan is intent, kept apart from what happened. Planned items show on the day with a dashed outline — the design system's word for "not yet" — until confirmed, skipped, or replaced. Confirming writes the event; a skipped item is not a failure and is never counted as one.

### Correct the record

Edit or delete any event from its day. Hard deletes, no tombstones. Quantity is the only lever on the snapshotted amounts, which rescale proportionally rather than recompute, so a later catalogue change cannot rewrite history.

### Take it with you

Export carries events with their constituent maps, the library, recipe ingredients, saved meals, and plans. With sensitive data off — still the default — every event carrying a sensitive constituent or of a sensitive kind is absent, with the metric's tracked row and goals.

### Delete local data

Unchanged copy; the shared table list now clears every intake table in both stores.

## Delivery phases

Each phase adds one hard thing, lands green, and is shippable on its own. Phase 1 replaces the three old stacks with plain first-cut surfaces on the new model, so the app is whole at the end of it; Phase 2 is the Intake tab as designed. The proposal's ten phases map as follows: its 1 and 2 are this Phase 1; its 3 is Phases 2 and 3; its 4, 5, 6 are Phases 4, 5, 6; its 7 is Phase 7; its 10 is Phase 8; its 8 and 9 are Phase 9.

### Phase 1 — The constituent model, and the app made whole on it

**The one hard thing:** one constituent model under everything, with the old consumption code deleted rather than adapted, and every journey the three old stacks offered reachable again by the end of the phase.

#### Slice 1: Domain — the sign-off gate

1. `constituent-catalogue.ts`: the definition type, the category type, the catalogue, `resolveConstituent`, `listConstituents(category?)`. Provisional v1 content, **every code, unit, and display choice a sign-off item**: `energy` (kcal); `protein`, `carbohydrate`, `fat`, `saturated_fat`, `sugar`, `fibre` (g); `sodium` (preference dimension `sodium`: mg sodium or g salt at ×2.5); `fluid` (volume preference); `caffeine` (mg), `nicotine` (mg, sensitive); `ethanol` (alcohol preference, sensitive); `creatine` (g); `vitamin_a`, `vitamin_d`, `vitamin_b12`, `folate` (µg); `vitamin_c`, `calcium`, `iron`, `magnesium`, `potassium`, `zinc` (mg).
2. Units: `µg` joins the mass display units with resolution 0.1; `sodium` joins `UNIT_PREFERENCE_DIMENSIONS` over mass with `mg` and `salt_g` (the UK-unit precedent: a display definition over a canonical mass, not a stored count). Locale seeds salt for the UK and sodium elsewhere; sign-off item.
3. Metric registry: `ConsumptionDerivedMeasurementMetricDefinition` gains `constituentCode`; the intake block is generated from the catalogue with no legacy slug map; `habit:alcohol-free`, `habit:nicotine-free`, and the two alcohol insight pairs move to the generated slugs; `DEFAULT_TRACKED_METRICS` keeps every intake metric default-off.
4. Consumable shape and content source types in `@bro/domain`; the drink catalogue re-authored per 100 ml with `drinkComposition({ abvPercent, caffeineMgPer100ml, kcalPer100ml })` keeping the signed-off figures readable, portions carrying the exact regional volumes; the nicotine catalogue re-authored per portion with `basisUnits`; the substance-catalogue shape and `snapshotDrinkServing` deleted. **Every re-authored number is a sign-off item** — the per-100-ml conversion rounds, and the sign-off is what pins the new figures.
5. `@bro/domain/food-search` becomes the external consumable contract: `ExternalConsumable` (ref, name, brand, barcode, kind, basis, constituents, portions, source, licence) with its guard, replacing `FoodSearchResult` outright.

#### Slice 2: Model, migration, and repositories

1. `@bro/mobile-model`: `IntakeEvent`, `Consumable`, `RecipeIngredient`, `IntakeStream` and their create/update contracts; the old record types deleted.
2. The schema above as a re-squashed `0000` baseline: old tables out of `schema.ts` and `PRODUCT_TABLE_NAMES`, new ones in, `drizzle/` and the manifest regenerated from scratch.
3. Real-SQLite tests in the migrator suite's existing style: a fresh file creates every product table and index and nothing else; a re-run is a no-op; the pre-nicotine upgrade case is deleted with the history it exercised.
4. `IntakeEventRepository` (create, find, `listByDay`, `listBetween`, `listRecent(kinds, limit)`, update, delete), `ConsumableRepository` (create, find, `findBySource` for provider idempotency, list by kind, update, fork, archive, delete, plus ingredient CRUD with recomputation and cycle rejection in one transaction), `IntakeStreamRepository`. Validation mirrors the shipped repositories: finite non-negative amounts, at least one of mass, volume, or a constituent, trimmed names, calendar-day checks. Delete-local-data tests gain sentinel rows in every table.

#### Slice 3: Logic and export

1. `packages/logic/src/intake/` per [the calculation layer](#the-calculation-layer); `consumption/daily-totals.ts` retired in its favour; `resolveMetricDay` switched to `constituentCode`; regression tests prove observation- and import-backed metrics untouched and each generated intake metric summing its constituent code.
2. Export format version 2: `intakeEvents`, `consumables`, `recipeIngredients`, `intakeStreams`; the sensitive predicate reads the catalogue and the kind; fixtures regenerated; a new fixture proves exclusion of a sensitive-constituent event, a sensitive-kind event, and the survival of everything else.

#### Slice 4: API — the provider returns the consumable shape

1. `/api/food/search`, `/api/food/:ref`, and a new `/api/food/barcode/:code` (a lookup, not a scan) return `ExternalConsumable`: basis `mass 0.1 kg` from the `_100g` nutriments, the full constituent map Open Food Facts knows (fibre, sugars, saturated fat, salt → sodium, and the vitamins and minerals where present), and a serving portion where the product declares one. Anonymity, retention, rate limiting, attribution, and their tests are unchanged in posture and updated in shape.
2. The client search store and the `food_cache` payload switch to the new guard. Logged snapshots carry everything the provider knew from the first event written on the new model, which is why this is Phase 1 and not later.

#### Slice 5: App — the old code out, first-cut surfaces in

1. `IntakeStore` (day snapshots for a kind set, log by consumable or system key, free log, repeat, update, delete, goals), `LibraryStore` (consumables, forks, recipes), `IntakeSettingsStore` (streams, tracked constituents, units), `IntakeSearchStore` (provider, cache, library-row-on-log). `consumption/`, `drinks/`, `food/`, `substances/`, the three route stacks, the three settings screens, the three copy namespaces, and their tests are deleted.
2. First-cut surfaces, plain on purpose — the designed versions are Phase 2: the Intake tab lists the day's tracked constituent totals as rows, then the day's events in time order with an edit sheet; `/intake/log` offers a search box over recents, the library, the system catalogue, and provider results, kind chips limited to enabled streams, a portion sheet with quantity and date/time, and free entry; `settings/intake` and `/intake/goals` replace the nine screens they supersede. The FAB's Food, Drink, and gated stream actions preset the kind on the one log screen.
3. Flow tests written for the new surfaces cover every journey the old flow tests covered: catalogue drink, searched food, custom food, recipe, nicotine with the stream on and off, corrections, goals, settings, export, delete local data.
4. Sweep: `pnpm biome check .`, all six projects' test, typecheck, and lint targets; `product-domains-and-data.md` domain 8 and sequencing updated.

### Phase 2 — The Intake tab as designed

**The one hard thing:** a log for every kind that is faster for the repeat case than three separate ones were, and a day view that reads against the user's own range rather than a target.

1. **The log screen.** `/intake/log` per [Log something](#log-something): recents across kinds first, de-duplicated on what a repeat would reproduce, then library, saved meals (from Phase 5), system catalogue grouped by kind, provider results with attribution, free entry; the portion sheet gains weight or volume entry where the basis allows and a live constituent preview; the context chip suggested from the clock and the kind; multi-add with the confirmation toast, the screen staying for the next item. A repeat is three taps; a first-time catalogue pick is under twenty seconds.
2. **The Intake tab.** Week strip under the header (presence indicator: anything logged), the one energy number with its usual-range read, category cards — Nutrition, Stimulants, Alcohol, Smoking & vaping, Supplements — with compact baseline rows via `intakeProjections` and `intakeBaseline`, the day's events in time order, a library action in the header. `/intake/[localDay]` is the tab with a selected day.
3. **Settings and goals** get their designed form: tracked constituents grouped by category with the "More nutrients" disclosure, units (alcohol, volume, energy, sodium) with live previews, data licences.
4. **Copy pass** across the `intake` namespace against the Write/Never table; no exclamation marks, no grades, no allowances.
5. Flow tests: log a coffee, a pouch (stream on), lunch from search, and a tablet (stream on) in one visit and see four events in order; repeat from recents in three taps; a stream switched off hides its chip, its results, its card, and its FAB action; the energy number is the only metric-size text; a day with fourteen logged days draws a band and a day with thirteen draws none.

### Phase 3 — The library and the composition editor

**The one hard thing:** editing a composition on a basis the user chooses, without letting a wrong basis produce a wrong number.

1. `/intake/library` with segments by kind plus Recipes; source badges (yours, bro, the provider's name, later community); archive rather than delete when an event references the row, so recents keep working.
2. The consumable editor: kind, name, brand, barcode field, basis choice with copy that explains what the numbers below are per, energy and macros, "More nutrients" disclosure for the rest of the catalogue in category order, portions with mass, volume, or basis multiples, default portion. Fork-on-edit banner for non-user sources. Validation copy says how to fix, never just "invalid".
3. Provider import into the library without logging ("Save to my foods"), and "Look up barcode" through the new route.
4. Tests: a per-100-g food logged as "1 medium (118 g)" carries 1.18 × the basis; a per-portion supplement logged as "2 tablets" carries 2 ×; a portion with no relation to the basis is rejected at save with the field named; forking a system drink leaves the catalogue untouched and produces a user row with `forkedFrom`.

### Phase 4 — Recipes

**The one hard thing:** composition that is calculated from references yet snapshotted so it never moves.

1. The recipe editor: ingredients from the unified search (library, system, provider, other recipes), each with portion and quantity; yield in servings, portions, glasses, millilitres, or grams; the calculated per-yield-unit composition shown live; a per-serving preview.
2. Recomputation on every ingredient change stored on the recipe consumable; nested recipes; cycle rejection; a deleted or archived ingredient consumable leaves the ingredient's snapshot in place and the recipe still logs.
3. The proposal's two worked examples as fixtures: the protein smoothie (calcium, caffeine, creatine from five ingredients) and the espresso martini (energy, sugar, ethanol, caffeine from four), both asserted to the constituent.
4. Ingredients are linked to consumables from the first recipe; there is no unlinked legacy to carry.

### Phase 5 — Saved meals

**The one hard thing:** one tap that writes N independent events and stays correct when one of the N has changed or gone.

1. `saved_meals` (id, name, source, forked_from, created_at, updated_at) and `saved_meal_items` (id, saved_meal_id, position, consumable_id, source_ref, name, portion_id, portion_label, quantity, context, constituents snapshot as fallback, timestamps); repository; export section.
2. "Save today as a meal" from the day's events and a meal editor; logging expands through `expandSavedMeal` with the shared time and per-item context; every event is ordinary afterwards.
3. Tests: logging a four-item meal writes four events; editing the meal changes no logged event; an item whose consumable is archived still logs from its snapshot; recents show the meal as one row and its items as their own.

### Phase 6 — Meal plans and planned intake

**The one hard thing:** intent and record side by side on one day without the record ever being inferred from the intent.

1. `meal_plans` (id, name, starts_on, day_count, source, forked_from, timestamps) and `planned_intakes` (id, meal_plan_id, day_index, minute_of_day nullable, context, consumable_id, source_ref, saved_meal_id, name, portion_id, quantity, status `planned` | `consumed` | `skipped` | `replaced`, timestamps); `planned_intake_id` nullable on `intake_events`; repositories; export.
2. A plan editor by day; the Intake tab renders the day's planned items as dashed rows under the events; confirm writes the event(s) and marks consumed; skip marks skipped; replace opens the log with the planned item as the suggestion and links the event that results.
3. The week strip gains no second indicator for plan completion — a strip that shows how many planned items were missed is a streak by another name. Sign-off item.
4. Tests: confirming a planned saved meal writes N events linked to one planned intake; a skipped item contributes nothing to any total; deleting a plan leaves consumed events untouched; a plan day with nothing confirmed shows nothing in totals.

### Phase 7 — Supplements, stimulants, and other streams

**No new hard thing** — presentation over the same events, which is the proposal's point.

1. Stream copy and empty states for `supplement` and `medication` in the found-not-promoted voice the nicotine plan set; a "daily stack" is a saved meal of supplements, no new machinery.
2. Category cards get their own ink (sign-off: intake data as `body`, stimulants and alcohol as `load`) and their own read lines; caffeine and nicotine rows carry the nicotine plan's estimate disclaimer where estimates are involved.
3. `medication` events are sensitive whole; no schedule, no reminder, no adherence — the medication domain's future plan starts from here.
4. A `cannabis` stream stays where the nicotine hand-off left it: content, a `thc` constituent, and the two policy checkpoints belong to its own step, which now needs no column.

### Phase 8 — Providers

**The one hard thing:** a second dataset behind the same shape without a client release.

1. The `ConsumableProvider` interface server-side (`search`, `findByRef`, `findByBarcode`) with Open Food Facts as the first adapter and a USDA FoodData Central adapter behind a feature flag; refs stay namespaced (`off:`, `usda:`); per-result `source` and `licence` continue to travel; the licences screen lists every active source.
2. Constituent mapping per provider is the adapter's job and the API test suite's fixture set; unknown provider fields never reach the client.
3. Barcode scanning remains the native batch; when it lands it calls the Phase 2 route.

### Phase 9 — Community content, forks, and updates (future)

Planned separately once Phases 1–5 have settled the shapes. Its outline, so that nothing before it closes a door:

- A `content_items` table in Postgres ([database/api](../../packages/database/api/src/schema/)): id, kind (`consumable` | `recipe` | `saved_meal` | `meal_plan`), version, payload (the published record and its dependencies, in the shapes above), author, published_at, withdrawn_at. Publishing needs an account; browsing and downloading are the first authenticated reads in the free tier's path and get the same retention design the food search had.
- Download writes library rows with `source: { community, contentId, version }` and resolves dependencies into the library the same way (a downloaded recipe brings its ingredient consumables), deduplicated on source.
- Update detection compares versions at browse time and offers an explicit upgrade; a forked row stops being offered updates. Nothing updates in place.
- Publishing is policy-gated by kind and constituent: `nicotine`, `medication`, and `other` kinds, and any non-`publishable` constituent, cannot be published — the conservative posture the proposal asks for, enforced by the catalogue rather than by copy.

## Community readiness

The invariants Phase 1 fixes so that Phase 9 is additive:

1. **Every reusable row says where it came from.** `source` and `forkedFrom` on consumables, saved meals, and meal plans; `sourceRef` on every event, ingredient, item, and planned intake.
2. **Local ids are never content ids.** A downloaded item has a device-generated primary key and its `contentId` and `version` inside `source`; two devices downloading the same item produce two rows that sync as two rows, which is the standing conflict model.
3. **Snapshots everywhere content can move.** Events, ingredients, items, and planned intakes carry the name and constituents they were composed from; a community update, withdrawal, or provider change never changes a logged day.
4. **Fork on edit.** Editing anything not `user`-sourced produces a `user` row with `forkedFrom`; system content is never in the database, so the fork is the first library row it has.
5. **Dependencies are references plus snapshots.** A recipe's ingredient names its consumable by id and by `sourceRef`, so a downloaded recipe can resolve, download, or substitute its ingredients and still calculate from snapshots meanwhile.
6. **No authorship on local rows.** The product plan's `createdByUserId` rule holds; authorship is a server fact attached at publish time.
7. **Publishability is authored.** The constituent catalogue and the kind list carry the policy, so the client can refuse to offer "Publish" on a nicotine consumable without a server round trip.

## Expected touchpoints

| Area | Files |
| --- | --- |
| Catalogue and registry | New `packages/domain/src/content/constituent-catalogue.ts`; `metric-registry.ts` (generated intake block, `constituentCode`); `drink-catalogue.ts` and `nicotine-catalogue.ts` re-authored; `substance-catalogue.ts` deleted; `food-search.ts` → external consumable contract; `units/dimensions.ts`, `conversion.ts`, `formatting.ts`, `locale-defaults.ts` (`µg`, `sodium`) |
| Model | `packages/mobile-model/src/records.ts` |
| Schema and migration | `packages/database/app/src/schema.ts`, `product-tables.ts`, re-squashed `drizzle/0000_*` and regenerated `migrations/manifest.ts`, `migrator.test.ts`, `repositories.test.ts` |
| Repositories | `intake-event-repository.ts`, `consumable-repository.ts`, `intake-stream-repository.ts` (Phase 1); `saved-meal-repository.ts` (5); `meal-plan-repository.ts` (6); `consumption-entry-repository.ts` and `custom-consumable-repository.ts` deleted |
| Logic | New `packages/logic/src/intake/`; `consumption/daily-totals.ts` retired; `health/resolved-day.ts`; `export/check-in-export.ts` and fixtures |
| API | `apps/api/src/routes/food.ts`, `food/open-food-facts.ts`, `food.test.ts` (Phase 1); provider interface (Phase 8) |
| Stores | New `apps/app/src/intake/` (`intake-store.ts`, `library-store.ts`, `intake-settings-store.ts`, `intake-search-store.ts`); `consumption/`, `drinks/`, `food/`, `substances/` and their tests deleted in Phase 1 |
| Routes and screens | `(tabs)/intake.tsx`; new `app/intake/` stack (`log`, `[localDay]`, `event/[id]`, `library`, `library/[id]`, `recipes/[id]`, `meals/[id]`, `plans/[id]`, `goals`); `settings/intake.tsx`; `quick-log-fab.tsx`; `/food`, `/drinks`, `/nicotine`, their settings screens, and their flow tests deleted in Phase 1 |
| Copy | `i18n/locales/en/intake.ts` grows; `food.ts`, `drinks.ts`, `nicotine.ts` deleted in Phase 1; `content.ts` keys for constituents and re-authored catalogues; `validation.ts` |
| Docs | `product-domains-and-data.md` domain 8 and sequencing updated in the Phase 1 sweep |

## Automated acceptance matrix

| Case | Expected result |
| --- | --- |
| Migration | A fresh file creates every product table and index from the squashed baseline and nothing else; re-runs are no-ops; no old table name survives in `PRODUCT_TABLE_NAMES`, the schema, or any repository. |
| Registry generation | Every catalogue constituent has exactly one metric, slug `<code>_intake`, with the constituent's dimension, display, and sensitivity; no intake metric is default-on; the habit and insight catalogues reference only generated slugs. |
| Derived totals | `resolveMetricDay` for an intake metric equals the day's sum of its constituent code across events; a new constituent appears in totals with a catalogue entry and no migration. |
| Unknown codes | An event carrying an unknown code round-trips through the repository and export unchanged and contributes to no total. |
| Snapshot fidelity | Editing or deleting a library consumable, a recipe ingredient, a system catalogue entry, or a provider record changes no event, total, goal, habit day, insight, or export. |
| Composition scaling | Mass, volume, and portion bases scale correctly for portion, direct mass, and direct volume selections; an unrelatable portion is rejected with the field named. |
| Recipes | Composition per yield unit matches the two fixtures to the constituent; a nested recipe sums; a cycle is rejected; editing a recipe changes no logged event. |
| Saved meals | N items log N events; item snapshot fallback works when the consumable is archived. |
| Plans | Confirm writes linked events; skip and delete contribute nothing; events outlive their plan. |
| Streams | With a stream off: no chip, no results of that kind, no card, no FAB action, no settings copy pushed; on: all four appear that day. Fresh install shows food and drink only. |
| Sensitive export | Events with a positive sensitive constituent or a sensitive kind, their metrics' tracked rows, and their goals are absent with sensitive off; everything else present; format v2 round-trips. |
| Offline | Log, repeat, library, recipes, meals, plans, totals, trends, goals, insight, export issue no request; only explicit search and barcode lookup do, and both degrade to cache without blocking or losing input. |
| Provider library | Logging a searched food writes one provider consumable, idempotent across repeats, replicating; the cache row stays in `bro-local.db`. |
| Check-in isolation | No intake action writes an observation; `hasCompletedCheckIn`, streaks, reminders unaffected. |
| Design rules | Exactly one metric-variant number on the Intake tab; no colour on any intake delta; a baseline band only at fourteen or more logged days. |
| Delete local data | Every intake table in both stores cleared; standing guarantees hold. |

## Verification commands

```bash
pnpm nx run @bro/database-app:db:generate
pnpm nx run-many -t test typecheck lint -p @bro/domain @bro/mobile-model @bro/logic @bro/database-app @bro/api @bro/app --skipNxCache --parallel=1
pnpm biome check .
```

`--parallel=1` for the reason the nicotine plan records; preserve the complete output of a failing command. No device work is required by Phases 1–7.

## Exit criteria

**Phase 1:** a new constituent is provably a catalogue entry and nothing else; nothing remains under `consumption/`, `drinks/`, `food/`, `substances/`, the three old route stacks, or the three old copy namespaces; every journey the old stacks offered is reachable from the new surfaces and covered by a flow test; the provider returns the consumable shape; all six projects green.

**Phase 2:** a repeat is three taps from the FAB; four kinds log from one screen in one visit; the tab meets the design-rule row of the matrix.

**Phases 3–6:** each phase's matrix rows green; each new table in export and delete-local-data; the product plan updated.

**Phase 7:** a user with no optional stream on sees a byte-identical app to Phase 2's.

**Phase 8:** a second provider ships as a server deploy with no client change.

## Sign-off items

- The v1 constituent list, its units, display resolutions, and categories.
- Sodium as a preference dimension (mg sodium versus g salt at ×2.5) and its locale default.
- Every re-authored drink figure per 100 ml and every nicotine figure per portion.
- Uniform generated metric slugs (`ethanol_intake`, `carbohydrate_intake`) replacing the eight shipped names, with the habit and insight catalogues following.
- Logging a provider result writes a library row (replicating) rather than only a cache row.
- Intake ink: `body` for nutrition and supplements, `load` for stimulants and alcohol.
- The fourteen-logged-day threshold for a usual-range band on intake rows.
- No plan-completion indicator on the week strip.
- Route name `/intake/*` beside the `(tabs)/intake` route, repeating the body pattern.

## Hand-off and open decisions

- **Custom constituents.** A user-declared code (`custom:<uuid>`, label, dimension, unit) is the one thing this catalogue cannot express. It is real machinery — an overlay table, an unknown-code path that is no longer unknown, export and community rules — and it should wait for a demand signal, most likely from medication actives.
- **The weekly decision** is now wanted by three domains (alcohol, habits, and plans) and `intakePeriodTotals` gives it arithmetic; the goal and habit semantics still need taking once.
- **The windowed caffeine insight** has its `occurredAt` and now its constituent; it remains the first new engine capability anyone has asked for.
- **Medication** has a kind and nothing else, deliberately. Its domain plan should start from the proposal's list: schedules, reminders, adherence, contraindications, prescribing information — and from the observation that every one of those is a guilt mechanic if built carelessly.
- **AI-assisted logging** attaches at the log screen's search box and the provider normalisation boundary; it is Phase 4 of the umbrella plan's concern and carries the third-party disclosure question that plan already names.
- **`listAll()` in the non-intake stores** is named debt after Phase 1's sweep; whichever step next touches Trends or insight should take the window.
- **Community (Phase 9)** starts with a plan of its own, written against the shapes as they stand after Phase 5, and with the account and retention design the food search set the bar for.
