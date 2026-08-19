# Step 9: Food logging implementation plan

## Status

**Complete.** Slices 1–4 were implemented in code on 19 August 2026: migration 008 and both stores' repositories; the offline food, recipe, and custom-drink surfaces with derived nutrition metrics; export v7, delete-local-data coverage, and the privacy rewrite; then provider-backed search, cache-through, offline degradation, attribution, and the privacy sign-off gate. This is the delivery plan for [sequencing step 9 of the product domains plan](product-domains-and-data.md#sequencing) — the last product step, and the one the plan has always described as "the largest, carries the external dependency, and is the easiest to get wrong in a way users abandon".

It consumes the [step 8 hand-off](step-8-drink-logging.md#step-9-hand-off): `consumption_entries` with its snapshot rule, its hard-delete rule, and its read-time derived-totals projection, all proven against a domain with no provider. Step 8 existed to take that design decision away from this step, and it did. **The one hard thing step 9 adds is the provider**, and every decision below is aimed at keeping it the only one.

## Outcome

A man logging his food for the first time searches "chicken thighs", picks the result that looks right, adjusts to two, and moves on. It took him under fifteen seconds and he did not have to think about which database it came from. A week later, the second time he logs it, it is in his recents and takes three. On a train with no signal he can still log everything he ate yesterday from recents and his own custom foods, because only *search* needs the network.

His energy intake joins the same Trends chart as his weight, in the units step 8 decided, and a decrease goal against it derives progress from entries he can correct. Protein, carbs, and fat ride the identical path. When he opens the privacy screen it tells him the truth about all of it, in one place, for the first time.

The step is successful when four properties hold: a food logged from the provider is stored once with its label, serving, and every nutrition number snapshotted, and still reads correctly after the provider has changed or removed that record; **search is the only operation that touches the network**, and its absence degrades to recents plus cache rather than blocking; the day's energy and macro totals are derived from entries at read exactly as step 8's are, with no new projection path; and the search endpoint holds no user identity and no query log.

## Non-goals

- **No barcode scanning.** [Open decision 17](product-domains-and-data.md#open-decisions) is resolved as *yes, but not in this step* — see the decisions below. It is a native dependency and a prebuild, and step 9 already has its one hard thing.
- **No macros beyond protein, carbs, and fat.** Fibre, sugar, saturated fat, sodium, and micronutrients are a provider field away and a surface-area decision this step does not need to take. The columns can be added when a user-visible reason exists; the snapshot rule means adding them later never rewrites history.
- **No new insight pairs.** Nutrition offers dozens of plausible ones, which is exactly why this step authors none — see the decisions below.
- **No meal categorisation.** Breakfast/lunch/dinner/snack is a grouping users ask for and a schema commitment that constrains the entry; `occurred_at` already orders a day, and grouping can be derived or added without a migration to the entry's meaning.
- **No targets, no macro splits, no "remaining today" arithmetic.** A calorie target that counts down is the guilt mechanic this product has refused everywhere else, and it is the single most abandonment-prone pattern in the category. Totals are stated, as step 8 states them. Goals against `energy_intake` already exist for anyone who wants one, in both directions, and they read as a series rather than a daily allowance.
- **No weekly aggregation.** Still deferred, still wanted by two domains, still one design to be taken once. Daily-series goals work meanwhile.
- **No food reminder.** The `reminders` table stays kind-less a fifth deliberate time.
- **No change to the check-in.** The daily loop stays two scores and a tap row. Food logging is default-off and reached from its own surface.
- **No sync.** Custom foods and recipes are authored to replicate correctly when Phase 5 lands; nothing in this step turns it on.

## Current baseline

- Migrations 001–007 shipped. `consumption_entries` exists with `kind`, `catalogue_ref`, snapshotted `label`/`serving_label`/`quantity`, canonical `volume_l`/`ethanol_kg`/`caffeine_kg`/`energy_kcal`, the observation spine's `occurred_at`/`local_day`/`tz_offset_minutes`, and its two indexes ([schema.ts](../../packages/database/app/src/schema.ts)).
- `ConsumptionEntryRepository` covers insert, list by day, list recents, list all, update, and hard delete, and the table is in `PRODUCT_TABLE_NAMES`, so migration verification and delete-local-data inherit it.
- The registry has a third measurement variant — **consumption-derived** ([metric-registry.ts](../../packages/domain/src/content/metric-registry.ts)) — with `aggregation: "sum"`, `userEnterable: false`, and `enabled: false` defaults. `alcohol_intake` (6), `caffeine_intake` (7), `fluid_intake` (8), and `energy_intake` (9) ship today; **`energy_intake` is already the metric food extends**, in kilocalories, non-sensitive.
- `resolveMetricDay` ([resolved-day.ts](../../packages/logic/src/health/resolved-day.ts)) resolves over three sources — consumption, imported, user — and everything downstream (Trends, goals, history, insight) reads through it. A new consumption metric needs no new projection path.
- Canonical energy is kcal with an exact kJ display conversion; masses are kilograms with fixed-unit display available (caffeine renders `mg` with no preference row, the precedent macros follow).
- `bro-local.db` exists with its own migration manifest and `LOCAL_TABLE_NAMES` ([local-tables.ts](../../packages/database/app/src/local-tables.ts)), holding disposable health-import tables today. It is the store the food cache joins.
- **`apps/api` already exists** — a Hono app with `@bro/auth-api`, a `/health` route, session middleware, and Postgres via `@bro/database-api`. Step 9 is therefore not the first server code, but the search endpoint **is the first unauthenticated endpoint in the free tier's path**, which is the part that matters.
- Export format v6 parses v1–v6 fixtures with entry-level sensitive exclusion proven.
- No custom-consumable table exists yet. Step 8 deliberately left it, and drinks join it here.

## Decisions locked for this step

- **Barcode is deferred out of step 9, and batched with the outstanding native acceptance work.** This resolves [open decision 17](product-domains-and-data.md#open-decisions) as *yes, later, together*. The sequencing rule is that each step adds exactly one hard thing, and the provider is this step's. Barcode is a camera dependency, a prebuild, a permission prompt, and a privacy disclosure; steps 1, 2, and 5 are already carrying pending physical-device checklists and an unbuilt authenticated EAS iOS build. One native batch clears all of it, under the shared-prerequisites rule. Food logging works on search plus recents plus custom foods without it — barcode is an accelerant, not the mechanism.
- **Migration 008 extends the entry; it does not restructure it.** Three nullable macro columns (`protein_g`, `carbs_g`, `fat_g`) and one nullable `consumable_ref`. `kind` takes `'food'`. Nullable for the reason step 8 set: `NULL` is "not applicable or unknown", `0` is "measured as none", and a provider that omits a macro must not be recorded as a zero.
- **Macros are three more consumption-derived metrics, and that is the whole engine change.** `protein_intake`, `carbs_intake`, `fat_intake` at positions 10, 11, 12: dimension `mass`, canonical kilograms, `aggregation: "sum"`, `userEnterable: false`, `enabled: false`, `sensitive: false`, fixed display unit `g` — the caffeine-renders-mg precedent, so no new preference dimension and no new unit row. `energy_intake` is untouched and simply starts receiving food entries. **There is no change to `resolveMetricDay`, the daily-signal adapter, Trends, or goals**; step 8 widened those once, deliberately, so that this step would not have to.
- **Nutrition is not sensitive, and that is a considered call rather than an omission.** `alcohol_intake` is sensitive because ethanol is; body metrics are because weight is. Energy and macros ship `sensitive: false`, consistent with `energy_intake` as already shipped. Anyone who disagrees for their own data has the tracked-metric toggle. Revisiting this would silently change what existing v6 exports contain, which is a reason to decide it now and write it down.
- **Snapshot everything displayed; `consumable_ref` is for re-lookup only.** The rule applied a sixth time, and the one that makes a remote provider survivable: a meal logged in 2026 reads correctly in 2029 with no network call, after the provider has edited, re-branded, or deleted the record. Provider ids are stored namespaced (`off:<barcode>`, later `usda:<fdcId>`) so a second source never collides with the first, and unknown prefixes are tolerated forever.
- **Custom foods are a user-authored table in `bro.db`, and drinks join it.** `custom_consumables` (replicating, user-originated) holds label, kind, servings, and per-serving nutrition. Step 8's "something else" free entry keeps working unchanged, but a user who wants their own repeatable item now has one, for drinks as much as for food. This is the table step 8 named and declined to build without food to force its shape.
- **A recipe is a custom consumable with components, not a parallel model.** `custom_consumable_components` references a parent custom consumable and holds snapshotted per-component nutrition. Logging a recipe writes **one** entry with the totals snapshotted onto it — never one entry per component — so the entry model, the derived totals, and correction are all unchanged. Editing a recipe never changes an already-logged meal, by the same snapshot rule.
- **Search proxies through our API and is the only networked operation.** Resolves the remaining half of [open decision 16](product-domains-and-data.md#open-decisions). `GET /api/food/search?q=` and `GET /api/food/:ref` in `apps/api`, unauthenticated, returning a normalised shape that Open Food Facts populates first and USDA FoodData Central or a UK composition dataset can populate later **server-side, without an app release**. The client knows the normalised shape and nothing about any provider.
- **The endpoint holds no identity and logs no queries. Sign-off item.** No account, no session, no device id, no user identifier of any kind on the request; no query text written to any log, metric, or trace, at any level, including error paths; rate limiting by coarse IP bucket held in memory with no persistence. What may be recorded is aggregate counters — request count, hit rate, upstream latency, error rate — carrying no query text. This is the posture the product plan required be decided *before* the endpoint ships, and it is a sign-off gate for slice 4, because it is far cheaper to build this way than to retrofit it once logs exist.
- **Open Food Facts is ODbL, and attribution ships with the feature.** The licence obliges attribution and share-alike on the database; the app carries a visible credit on the search surface and in the licences screen, and the API response carries a per-result `source` and `licence` field rather than leaving attribution to the client's memory. Naming this now is what stops it becoming a launch blocker.
- **Offline-first survives the dependency, and the degradation is specified, not hoped for.** Logging, recents, correction, custom foods, recipes, totals, trends, goals, insight, and export are unconditional and local. Search — and only search — needs the network. With no network, the search surface shows recents, custom foods, and previously cached results, with one honest line saying search needs a connection; it never blocks, never spins indefinitely, and never loses typed input. Timeout is short and explicit.
- **Looked-up foods cache in `bro-local.db`, never replicating, rebuildable.** They are a cache of someone else's database, per the [three-store split](product-domains-and-data.md#three-stores-not-two). `food_cache` joins `LOCAL_TABLE_NAMES`, so delete-local-data covers it and losing the store costs nothing but a re-lookup. Cached rows are never a display source for a logged entry — the entry's own snapshot is.
- **No new insight pairs, deliberately.** Sixteen authored pairs stand. Nutrition offers dozens of plausible ones — protein against energy, carbs against sleep, late eating against mood — and the [step 7 hand-off](step-7-insight.md#step-8-hand-off)'s standing warning is that pair count is the multiple-comparisons pressure the curated-list posture exists to resist. Following step 8's precedent, where fluid and energy got none, food gets none at v1. The windowed-transform capability is still the gate the interesting ones are waiting behind.
- **Export bumps to v7**, adding macro fields to entries and `customConsumables` and `customConsumableComponents` sections. v1–v6 fixtures keep parsing. Food entries are not sensitive, so the exclusion rule is unchanged: whole ethanol-carrying entries only.
- **The privacy screen rewrite lands in this step, not after it.** [Open decision 24](product-domains-and-data.md#open-decisions) has accumulated three items — platform backup, third-party food lookup, and AI before it launches. Two of the three are true today and the third is this step's. Shipping a networked search behind a privacy screen that says data never leaves the device would make the screen false on the day it ships, so the rewrite is scope here.
- **A logged meal is not a check-in.** `hasCompletedCheckIn` reads mood and energy observations only; nothing in this step writes an observation. Streaks, reminders, and the Today empty state are provably unaffected — the fifth time this holds.

## Schema

Migration 008, under the standing conventions (`IF NOT EXISTS`, UUIDv7 ids, epoch-ms timestamps, canonical values):

```sql
ALTER TABLE consumption_entries ADD protein_g REAL;
ALTER TABLE consumption_entries ADD carbs_g REAL;
ALTER TABLE consumption_entries ADD fat_g REAL;
ALTER TABLE consumption_entries ADD consumable_ref TEXT;

CREATE TABLE IF NOT EXISTS custom_consumables (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,               -- 'food' | 'drink'
  label TEXT NOT NULL,
  brand TEXT,
  is_recipe INTEGER NOT NULL,       -- 0 | 1; a recipe owns components
  servings TEXT NOT NULL,           -- JSON: [{ id, label, ... canonical per serving }]
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS custom_consumable_components (
  id TEXT PRIMARY KEY,
  consumable_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  label TEXT NOT NULL,              -- snapshotted at compose time
  quantity REAL NOT NULL,
  energy_kcal REAL,
  protein_g REAL,
  carbs_g REAL,
  fat_g REAL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_custom_consumable_components_parent
  ON custom_consumable_components (consumable_id, position);
```

`ALTER TABLE ... ADD` is not conditional in SQLite, so the four column additions follow the existing conflict-tolerance convention the migrator already proves — the same handling migration 002's `ALTER TABLE tracked_metrics ADD custom_label` established. Both new tables join `PRODUCT_TABLE_NAMES`.

Servings are JSON on the parent rather than a third table because they are never queried across rows, always read whole with their consumable, and step 8's authored catalogue already models servings as a value list. Components are a table because a recipe is edited component by component.

The local cache, in `bro-local.db`'s own manifest, joining `LOCAL_TABLE_NAMES`:

```sql
CREATE TABLE IF NOT EXISTS food_cache (
  ref TEXT PRIMARY KEY,             -- namespaced provider ref: 'off:<barcode>'
  payload TEXT NOT NULL,            -- the normalised response, as returned
  query TEXT,                       -- the search that surfaced it, for offline recall
  fetched_at INTEGER NOT NULL
);
```

## The search endpoint

One normalised shape, owned by us, with the provider behind it:

```ts
type FoodSearchResult = {
  ref: string;            // 'off:<barcode>' — namespaced, never bare
  label: string;
  brand: string | null;
  source: string;         // 'Open Food Facts'
  licence: string;        // 'ODbL-1.0'
  servings: {
    id: string;
    label: string;        // '100 g', '1 medium (120 g)'
    energyKcal: number | null;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
  }[];
};
```

`null` survives the whole path: a provider that does not know a food's fat content produces `null`, is stored `NULL`, and reads as unknown rather than zero. Normalisation happens server-side, so a second dataset is a server deploy.

## User journeys and copy contract

### Log food

The highest-friction journey in the product and the one most likely to be abandoned, so the ordering is the design: **recents first**, then custom foods and recipes, then search, then "something else". A repeat is three taps and no network. A first-time search is type, pick, adjust serving, done. The default time is now; earlier today and yesterday are one tap away.

### Search, on a train

Search shows recents, custom foods, and cached results, with one line: search needs a connection. Typed input is preserved. Nothing spins, nothing blocks, nothing is lost. When signal returns the same query works.

### Build something you eat every week

A custom food is a label, a serving, and the numbers you have. A recipe is a custom food with components — add them, name the whole thing, and log it as one item. Editing the recipe later never changes a meal already logged.

### See what it adds up to

Today's totals in kcal and grams beside step 8's drink totals, with the week beside them. Trends renders each tracked derived metric as a summed daily series. **The copy states totals and never grades them**: no remaining allowance, no colour-coded thresholds, no "over" or "under", no guideline comparison. This product does not have a view about what someone ate, and the moment it appears to, the logging stops — the same contract step 8 wrote for alcohol, and it matters more here.

### Correct the record

Edit or delete any entry from its day. Hard deletes, no tombstones. Every derived total, trend point, goal progress, and insight that read that day changes on the next read, because none of it was stored.

### Know what leaves the device

One honest privacy screen covering platform backup, food search, and what sync would mean. It says that searching sends the text you type to our server, that it is not stored and not tied to you, and that everything else stays on the device.

### Take it with you

Export v7 carries entries with their macros, plus custom foods and recipes. Sensitive exclusion is unchanged.

### Delete local data

Unchanged copy; now also clears `custom_consumables`, `custom_consumable_components`, and the `food_cache` in the local store.

## Delivery slices

### Slice 1: Migration 008, the consumable tables, and the repositories

1. Macro and `consumable_ref` columns, `custom_consumables`, and `custom_consumable_components` into `schema.ts` and `PRODUCT_TABLE_NAMES`; `food_cache` into the local schema and `LOCAL_TABLE_NAMES`; `db:generate`, conflict-tolerant form, commit SQL and manifests.
2. Real-SQLite migration tests: fresh file applies 001–008; a step-8 file applies only 008; re-runs are no-ops, including the four `ALTER TABLE` statements.
3. `CustomConsumableRepository` and the `food_cache` reader/writer per [the repository recipe](../../packages/database/app/src/repositories/README.md); `ConsumptionEntryRepository` extended for the new columns. Delete-local-data tests extended with sentinel rows in all three tables.

### Slice 2: Metrics, totals, and the local surfaces — no network yet

1. `protein_intake`, `carbs_intake`, `fat_intake` in the registry with fixed `g` display; `energy_intake` verified to sum food and drink entries together.
2. `/food` and `/food/[localDay]` mirroring the `/drinks` stack; recents, custom foods, quantity and serving adjustment, totals, edit, hard delete. Free entry works with no provider at all.
3. Custom foods and recipes: compose, edit, log as one snapshotted entry. Drinks gain custom consumables on the same surface.
4. `settings/food`, Trends entry point, goals in both directions. **This slice ships a fully working food logger with no network dependency whatsoever**, which is the fallback if anything downstream slips.

### Slice 3: Export v7, privacy, and delete-local-data

1. Export v7: macro fields, `customConsumables`, `customConsumableComponents`, new fixture, v1–v6 fixtures still parsing.
2. The [open decision 24](product-domains-and-data.md#open-decisions) privacy screen rewrite, covering platform backup, food search, and sync.
3. Delete-local-data across both stores including the cache.

### Slice 4: The search endpoint — the sign-off gate

1. `GET /api/food/search` and `GET /api/food/:ref` in `apps/api`: Open Food Facts behind the normalised shape, namespaced refs, `source` and `licence` per result, coarse in-memory IP rate limiting, short timeouts, no identity, no query logging.
2. Client search: cache-through into `bro-local.db`, the offline degradation path, attribution on the surface and in the licences screen.
3. The acceptance matrix below, the third documented carve-out in the [offline-first acceptance matrix](offline-first-identity-onboarding-premium.md#acceptance-test-matrix), and the product plan updated (open decisions 16, 17, 24; sequencing step 9).
4. **The retention posture, the absence of any user identifier, the normalised response shape, and the licence attribution are the sign-off gate for this slice.**

### Slice 4 implementation sign-off — 19 August 2026

- **Retention:** approved as no query retention. The Hono food subtree has no request-logging middleware, never passes a query or caught upstream error to its aggregate observer, returns `Cache-Control: no-store`, and tests assert that the query is absent from success and error observations. The Node entry point logs only its startup address. Any future ingress or request logger must preserve this route-specific no-query rule.
- **Identity:** approved as anonymous. Food routes are mounted outside session middleware, the client uses `credentials: "omit"` with only an `Accept` header, and tests prove supplied account/session/device headers are neither resolved nor forwarded. Rate limiting retains only a coarse `/24` IPv4 or `/64`-style IPv6 bucket in process memory for one short window. The address it coarsens is the connection's own peer address; `X-Forwarded-For` and `CF-Connecting-IP` are read only when `TRUST_PROXY_HEADERS=true` declares a proxy that overwrites them, because a client-supplied header would let any caller mint unlimited buckets. Buckets are per-caller and bounded by eviction — callers are never collapsed into a shared counter, so no one caller's traffic can rate limit anybody else.
- **Response:** approved as provider-neutral. `FoodSearchResult` is shared by API and client through `@bro/domain/food-search`; Open Food Facts is normalised server-side into namespaced refs, nullable nutrition, and serving choices. Logged entries copy the selected label, serving, quantity, and nutrition values and never read their display from the cache.
- **Licence:** approved for the initial Open Food Facts source. Every result carries `source: "Open Food Facts"` and `licence: "ODbL-1.0"`; the search card displays both and links to a permanent Data licences settings screen. Provider requests use an identified `User-Agent`, as required by [Open Food Facts' API conditions](https://support.openfoodfacts.org/help/en-gb/12-api-data-reuse/94-are-there-conditions-to-use-the-api).
- **Offline behavior:** approved. An explicit search is the only client path that makes a request. Successful results cache in `bro-local.db`; failure returns the exact-query cache, keeps the input intact, stops the spinner, and leaves recents, custom foods, recipes, free entry, correction, totals, Trends, goals, insight, and export untouched. The degradation line distinguishes a request that never reached the server from one the server answered with a 429 or a 5xx, so the copy never tells a connected user they are offline.

## Expected touchpoints

| Area | Existing or planned files |
| --- | --- |
| Schema and migration | `packages/database/app/src/schema.ts`, `local-schema.ts`, `product-tables.ts`, `local-tables.ts`, `drizzle/*.sql`, `src/migrations/manifest.ts`, `local-manifest.ts` |
| Repositories | New `custom-consumable-repository.ts`, `food-cache-repository.ts`; `consumption-entry-repository.ts` extended |
| Registry | `packages/domain/src/content/metric-registry.ts` (three macro slugs) |
| Consumption math | `packages/logic/src/consumption/` — macro fields in the daily totals projection |
| Search | New `apps/app/src/food/` client and cache; new `apps/api/src/routes/food.ts` and its provider adapter |
| Routes and screens | New `apps/app/src/app/food/` stack; `settings/food`; trends entry point; screens under `src/screens/food/` |
| Export | `packages/logic/src/export/check-in-export.ts`, new v7 fixture |
| Privacy | The privacy screen copy, the licences screen |
| Tests | Extends `@bro/app:test`, `@bro/api:test`, and the real-SQLite migration suites |

## Automated acceptance matrix

| Case | Expected result |
| --- | --- |
| Migration 008 on fresh and step-8 files | Fresh applies all eight; a step-8 device applies only 008; re-runs are no-ops, including the four column additions. |
| Snapshot fidelity | A provider record that changes, loses a macro, or disappears changes no logged day, no total, and no export. |
| Null versus zero | A provider omitting fat stores `NULL` and reads as unknown; a food measured at zero fat stores `0` and sums as zero. |
| Derived totals | Food and drink entries on one day sum into `energy_intake` together; macros sum independently; deleting one entry changes every derived reading on the next read; nothing was written to `observations`. |
| No new projection path | `resolveMetricDay`, the daily-signal adapter, Trends, and goals are unchanged; the three macro metrics resolve through the step 8 consumption source with no per-surface arithmetic. |
| Recipes | Logging a recipe writes exactly one entry with totals snapshotted; editing the recipe afterwards changes no logged entry; deleting the recipe changes no logged entry. |
| Offline logging | With the network unavailable, recents, custom foods, recipes, free entry, correction, totals, trends, goals, and export all work unchanged. |
| Offline search | Search degrades to recents, custom foods, and cache with an honest line; typed input survives; nothing blocks or spins; recovery on reconnect needs no restart. |
| Search is the only request | The entire log, totals, trends, goals, insight, and export flow issues no request; only an explicit search or ref lookup does. |
| Endpoint identity | Requests carry no account, session, device id, or user identifier; the endpoint accepts none and rejects none for lacking one. |
| Query retention | No query text reaches any log, metric, trace, or error path, asserted against a captured logger at every level. |
| Attribution | Every result carries `source` and `licence`; the surface and licences screen credit ODbL. |
| Cache | Looked-up foods land in `bro-local.db` only; deleting the local store loses no logged entry and no custom food. |
| Default-off | A fresh install shows no food surface in Today or Trends; opting in shows it that day; the check-in is byte-identical either way. |
| Check-in isolation | Logging food on a day with no check-in leaves `hasCompletedCheckIn` false, streaks unchanged, reminders unaffected. |
| Insight unchanged | Sixteen pairs still; the teaser count is unchanged; no macro metric appears in any pair, scored, factor, assessment, or user-enterable surface. |
| Export v7 | Macros, `customConsumables`, and `customConsumableComponents` present; sensitive exclusion unchanged; v1–v6 fixtures still parse; v7 round-trips. |
| Delete local data | Entry, custom consumable, component, and cache rows gone; steps 1–8 guarantees still hold. |

## Verification commands

```bash
pnpm nx run @bro/database-app:db:generate
pnpm nx run @bro/app:test --skipNxCache
pnpm nx run @bro/api:test --skipNxCache
pnpm nx run-many -t typecheck lint -p @bro/app @bro/api @bro/database-app @bro/domain --skipNxCache
pnpm biome check .
```

`biome check` is repo-wide rather than project-scoped, and it catches what `lint` does not: formatting and import ordering. It is listed because nothing else runs it — there is no CI workflow for tests, lint, or format, so a command absent from a plan's verification block is a command nobody runs. It found fifteen formatted files and fifteen import orderings that had drifted across steps 1–9; all were mechanical safe fixes.

Preserve the complete output of a failing command. No device work is required by this step — barcode, which would have required it, is deliberately batched elsewhere.

## Exit criteria

- A food logged from the provider is stored once with a complete display and nutrition snapshot, and reads correctly after the provider record changes or disappears.
- `NULL` and `0` remain distinguishable end to end, from provider response to stored column to rendered total.
- Energy and macro totals derive at read through step 8's existing consumption source, with no new projection path and no change to `resolveMetricDay`.
- A recipe logs as exactly one snapshotted entry, and editing it never rewrites history.
- Every operation except search works with the network unavailable, proven; search degrades without blocking or losing input.
- The search endpoint carries no user identity and writes no query text anywhere, proven against a captured logger — signed off before slice 4 completes.
- ODbL attribution ships on the surface and in the licences screen.
- The privacy screen tells the truth about platform backup, food search, and sync.
- Insight gains no pairs and no engine change.
- Export v7 ships with fixtures; delete local data covers all three new tables across both stores.
- Automated suites, typecheck, and lint are green across `@bro/app`, `@bro/api`, `@bro/database-app`, and `@bro/domain`.

## Hand-off

Step 9 is the last sequencing step, so this hand-off is to the phases rather than to a step.

- **The native batch.** Barcode ([open decision 17](product-domains-and-data.md#open-decisions)) joins the outstanding physical-device work from steps 1, 2, and 5 — killed-app notification delivery, permission recovery, timezone changes, backup inspection, the authenticated EAS iOS build, and the Play Console declaration. One prebuild, one device session, one checklist.
- **The windowed-transform insight capability** — caffeine after a time of day against sleep — remains the first genuinely new engine capability any step has asked for since step 7. Entries have carried the `occurred_at` it needs since step 8, and food adds more of them.
- **The weekly-aggregation decision** (weekly unit caps, weekly habit cadence) is still wanted by two domains and should be taken once, for both.
- **Entry reads need a window.** Carried from the [step 8 hand-off](step-8-drink-logging.md#step-9-hand-off) and now more pressing: food multiplies the row rate on a table already read with `listAll()`.
- **Sync (Phase 5)** now has custom consumables and components to replicate, both authored for it: user-originated, in `bro.db`, hard-deleted rather than tombstoned. The food cache deliberately does not replicate.
- **`reminders` remains kind-less** after a fifth deferral.
